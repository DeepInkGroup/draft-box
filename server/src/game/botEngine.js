const { slotsFor, POSITION_GROUPS } = require('./formations');

const BOT_FORMATION = '4-3-3';

// Auto-picks a bot's best available XI from its real squad pool, honoring formation slot counts.
function bestXI(team, formation = BOT_FORMATION) {
  const slots = slotsFor(formation);
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of team.players) byPos[p.pos].push(p);
  for (const pos of POSITION_GROUPS) byPos[pos].sort((a, b) => b.overall - a.overall);

  const xi = [];
  for (const pos of POSITION_GROUPS) {
    xi.push(...byPos[pos].slice(0, slots[pos]));
  }
  return xi;
}

function teamStrength(xi) {
  if (!xi.length) return 0;
  return xi.reduce((s, p) => s + p.overall, 0) / xi.length;
}

module.exports = { bestXI, teamStrength, BOT_FORMATION };
