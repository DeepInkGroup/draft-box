const { getLeague, getTeam } = require('../data/competitions');
const { statsByPlayer } = require('./leagueTransfers');
const { TACTICAL_STYLES } = require('./tacticalStyles');
const { cohesionAtMatchday } = require('./leagueCohesion');

function clubSquadSnapshot(roomState, userId, clubCode) {
  const member = roomState.members.get(userId);
  const t = roomState.tournament;
  if (!member) throw new Error('not a member of this league');
  if (roomState.mode !== 'league' || t?.kind !== 'league') throw new Error('start the league season to view team statistics');
  const club = getLeague(t.leagueId)?.teams.find((team) => team.code === clubCode);
  const slot = t.slotByCode[clubCode];
  if (!club || !slot) throw new Error('club is not part of this league');
  const matchday = Math.min(member.viewedStep, t.matchday);
  const stats = statsByPlayer(t, clubCode, matchday);
  const xi = new Map(slot.xi.map((player) => [player.id, player]));
  const released = new Set((t.transferWindow?.users[slot.userId]?.outgoing || []).map((player) => player.id));
  const roster = new Map(club.players.map((player) => [player.id, player]));
  for (const player of slot.xi) roster.set(player.id, player);
  const players = Array.from(roster.values()).map((player) => ({
    ...player, ...(xi.get(player.id) || {}), clubName: getTeam(player.team)?.name || player.team,
    status: xi.has(player.id) ? 'Starting XI' : released.has(player.id) ? 'Released' : 'Club roster',
    stats: stats.get(player.id) || { appearances: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, starMoments: 0 }
  })).sort((a, b) => Number(xi.has(b.id)) - Number(xi.has(a.id)) || b.overall - a.overall || a.name.localeCompare(b.name));
  return { code: clubCode, name: slot.name, formation: slot.formation, tacticalStyle: slot.customTactic?.name || TACTICAL_STYLES[slot.tacticalStyle]?.label || 'Balanced',
    isHuman: slot.isHuman, username: slot.username || null, matchday, players, cohesion: cohesionAtMatchday(slot, matchday) };
}
module.exports = { clubSquadSnapshot };
