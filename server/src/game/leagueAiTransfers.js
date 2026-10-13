const { getLeague } = require('../data/competitions');
const { getSlots, playerFitsSlot } = require('./formations');
const { teamStrength } = require('./botEngine');
const { startCohesionRecovery } = require('./leagueCohesion');
function rosterPlayer(player) {
  const { slotCode, isCaptain, ...profile } = player;
  return { ...profile };
}
function ensureClubRosters(t) {
  if (!t.clubRosters) t.clubRosters = Object.fromEntries(getLeague(t.leagueId).teams.map(club => [club.code, club.players.map(rosterPlayer)]));
  return t.clubRosters;
}
function runAiTransfers(t) {
  if (!t.aiTransfers || !t.transferSettings?.enabled || t.aiTransfersDone || t.matchday < Math.floor(t.fixtures.length / 2)) return;
  t.aiTransfersDone = true;
  const rosters = ensureClubRosters(t);
  const occupied = new Set(Object.values(t.slotByCode).flatMap(team => team.xi.map(player => player.id)));
  const moved = new Set();
  const involvement = new Map();
  const teams = Object.values(t.slotByCode).filter(team => !team.isHuman).sort((a,b) => a.strength - b.strength || a.code.localeCompare(b.code));
  const log = t.transferLog ||= [];
  for (const team of teams) {
    let changes = 0;
    for (const outgoing of team.xi.slice().sort((a,b) => a.overall - b.overall || a.id.localeCompare(b.id))) {
      if (changes >= t.transferSettings.maxChanges || (involvement.get(team.code) || 0) >= t.transferSettings.maxChanges) break;
      if (moved.has(outgoing.id)) continue;
      const slot = getSlots(team.formation).find(slot => slot.code === outgoing.slotCode);
      const candidates = teams.filter(source => source.code !== team.code && (involvement.get(source.code) || 0) < t.transferSettings.maxChanges).flatMap(source => rosters[source.code]
        .filter(player => !occupied.has(player.id) && !moved.has(player.id) && player.overall > outgoing.overall && playerFitsSlot(player,slot))
        .map(player => ({ source, player })));
      candidates.sort((a,b) => b.player.overall - a.player.overall || a.player.id.localeCompare(b.player.id));
      if (!candidates.length) continue;
      const { source, player } = candidates[0];
      team.xi[team.xi.findIndex(entry => entry.id === outgoing.id)] = { ...player, slotCode: outgoing.slotCode, isCaptain: !!outgoing.isCaptain };
      rosters[team.code] = rosters[team.code].filter(entry => entry.id !== outgoing.id).concat(rosterPlayer(player));
      rosters[source.code] = rosters[source.code].filter(entry => entry.id !== player.id).concat(rosterPlayer(outgoing));
      occupied.delete(outgoing.id); occupied.add(player.id); moved.add(outgoing.id); moved.add(player.id);
      log.push({ type: 'ai', matchday: t.matchday, from: source.code, to: team.code, player: rosterPlayer(player), exchangedPlayer: rosterPlayer(outgoing) });
      involvement.set(team.code,(involvement.get(team.code) || 0) + 1);
      involvement.set(source.code,(involvement.get(source.code) || 0) + 1);
      changes++;
    }
    if (changes) { team.strength = teamStrength(team.xi); startCohesionRecovery(team,changes,t.matchday); }
  }
}
module.exports = { runAiTransfers, ensureClubRosters, rosterPlayer };
