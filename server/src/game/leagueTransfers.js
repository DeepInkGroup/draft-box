const { getLeague, getTeam } = require('../data/competitions');
const { getSlots, playerFitsSlot } = require('./formations');
const { teamStrength } = require('./botEngine');
const { settingsForSeason } = require('./leagueSettings');
const { startCohesionRecovery, cohesionAtMatchday } = require('./leagueCohesion');
const { tacticSnapshot } = require('./leagueMidseason');
const { randomSample } = require('./transferOffers');
const { ensureClubRosters, rosterPlayer, runAiTransfers } = require('./leagueAiTransfers');

function ensureTransferWindow(t) {
  if (t.kind !== 'league') return null;
  if (t.endTransferWindow && t.matchday === 0) return t.endTransferWindow;
  if (!settingsForSeason(t).enabled) return null;
  if (t.stage === 'done') return t.transferWindow || null;
  const opensAfter = Math.floor(t.fixtures.length / 2);
  if (!t.transferWindow && t.matchday >= opensAfter) {
    t.transferWindow = { opensAfter, users: Object.fromEntries(Object.values(t.slotByCode).filter((team) => team.isHuman)
      .map((team) => [team.userId, { phase: 'release', outgoing: [], vacancies: [] }])) };
  }
  return t.transferWindow || null;
}

function openEndSeasonTransfers(t) {
  if (t.matchday !== 0 || !t.endTransferSettings?.enabled || t.endTransferWindow) return;
  runAiTransfers(t, 'endseason');
  t.endTransferWindow = { opensAfter: 0, users: Object.fromEntries(Object.values(t.slotByCode).filter(team => team.isHuman)
    .map(team => [team.userId, { phase: 'release', outgoing: [], vacancies: [] }])) };
}
function windowSettings(t) {
  return t.endTransferWindow && t.matchday === 0 ? t.endTransferSettings : settingsForSeason(t);
}
function availablePlayers(t, progress) {
  const used = new Set(Object.values(t.slotByCode).filter(team => team.isHuman || t.aiTransfers || t.endAiTransfers).flatMap(team => team.xi.map(player => player.id)));
  const released = new Set(progress.outgoing.map(player => player.id));
  return [...new Map(Object.values(ensureClubRosters(t)).flat().concat(t.freeAgents || []).map(player => [player.id, player])).values()]
    .filter(player => !used.has(player.id) && !released.has(player.id));
}
// Assign disjoint offers using a matching, so any combination of the two choices
// restores a complete XI even when several vacancies share eligible positions.
function ensureOffers(t, progress, random = Math.random) {
  if (progress.phase !== 'sign' || progress.offers) return false;
  const pool = availablePlayers(t, progress);
  const requests = progress.vacancies.flatMap(slot => [slot, slot]);
  const candidates = requests.map(slot => randomSample(pool.filter(player => playerFitsSlot(player, slot)), pool.length, random));
  const owners = new Map();
  function assign(index, visited) {
    for (const player of candidates[index]) {
      if (visited.has(player.id)) continue;
      visited.add(player.id);
      if (!owners.has(player.id) || assign(owners.get(player.id), visited)) { owners.set(player.id, index); return true; }
    }
    return false;
  }
  for (let index = 0; index < requests.length; index++) if (!assign(index, new Set())) throw new Error('Not enough available players to offer two replacements per position');
  progress.offers = Object.fromEntries(progress.vacancies.map(slot => [slot.code, []]));
  for (const [id, index] of owners) progress.offers[requests[index].code].push(id);
  return true;
}

function statsByPlayer(t, clubCode = null, throughMatchday = Infinity) {
  const stats = new Map();
  const entry = (id) => {
    if (!stats.has(id)) stats.set(id, { appearances: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, starMoments: 0 });
    return stats.get(id);
  };
  for (const match of t.matchLog) {
    if ((match.matchday || 0) > throughMatchday) continue;
    for (const side of ['A', 'B']) {
      const code = side === 'A' ? match.aCode : match.bCode;
      if (clubCode && code !== clubCode) continue;
      // Legacy saved games predate per-match lineups; transfers did not exist then.
      const xi = match.lineups?.[side] || t.slotByCode[code].xi;
      const byName = new Map(xi.map((player) => [player.name, player.id]));
      for (const player of xi) entry(player.id).appearances++;
      for (const event of match.events || []) {
        if (event.side !== side) continue;
        const id = byName.get(event.player);
        const key = { goal: 'goals', save: 'saves', yellow: 'yellowCards', red: 'redCards', star: 'starMoments' }[event.type];
        if (id && key) entry(id)[key]++;
        if (event.type === 'goal' && byName.has(event.assistBy)) entry(byName.get(event.assistBy)).assists++;
      }
    }
  }
  return stats;
}

function transferSnapshot(t, userId, viewedStep) {
  if (t.kind !== 'league') return null;
  const settings = windowSettings(t);
  const team = Object.values(t.slotByCode).find((slot) => slot.isHuman && slot.userId === userId);
  const end = !!t.endTransferWindow && t.matchday === 0;
  const common = { windowType: end ? 'endseason' : 'midseason', opensAfter: end ? 0 : Math.floor(t.fixtures.length / 2), ...settings, cohesion: cohesionAtMatchday(team, viewedStep),
    tactics: tacticSnapshot(t, userId, viewedStep), aiEnabled: !!(t.aiTransfers || t.endAiTransfers),
    log: (t.transferLog || []).filter(entry => entry.matchday <= viewedStep).map(entry => ({ ...entry, fromName: t.slotByCode[entry.from]?.name || 'Free agents', toName: t.slotByCode[entry.to]?.name || 'Free agents' })) };
  if (!settings.enabled) return { ...common, phase: 'disabled' };
  const window = ensureTransferWindow(t);
  const progress = window?.users[userId];
  const opensAfter = window?.opensAfter ?? Math.floor(t.fixtures.length / 2);
  if (!progress || viewedStep < opensAfter) return { ...common, phase: 'closed' };
  const stats = statsByPlayer(t);
  const profile = (player, status) => ({ ...player, clubName: getTeam(player.team)?.name || player.team, status,
    stats: stats.get(player.id) || { appearances: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, starMoments: 0 } });
  ensureOffers(t, progress);
  const market = progress.phase === 'sign' ? availablePlayers(t, progress)
    .map(player => ({ ...profile(player, 'Available'), eligibleSlots: progress.vacancies.filter(slot => progress.offers[slot.code]?.includes(player.id)).map(slot => slot.code) }))
    .filter(player => player.eligibleSlots.length) : [];
  return { ...common, phase: progress.phase, opensAfter, squad: team.xi.map((player) => profile(player, 'In your XI')),
    outgoing: progress.outgoing.map((player) => profile(player, 'Released')), vacancies: progress.vacancies,
    incoming: (progress.incoming || []).map((player) => profile(player, 'Signed')), market };
}

function transfersPending(t) {
  const window = ensureTransferWindow(t);
  return !!window && Object.values(window.users).some((user) => ['release', 'sign'].includes(user.phase));
}

// Validate on a copy; the caller commits this plan and the roster atomically.
function planTransfer(tournament, userId, action, payload = {}) {
  const t = structuredClone(tournament);
  const limit = windowSettings(t).maxChanges;
  const window = ensureTransferWindow(t);
  const progress = window?.users[userId];
  const team = Object.values(t.slotByCode || {}).find((slot) => slot.isHuman && slot.userId === userId);
  if (!team || t.kind !== 'league' || t.stage === 'done' || !progress || !['release', 'sign'].includes(progress.phase)) throw new Error('the transfer window is not open');
  for (const match of t.matchLog) {
    if (!match.lineups) match.lineups = { A: t.slotByCode[match.aCode].xi.map((player) => ({ ...player })), B: t.slotByCode[match.bCode].xi.map((player) => ({ ...player })) };
  }
  if (action === 'skip') {
    if (progress.phase !== 'release') throw new Error('fill all vacant positions before continuing');
    progress.phase = 'skipped';
  } else if (action === 'release') {
    const ids = payload.playerIds;
    if (progress.phase !== 'release' || !Array.isArray(ids) || ids.length < 1 || ids.length > limit || new Set(ids).size !== ids.length) throw new Error(`release different players first (minimum 1, maximum ${limit})`);
    const outgoing = ids.map((id) => team.xi.find((player) => player.id === id));
    if (outgoing.some((player) => !player)) throw new Error('you can only release players from your XI');
    progress.outgoing = outgoing.map((player) => ({ ...player }));
    progress.vacancies = outgoing.map((player) => ({ ...getSlots(team.formation).find((slot) => slot.code === player.slotCode), isCaptain: !!player.isCaptain }));
    team.xi = team.xi.filter((player) => !ids.includes(player.id));
    progress.phase = 'sign';
    ensureOffers(t, progress);
  } else if (action === 'sign') {
    const picks = payload.picks;
    if (progress.phase !== 'sign' || !Array.isArray(picks) || picks.length !== progress.vacancies.length || picks.length < 1 || picks.length > limit || new Set(picks.map((pick) => pick?.playerId)).size !== picks.length || new Set(picks.map((pick) => pick?.slotCode)).size !== picks.length) throw new Error('choose a different replacement for each vacant position');
    const market = transferSnapshot(t, userId, t.matchday).market;
    const incoming = picks.map((pick) => {
      const player = market.find((candidate) => candidate.id === pick?.playerId);
      const vacancy = progress.vacancies.find((slot) => slot.code === pick?.slotCode);
      if (!player || !vacancy || !player.eligibleSlots.includes(vacancy.code)) throw new Error('choose an available league player who fits each vacant position');
      const source = getLeague(t.leagueId).teams.flatMap((club) => club.players).find((candidate) => candidate.id === player.id);
      return { ...source, slotCode: vacancy.code, isCaptain: !!vacancy.isCaptain };
    });
    team.xi.push(...incoming);
    team.xi.sort((a, b) => getSlots(team.formation).findIndex((slot) => slot.code === a.slotCode) - getSlots(team.formation).findIndex((slot) => slot.code === b.slotCode));
    progress.incoming = incoming;
    progress.phase = 'complete';
    for (let index = 0; index < incoming.length; index++) {
      const player = incoming[index], outgoing = progress.outgoing.find(entry => entry.slotCode === player.slotCode);
      const rosterOwner = Object.entries(t.clubRosters || {}).find(([,roster]) => roster.some(entry => entry.id === player.id))?.[0];
      const owner = rosterOwner || null;
      (t.transferLog ||= []).push({ type: 'human', windowType: t.endTransferWindow && t.matchday === 0 ? 'endseason' : 'midseason', matchday: t.matchday, from: owner, to: team.code, player: rosterPlayer(player), releasedPlayer: rosterPlayer(outgoing) });
      {
        const rosters = ensureClubRosters(t);
        for (const code of Object.keys(rosters)) rosters[code] = rosters[code].filter(entry => entry.id !== player.id && (code !== team.code || entry.id !== outgoing.id));
        rosters[team.code].push(rosterPlayer(player));
        t.freeAgents = (t.freeAgents || []).filter(entry => entry.id !== player.id).concat(rosterPlayer(outgoing));
      }
    }
    startCohesionRecovery(team, incoming.length, t.matchday);
  } else throw new Error('invalid transfer action');
  if (t.endTransferWindow && t.matchday === 0 && ['complete', 'skipped'].includes(progress.phase)) {
    t.initialXIs[team.code] = structuredClone(team.xi);
    t.initialClubRosters = structuredClone(t.clubRosters);
  }
  team.strength = teamStrength(team.xi);
  return t;
}
module.exports = { ensureTransferWindow, transferSnapshot, transfersPending, planTransfer, statsByPlayer, openEndSeasonTransfers, ensureOffers };
