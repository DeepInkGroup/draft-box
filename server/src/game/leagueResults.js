const { statsByPlayer } = require('./leagueTransfers');
const { rankTable } = require('./leagueEngine');

function seasonResults(t) {
  if (t.kind !== 'league' || t.matchday < t.fixtures.length) return null;
  t = { ...t, matchLog: t.matchLog.filter(match => !match.cup) };
  const profiles = new Map();
  for (const match of t.matchLog) for (const side of ['A', 'B']) {
    const club = t.slotByCode[side === 'A' ? match.aCode : match.bCode];
    for (const player of match.lineups?.[side] || club.xi) profiles.set(player.id, { id: player.id, name: player.name, pos: player.rawPos || player.pos, overall: player.overall, isStar: player.isStar, club: club.name });
  }
  const players = [...statsByPlayer(t)].map(([id, stats]) => ({ ...profiles.get(id), ...stats }));
  const top = (key) => players.filter((player) => player[key] > 0).sort((a, b) => b[key] - a[key] || a.appearances - b.appearances || a.name.localeCompare(b.name)).slice(0, 10);
  const table = rankTable(t);
  return { matchdays: t.matchday, matches: t.matchLog.length, totalGoals: t.matchLog.reduce((sum, match) => sum + match.goalsA + match.goalsB, 0),
    relegated: table.slice(-2), bestAttack: table.slice().sort((a, b) => b.gf - a.gf || a.rank - b.rank)[0], bestDefense: table.slice().sort((a, b) => a.ga - b.ga || a.rank - b.rank)[0],
    scorers: top('goals'), creators: top('assists'), goalkeepers: top('saves'), stars: top('starMoments') };
}
module.exports = { seasonResults };
