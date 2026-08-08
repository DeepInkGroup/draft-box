const { getSlots, POSITION_GROUPS } = require('./formations');

const BOT_FORMATION = '4-3-3';

// Auto-picks a bot's best available XI from its real squad pool, one player per exact slot
// (not just per position group) so bots participate in the same formation-matchup logic
// as human squads.
function bestXI(team, formation = BOT_FORMATION) {
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of team.players) byPos[p.pos].push(p);
  for (const pos of POSITION_GROUPS) byPos[pos].sort((a, b) => b.overall - a.overall);

  const cursor = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const xi = [];
  for (const slot of getSlots(formation)) {
    const pool = byPos[slot.group];
    const player = pool[cursor[slot.group]] || pool[pool.length - 1];
    cursor[slot.group] += 1;
    xi.push({ id: player.id, name: player.name, team: player.team, pos: player.pos, overall: player.overall, isStar: player.isStar, slotCode: slot.code });
  }
  return xi;
}

function teamStrength(xi) {
  if (!xi.length) return 0;
  return xi.reduce((s, p) => s + p.overall, 0) / xi.length;
}

module.exports = { bestXI, teamStrength, BOT_FORMATION };
