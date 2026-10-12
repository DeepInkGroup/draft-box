const { getLeague, getTeam } = require('../data/competitions');
const { getSlots, playerFitsSlot } = require('./formations');
const { teamStrength } = require('./botEngine');

function ensureTransferWindow(t) {
  if (t.kind !== 'league' || t.stage === 'done') return null;
  const opensAfter = Math.floor(t.fixtures.length / 2);
  if (!t.transferWindow && t.matchday >= opensAfter) {
    t.transferWindow = { opensAfter, users: Object.fromEntries(Object.values(t.slotByCode).filter((team) => team.isHuman)
      .map((team) => [team.userId, { phase: 'release', outgoing: [], vacancies: [] }])) };
  }
  return t.transferWindow || null;
}

function statsByPlayer(t) {
  const stats = new Map();
  const entry = (id) => {
    if (!stats.has(id)) stats.set(id, { appearances: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, starMoments: 0 });
    return stats.get(id);
  };
  for (const match of t.matchLog) {
    for (const side of ['A', 'B']) {
      const code = side === 'A' ? match.aCode : match.bCode;
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
  const window = ensureTransferWindow(t);
  const progress = window?.users[userId];
  const opensAfter = Math.floor(t.fixtures.length / 2);
  if (!progress || viewedStep < opensAfter) return { phase: 'closed', opensAfter };
  const team = Object.values(t.slotByCode).find((slot) => slot.isHuman && slot.userId === userId);
  const stats = statsByPlayer(t);
  const profile = (player, status) => ({ ...player, clubName: getTeam(player.team)?.name || player.team, status,
    stats: stats.get(player.id) || { appearances: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, starMoments: 0 } });
  const used = new Set(Object.values(t.slotByCode).filter((slot) => slot.isHuman).flatMap((slot) => slot.xi.map((player) => player.id)));
  const released = new Set(progress.outgoing.map((player) => player.id));
  const market = progress.phase === 'sign' ? getLeague(t.leagueId).teams.flatMap((club) => club.players)
    .filter((player) => !used.has(player.id) && !released.has(player.id))
    .map((player) => ({ ...profile(player, 'Available'), eligibleSlots: progress.vacancies.filter((slot) => playerFitsSlot(player, slot)).map((slot) => slot.code) }))
    .filter((player) => player.eligibleSlots.length).sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name)) : [];
  return { phase: progress.phase, opensAfter, squad: team.xi.map((player) => profile(player, 'In your XI')),
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
  const window = ensureTransferWindow(t);
  const progress = window?.users[userId];
  const team = Object.values(t.slotByCode || {}).find((slot) => slot.isHuman && slot.userId === userId);
  if (!team || t.kind !== 'league' || t.stage === 'done' || !progress || !['release', 'sign'].includes(progress.phase)) throw new Error('the transfer window is not open');
  for (const match of t.matchLog) {
    if (!match.lineups) match.lineups = { A: t.slotByCode[match.aCode].xi.map((player) => ({ ...player })), B: t.slotByCode[match.bCode].xi.map((player) => ({ ...player })) };
  }
  if (action === 'skip') {
    if (progress.phase !== 'release') throw new Error('fill both vacant positions before continuing');
    progress.phase = 'skipped';
  } else if (action === 'release') {
    const ids = payload.playerIds;
    if (progress.phase !== 'release' || !Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2) throw new Error('release exactly two different players first');
    const outgoing = ids.map((id) => team.xi.find((player) => player.id === id));
    if (outgoing.some((player) => !player)) throw new Error('you can only release players from your XI');
    progress.outgoing = outgoing.map((player) => ({ ...player }));
    progress.vacancies = outgoing.map((player) => ({ ...getSlots(team.formation).find((slot) => slot.code === player.slotCode), isCaptain: !!player.isCaptain }));
    team.xi = team.xi.filter((player) => !ids.includes(player.id));
    progress.phase = 'sign';
  } else if (action === 'sign') {
    const picks = payload.picks;
    if (progress.phase !== 'sign' || !Array.isArray(picks) || picks.length !== 2 || new Set(picks.map((pick) => pick.playerId)).size !== 2 || new Set(picks.map((pick) => pick.slotCode)).size !== 2) throw new Error('choose two different replacements for the two vacant positions');
    const market = transferSnapshot(t, userId, t.matchday).market;
    const incoming = picks.map((pick) => {
      const player = market.find((candidate) => candidate.id === pick.playerId);
      const vacancy = progress.vacancies.find((slot) => slot.code === pick.slotCode);
      if (!player || !vacancy || !player.eligibleSlots.includes(vacancy.code)) throw new Error('choose an available league player who fits each vacant position');
      const source = getLeague(t.leagueId).teams.flatMap((club) => club.players).find((candidate) => candidate.id === player.id);
      return { ...source, slotCode: vacancy.code, isCaptain: !!vacancy.isCaptain };
    });
    team.xi.push(...incoming);
    team.xi.sort((a, b) => getSlots(team.formation).findIndex((slot) => slot.code === a.slotCode) - getSlots(team.formation).findIndex((slot) => slot.code === b.slotCode));
    progress.incoming = incoming;
    progress.phase = 'complete';
  } else throw new Error('invalid transfer action');
  team.strength = teamStrength(team.xi);
  return t;
}
module.exports = { ensureTransferWindow, transferSnapshot, transfersPending, planTransfer, statsByPlayer };
