const { getSlots, playerFitsSlot, playerPositionCodes } = require('./formations');
const { CAPTAIN_BONUS } = require('./ratings');
const VERSION = 1;
const HOME_XG_ADVANTAGE = 0.16;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 1000) / 1000;
const mean = (values, fallback = 65) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;

function roleFit(player, slot) {
  if (!slot) return .92;
  if (playerFitsSlot(player, slot)) return 1;
  if ((player.pos === 'GK') !== (slot.group === 'GK')) return .6;
  if (player.pos === slot.group) return .97;
  return player.pos === 'MF' || slot.group === 'MF' ? .95 : .92;
}

// Work on a match-only XI. Stored ratings, selections and historical lineups stay intact.
function leagueTeamModel(team) {
  const slots = new Map(getSlots(team.formation).map(slot => [slot.code, slot]));
  const adjustments = [];
  const xi = team.xi.map(player => {
    const slot = slots.get(player.slotCode), fit = roleFit(player, slot), codes = playerPositionCodes(player);
    const captainOverall = player.isCaptain ? Math.min(Math.max(99, player.overall), player.overall + CAPTAIN_BONUS) : player.overall;
    if (fit < 1) adjustments.push({ id: player.id, name: player.name, naturalPosition: player.rawPos || player.pos, assignedRole: slot?.short || player.slotCode, fit });
    const depth = slot ? 1 - slot.y / 100 : .5;
    const naturalFinisher = codes.some(code => ['ST', 'CF', 'SS'].includes(code)) ? 1.25 : codes.some(code => ['LW', 'RW', 'CAM'].includes(code)) ? 1.1 : 1;
    const scoring = slot?.group === 'FW' ? 2.2 : slot?.group === 'MF' ? slot.y < 45 ? 1.2 : .75 : .35;
    const creating = slot?.group === 'MF' ? 1.5 : slot?.group === 'FW' ? .85 : .6;
    return { ...player, overall: captainOverall * fit,
      leagueScoringWeight: scoring * Math.pow(clamp(depth, .08, .95), .9) * naturalFinisher,
      leagueCreationWeight: creating * clamp(1 - Math.abs((slot?.y ?? 50) - 42) / 65, .12, 1),
      leagueFinisherBias: naturalFinisher };
  });
  const buckets = { GK: [], DF: [], MF: [], FW: [] };
  for (const player of xi) (buckets[slots.get(player.slotCode)?.group] || buckets.MF).push(player.overall);
  const outfield = mean(xi.filter(player => player.pos !== 'GK').map(player => player.overall));
  const goalkeeper = mean(buckets.GK, outfield - 10), defense = mean(buckets.DF, outfield), midfield = mean(buckets.MF, outfield), attack = mean(buckets.FW, outfield);
  const starBonus = Math.min(3, xi.filter(player => player.isStar).length) * .4;
  return { team: { ...team, xi }, ratings: {
    attack: attack * .6 + midfield * .3 + defense * .1 + starBonus,
    defense: defense * .55 + midfield * .25 + goalkeeper * .2 + starBonus,
    control: midfield * .65 + defense * .2 + attack * .15,
    overall: mean(xi.map(player => player.overall)), stars: xi.filter(player => player.isStar).length
  }, report: { roleFit: round(mean(team.xi.map(player => roleFit(player, slots.get(player.slotCode))), 1)), adjustments,
    lines: { goalkeeper: round(goalkeeper), defense: round(defense), midfield: round(midfield), attack: round(attack) } } };
}

// Relative quality keeps a league of 60-rated clubs playable without pretending its
// players have elite finishing. Quality differences still decide the advantage.
function leagueExpectedGoals(attack, defense, edge) {
  return clamp(1.28 + clamp(attack - defense, -32, 32) * .025 + clamp(edge * .025, -.18, .18), .25, 2.65);
}
function leagueKeeperModifier(overall) { return clamp(1 - (overall - 70) * .007, .85, 1.15); }
function leagueDismissalImpact(minute, captain = false) {
  const remaining = clamp((90 - minute) / 90, 0, 1), leadership = captain ? 1.1 : 1;
  return { attack: .18 * remaining * leadership, defense: .14 * remaining * leadership };
}
module.exports = { VERSION, HOME_XG_ADVANTAGE, roleFit, leagueTeamModel, leagueExpectedGoals, leagueKeeperModifier, leagueDismissalImpact };
