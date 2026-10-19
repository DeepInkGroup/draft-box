const { rankTable } = require('./leagueEngine');
const { randomSample } = require('./transferOffers');
const { getSlots, playerFitsSlot } = require('./formations');
const { rosterPlayer, ensureClubRosters } = require('./leagueAiTransfers');
const { teamStrength } = require('./botEngine');
const { startCohesionRecovery } = require('./leagueCohesion');

// Generated once on the completed season. Never change its historical squads/results.
function prepareCareer(t, random = Math.random) {
  if (t.stage !== 'done') throw new Error('Finish the season before planning the next season');
  if (t.careerTransition) return t.careerTransition;
  const aiClubs = Object.values(t.slotByCode).filter(team => !team.isHuman);
  const available = randomSample(aiClubs, aiClubs.length, random);
  const humans = Object.values(t.slotByCode).filter(team => team.isHuman && !team.managerUnavailable);
  const users = {};
  // Rotate the allocation order randomly; offers are exclusive until everyone decides.
  for (const team of randomSample(humans, humans.length, random)) {
    const count = t.managerOffers ? Math.min(available.length, Math.floor(random() * 3)) : 0;
    const offers = available.splice(0, count).map(club => ({ code: club.code, name: club.name, formation: club.formation }));
    users[team.userId] = { clubCode: team.code, selectedClubCode: team.code, username: team.username,
      phase: offers.length ? 'choose' : 'complete', offers };
  }
  const departures = t.playerDepartures ? planDepartures(t, random) : [];
  return (t.careerTransition = { users, departures });
}

function careerPending(t) {
  return Object.values(t.careerTransition?.users || {}).some(user => user.phase === 'choose');
}

function careerSnapshot(t, userId) {
  const progress = t.careerTransition?.users[userId];
  if (!progress) return null;
  return { ...structuredClone(progress), ready: !careerPending(t),
    waitingFor: Object.entries(t.careerTransition.users).filter(([, user]) => user.phase === 'choose')
      .map(([id, user]) => ({ userId: Number(id), username: user.username })),
    departures: structuredClone(t.careerTransition.departures || []) };
}

function chooseManagerClub(t, userId, clubCode) {
  if (t.stage !== 'done') throw new Error('Manager offers are only available after the season finishes');
  const user = t.careerTransition?.users[userId];
  if (!user || user.phase !== 'choose') throw new Error('There is no pending manager decision');
  const selected = clubCode == null ? user.clubCode : clubCode;
  if (selected !== user.clubCode) {
    const club = t.slotByCode[selected];
    if (!user.offers.some(offer => offer.code === selected) || !club || club.isHuman)
      throw new Error('Choose an offered AI club or stay with your current club');
    if (Object.entries(t.careerTransition.users).some(([id, other]) => Number(id) !== userId && other.selectedClubCode === selected))
      throw new Error('This club already has a human manager');
  }
  user.selectedClubCode = selected;
  user.phase = 'complete';
}

function planDepartures(t, random) {
  const planned = structuredClone(t);
  ensureClubRosters(planned);
  const occupied = new Set(Object.values(planned.slotByCode).flatMap(team => team.xi.map(player => player.id)));
  const counts = new Map();
  for (const team of Object.values(planned.slotByCode)) for (const player of team.xi) counts.set(player.id, (counts.get(player.id) || 0) + 1);
  const departures = [];
  const table = rankTable(t);
  for (const row of table.filter(row => row.rank > Math.floor(table.length * 2 / 3))) {
    // Struggling clubs may lose one or two players; departures never occur mid-season.
    if (random() >= 0.4) continue;
    const team = planned.slotByCode[row.code];
    const max = 1 + Math.floor(random() * 2);
    let changed = 0;
    for (const player of randomSample(team.xi, team.xi.length, random)) {
      if (changed >= max) break;
      if (counts.get(player.id) !== 1) continue;
      const slot = getSlots(team.formation).find(slot => slot.code === player.slotCode);
      const reserves = planned.clubRosters[team.code].filter(candidate => !occupied.has(candidate.id) && playerFitsSlot(candidate, slot));
      if (!reserves.length) continue;
      const replacement = randomSample(reserves, 1, random)[0];
      departures.push({ clubCode: team.code, clubName: team.name, rank: row.rank,
        player: structuredClone(player), replacement: { ...replacement, slotCode: player.slotCode, isCaptain: !!player.isCaptain } });
      occupied.add(replacement.id);
      changed++;
    }
  }
  return departures;
}

function applyDepartures(t, departures = []) {
  const counts = new Map();
  ensureClubRosters(t);
  for (const entry of departures) {
    const team = t.slotByCode[entry.clubCode];
    const index = team.xi.findIndex(player => player.id === entry.player.id);
    if (index < 0) throw new Error('The departing player is no longer in this club');
    team.xi[index] = structuredClone(entry.replacement);
    // Drafted players may retain their source club in their profile; a released
    // footballer becomes a free agent, never another club's hidden reserve.
    for (const code of Object.keys(t.clubRosters)) t.clubRosters[code] = t.clubRosters[code].filter(player => player.id !== entry.player.id);
    t.freeAgents ||= [];
    if (!t.freeAgents.some(player => player.id === entry.player.id)) t.freeAgents.push(rosterPlayer(entry.player));
    counts.set(team.code, (counts.get(team.code) || 0) + 1);
  }
  for (const [code, count] of counts) {
    t.slotByCode[code].strength = teamStrength(t.slotByCode[code].xi);
    startCohesionRecovery(t.slotByCode[code], count, 0);
  }
  t.seasonDepartures = structuredClone(departures);
}

// With AI transfers disabled, human signings can leave the AI lineup unchanged.
// Preserve existing human ownership when those clubs gain new managers.
function settleManagerSquads(t, clubCodes) {
  const rosters = ensureClubRosters(t);
  const teams = [...new Set(clubCodes)].map(code => t.slotByCode[code])
    .sort((a, b) => Number(b.isHuman) - Number(a.isHuman) || a.code.localeCompare(b.code));
  const occupied = new Set(Object.values(t.slotByCode).flatMap(team => team.xi.map(player => player.id)));
  const claimed = new Set(), vacancies = [];
  for (const team of teams) team.xi.forEach((player, index) => {
    if (claimed.has(player.id)) vacancies.push({ team, index, player, slot: getSlots(team.formation).find(slot => slot.code === player.slotCode) });
    else claimed.add(player.id);
  });
  if (!vacancies.length) return [];
  const candidates = vacancies.map(({ team, slot }) => [...new Map([
    ...rosters[team.code], ...(t.freeAgents || []), ...Object.values(rosters).flat()
  ].map(player => [player.id, player])).values()].filter(player => !occupied.has(player.id) && playerFitsSlot(player, slot)));
  const owners = new Map();
  function assign(index, visited) {
    for (const player of candidates[index]) {
      if (visited.has(player.id)) continue;
      visited.add(player.id);
      if (!owners.has(player.id) || assign(owners.get(player.id).index, visited)) { owners.set(player.id, { index, player }); return true; }
    }
    return false;
  }
  for (let index = 0; index < vacancies.length; index++) if (!assign(index, new Set())) throw new Error('No available reserve fits the incoming manager squad');
  const changes = [], counts = new Map();
  for (const { index, player } of owners.values()) {
    const vacancy = vacancies[index], team = vacancy.team;
    const replacement = { ...rosterPlayer(player), slotCode: vacancy.player.slotCode, isCaptain: !!vacancy.player.isCaptain };
    team.xi[vacancy.index] = replacement;
    for (const code of Object.keys(rosters)) rosters[code] = rosters[code].filter(entry => entry.id !== player.id);
    rosters[team.code].push(rosterPlayer(player));
    t.freeAgents = (t.freeAgents || []).filter(entry => entry.id !== player.id);
    counts.set(team.code, (counts.get(team.code) || 0) + 1);
    changes.push({ clubCode: team.code, player: rosterPlayer(vacancy.player), replacement: rosterPlayer(player) });
  }
  for (const [code, count] of counts) {
    t.slotByCode[code].strength = teamStrength(t.slotByCode[code].xi);
    startCohesionRecovery(t.slotByCode[code], count, 0);
  }
  return changes;
}

module.exports = { prepareCareer, careerPending, careerSnapshot, chooseManagerClub, applyDepartures, settleManagerSquads };
