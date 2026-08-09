const { getSlots, getAdjacentPairs } = require('./formations');

// Every slot gets a continuous attack/defense weight from its pitch depth (y):
// y=0 (the opponent's goal line) is pure attack, y=100 (own goal/GK) is pure defense.
function slotWeights(y) {
  return { attack: 1 - y / 100, defense: y / 100 };
}

const CAPTAIN_BONUS = 6;

// Weighted-average team ratings from an 11-player XI (each needs .overall and .slotCode)
// plus a small composure bonus for real star players (capped at 3 stars). A designated
// captain (member.captainSlot, room-optional) has their own overall boosted before
// weighting, so the bonus counts for more or less depending on how advanced/deep their
// slot is — same weighting logic as everyone else.
function computeTeamRatings(xi, formation) {
  const slotByCode = new Map(getSlots(formation).map((s) => [s.code, s]));

  let atkNum = 0;
  let atkDen = 0;
  let defNum = 0;
  let defDen = 0;
  let stars = 0;
  let overallSum = 0;

  for (const p of xi) {
    const slot = slotByCode.get(p.slotCode);
    const y = slot ? slot.y : 50;
    const w = slotWeights(y);
    const overall = p.isCaptain ? Math.min(99, p.overall + CAPTAIN_BONUS) : p.overall;
    atkNum += overall * w.attack;
    atkDen += w.attack;
    defNum += overall * w.defense;
    defDen += w.defense;
    overallSum += overall;
    if (p.isStar) stars += 1;
  }

  const starBonus = Math.min(3, stars) * 1.5;
  const n = xi.length || 1;

  return {
    attack: (atkDen ? atkNum / atkDen : overallSum / n) + starBonus,
    defense: (defDen ? defNum / defDen : overallSum / n) + starBonus,
    overall: overallSum / n,
    stars
  };
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

// Chemistry: how well an 11-player XI plays as a unit, independent of raw quality.
// Three parameters, each 0-1:
//   Linkage  (L) = share of "adjacent" pitch partnerships (see getAdjacentPairs) where
//                  both players were drafted from the same real source team — teammates
//                  who already know each other's game.
//   Balance  (B) = 1 - stdDev(overalls)/20, clamped — a tightly-matched XI (small gap
//                  between best and worst player) is more cohesive than one star carrying
//                  ten passengers.
//   Leadership (S) = min(1, starPlayers / 3) — real, recognizable players anchor a squad.
// Chemistry = average of the three, mapped to a 0.94-1.06 multiplier applied to both
// Attack and Defense — a real but modest swing, same spirit as the formation edge.
// Note: bot squads are entirely one real national team, so Linkage is always 1 for them —
// a deliberate trade-off against human "all-star" squads assembled from many countries.
function computeChemistry(xi, formation) {
  const pairs = getAdjacentPairs(formation);
  const bySlot = new Map(xi.map((p) => [p.slotCode, p]));

  let linked = 0;
  for (const [a, b] of pairs) {
    const pa = bySlot.get(a);
    const pb = bySlot.get(b);
    if (pa && pb && pa.team && pa.team === pb.team) linked += 1;
  }
  const linkage = pairs.length ? linked / pairs.length : 0;

  const overalls = xi.map((p) => p.overall);
  const mean = overalls.reduce((s, o) => s + o, 0) / (overalls.length || 1);
  const variance = overalls.reduce((s, o) => s + (o - mean) ** 2, 0) / (overalls.length || 1);
  const stdDev = Math.sqrt(variance);
  const balance = clamp01(1 - stdDev / 20);

  const stars = xi.filter((p) => p.isStar).length;
  const leadership = Math.min(1, stars / 3);

  const chemistry = (linkage + balance + leadership) / 3;
  const multiplier = 0.94 + chemistry * 0.12;

  return { linkage, balance, leadership, chemistry, multiplier };
}

// A 6-stat squad summary card for the draft-complete screen: the classic
// GK/Defence/Midfield/Attack position-group averages, plus two bars pulled straight
// from mechanics already in this file — Chemistry (the composite score above) and
// Star Power (how many real, recognizable players are on the XI).
function computeSquadCard(squad, formation) {
  const byGroup = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of squad) {
    const overall = p.isCaptain ? Math.min(99, p.overall + CAPTAIN_BONUS) : p.overall;
    byGroup[p.pos].push(overall);
  }
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, o) => s + o, 0) / arr.length) : 0);
  const overall = avg(squad.map((p) => (p.isCaptain ? Math.min(99, p.overall + CAPTAIN_BONUS) : p.overall)));
  const chem = computeChemistry(squad, formation);
  const stars = squad.filter((p) => p.isStar).length;

  return {
    overall,
    attack: avg(byGroup.FW),
    midfield: avg(byGroup.MF),
    defence: avg(byGroup.DF),
    gk: avg(byGroup.GK),
    chemistry: Math.round(chem.chemistry * 100),
    starPower: Math.round((Math.min(3, stars) / 3) * 100)
  };
}

// A single "power" number per team, combining the same Attack/Defense ratings and
// Chemistry multiplier the match engine actually simulates with — so the odds below are
// a genuine reflection of the engine, not a separate guess.
function computePower(xi, formation) {
  const ratings = computeTeamRatings(xi, formation);
  const chem = computeChemistry(xi, formation);
  return ((ratings.attack + ratings.defense) / 2) * chem.multiplier;
}

// Rough championship-odds estimate across the whole 48-team field: each team's power is
// raised to an exponent (spreads out otherwise-close power scores into a believable
// favorites-vs-underdogs distribution) and normalized into a probability. This is a
// pre-tournament estimate shown for fun on the lineup reveal screen — the actual
// simulation (with its Poisson randomness) is what really decides the champion.
const ODDS_EXPONENT = 12;
function computeChampionshipOdds(slotByCode) {
  const codes = Object.keys(slotByCode);
  const powers = codes.map((c) => computePower(slotByCode[c].xi, slotByCode[c].formation));
  const weighted = powers.map((p) => Math.pow(Math.max(1, p), ODDS_EXPONENT));
  const total = weighted.reduce((s, w) => s + w, 0) || 1;
  const odds = {};
  codes.forEach((c, i) => { odds[c] = weighted[i] / total; });
  return odds;
}

// Predicts which of an XI's own players is most likely to end up its top scorer/assist
// provider, using the exact same attack/support weighting matchSim uses to pick real
// goal/assist events — so the prediction and the simulation agree with each other.
function predictKeyPlayers(xi, formation) {
  const slotByCode = new Map(getSlots(formation).map((s) => [s.code, s]));
  let bestScorer = null;
  let bestScorerScore = -1;
  let bestAssist = null;
  let bestAssistScore = -1;

  for (const p of xi) {
    const slot = slotByCode.get(p.slotCode);
    const y = slot ? slot.y : 50;
    const atkScore = (1 - y / 100) * p.overall;
    const assistScore = (1 - Math.abs(y - 45) / 60) * p.overall;
    if (atkScore > bestScorerScore) { bestScorerScore = atkScore; bestScorer = p; }
    if (assistScore > bestAssistScore) { bestAssistScore = assistScore; bestAssist = p; }
  }

  return {
    topScorer: bestScorer ? bestScorer.name : null,
    topAssist: bestAssist ? bestAssist.name : null
  };
}

module.exports = {
  computeTeamRatings,
  computeChemistry,
  computeSquadCard,
  computeChampionshipOdds,
  predictKeyPlayers,
  slotWeights,
  CAPTAIN_BONUS
};
