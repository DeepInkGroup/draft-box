const { getLeague, ratedPlayer } = require('../data/competitions');
const { getSlots, playerFitsSlot } = require('./formations');
const { teamStrength } = require('./botEngine');
const { startCohesionRecovery } = require('./leagueCohesion');
const { randomSample } = require('./transferOffers');
function rosterPlayer(player) {
  const { slotCode, isCaptain, ...profile } = player;
  return { ...profile };
}
function ensureClubRosters(t) {
  if (!t.clubRosters) t.clubRosters = Object.fromEntries(getLeague(t.leagueId).teams.map(club => [club.code, club.players.map(player => rosterPlayer(ratedPlayer(player,t)))]));
  return t.clubRosters;
}
function runAiTransfers(t, windowType = 'midseason', random = Math.random) {
  const end = windowType === 'endseason';
  const settings = end ? t.endTransferSettings : t.transferSettings;
  const flag = end ? 'endAiTransfersDone' : 'aiTransfersDone';
  if (!(end ? t.endAiTransfers : t.aiTransfers) || !settings?.enabled || t[flag] || (!end && t.matchday < Math.floor(t.fixtures.length / 2))) return;
  t[flag] = true;
  const rosters = ensureClubRosters(t);
  const occupied = new Set(Object.values(t.slotByCode).flatMap(team => team.xi.map(player => player.id)));
  const moved = new Set();
  const involvement = new Map();
  const teams = Object.values(t.slotByCode).filter(team => !team.isHuman).sort((a,b) => a.strength - b.strength || a.code.localeCompare(b.code));
  const log = t.transferLog ||= [];
  for (const team of teams) {
    let changes = 0;
    for (const outgoing of team.xi.slice().sort((a,b) => a.overall - b.overall || a.id.localeCompare(b.id))) {
      if (changes >= settings.maxChanges || (involvement.get(team.code) || 0) >= settings.maxChanges) break;
      if (moved.has(outgoing.id)) continue;
      const slot = getSlots(team.formation).find(slot => slot.code === outgoing.slotCode);
      const candidates = teams.filter(source => source.code !== team.code && (involvement.get(source.code) || 0) < settings.maxChanges).flatMap(source => rosters[source.code]
        .filter(player => !occupied.has(player.id) && !moved.has(player.id) && playerFitsSlot(player,slot))
        .map(player => ({ source, player })));
      if (candidates.length < 2) continue;
      const offers = randomSample(candidates, 2, random);
      const { source, player } = randomSample(offers, 1, random)[0];
      team.xi[team.xi.findIndex(entry => entry.id === outgoing.id)] = { ...player, slotCode: outgoing.slotCode, isCaptain: !!outgoing.isCaptain };
      rosters[team.code] = rosters[team.code].filter(entry => entry.id !== outgoing.id).concat(rosterPlayer(player));
      rosters[source.code] = rosters[source.code].filter(entry => entry.id !== player.id).concat(rosterPlayer(outgoing));
      occupied.delete(outgoing.id); occupied.add(player.id); moved.add(outgoing.id); moved.add(player.id);
      log.push({ type: 'ai', windowType, matchday: t.matchday, from: source.code, to: team.code, player: rosterPlayer(player), exchangedPlayer: rosterPlayer(outgoing), offeredPlayerIds: offers.map(offer => offer.player.id) });
      involvement.set(team.code,(involvement.get(team.code) || 0) + 1);
      involvement.set(source.code,(involvement.get(source.code) || 0) + 1);
      changes++;
    }
    if (changes) { team.strength = teamStrength(team.xi); startCohesionRecovery(team,changes,t.matchday); }
  }
}
module.exports = { runAiTransfers, ensureClubRosters, rosterPlayer };
