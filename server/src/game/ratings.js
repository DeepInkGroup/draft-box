const { getSlots, getAdjacentPairs, playerFitsSlot } = require('./formations');
const { TACTICAL_STYLES, normalizeStyle } = require('./tacticalStyles');

// Every slot gets a continuous attack/defense weight from its pitch depth (y):
// y=0 (the opponent's goal line) is pure attack, y=100 (own goal/GK) is pure defense.
function slotWeights(y) {
  return { attack: 1 - y / 100, defense: y / 100 };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function qualityWeight(overall) {
  return Math.pow(1.06, (overall || 75) - 75);
}

function slotInfluence(slot) {
  const y = slot ? slot.y : 50;
  return {
    attack: Math.pow(clamp(1 - y / 100, 0.08, 0.95), 1.12),
    defense: Math.pow(clamp(y / 100, 0.08, 0.95), 1.08),
    creation: clamp(1 - Math.abs(y - 42) / 62, 0.1, 1)
  };
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
    const influence = slotInfluence(slot);
    const overall = p.isCaptain ? Math.min(99, p.overall + CAPTAIN_BONUS) : p.overall;
    const q = qualityWeight(overall) * (p.isStar ? 1.045 : 1);
    const atkWeight = w.attack * (0.7 + influence.creation * 0.18 + influence.attack * 0.22) * q;
    const defWeight = w.defense * (0.76 + influence.defense * 0.24) * q;
    atkNum += overall * atkWeight;
    atkDen += atkWeight;
    defNum += overall * defWeight;
    defDen += defWeight;
    overallSum += overall;
    if (p.isStar) stars += 1;
  }

  const starBonus = Math.min(4, stars) * 1.45;
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
  const slots = getSlots(formation);
  const slotByCode = new Map(slots.map((s) => [s.code, s]));
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

  let matchedSlots = 0;
  let outOfPosition = 0;
  const expected = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const actual = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const s of slots) expected[s.group] += 1;
  for (const p of xi) {
    const slot = slotByCode.get(p.slotCode);
    if (actual[p.pos] != null) actual[p.pos] += 1;
    if (slot && playerFitsSlot(p, slot)) matchedSlots += 1;
    else outOfPosition += 1;
  }
  const positionFit = xi.length ? matchedSlots / xi.length : 0;
  const lineError = Object.keys(expected).reduce((sum, group) => sum + Math.abs((actual[group] || 0) - expected[group]), 0);
  const lineBalance = clamp01(1 - lineError / Math.max(1, xi.length * 1.25));
  const outPenalty = clamp01(outOfPosition / Math.max(1, xi.length));

  const chemistry = clamp01(
    linkage * 0.22 +
    balance * 0.18 +
    leadership * 0.18 +
    positionFit * 0.24 +
    lineBalance * 0.18 -
    outPenalty * 0.16
  );
  const multiplier = 0.91 + chemistry * 0.18;

  return { linkage, balance, leadership, positionFit, lineBalance, outOfPosition, chemistry, multiplier };
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
    starPower: stars,
    starPowerPct: Math.round((Math.min(3, stars) / 3) * 100)
  };
}

// A single "power" number per team, combining the same Attack/Defense ratings and
// Chemistry multiplier the match engine actually simulates with — so the odds below are
// a genuine reflection of the engine, not a separate guess.
function computePower(xi, formation, tacticalStyle = 'balanced') {
  const ratings = computeTeamRatings(xi, formation);
  const chem = computeChemistry(xi, formation);
  const style = TACTICAL_STYLES[normalizeStyle(tacticalStyle)] || TACTICAL_STYLES.balanced;
  const stylePower = (
    style.attack * 0.34 +
    style.defense * 0.34 +
    style.control * 0.08 +
    style.transition * 0.08 +
    style.press * 0.06 +
    style.setPiece * 0.05 +
    style.starMoment * 0.05
  );
  return ((ratings.attack + ratings.defense) / 2) * chem.multiplier * stylePower;
}

// Rough championship-odds estimate across the whole 48-team field: each team's power is
// raised to an exponent (spreads out otherwise-close power scores into a believable
// favorites-vs-underdogs distribution) and normalized into a probability. This is a
// pre-tournament estimate shown for fun on the lineup reveal screen — the actual
// simulation (with its Poisson randomness) is what really decides the champion.
const ODDS_EXPONENT = 12;
function computeChampionshipOdds(slotByCode) {
  const codes = Object.keys(slotByCode);
  const powers = codes.map((c) => computePower(slotByCode[c].xi, slotByCode[c].formation, slotByCode[c].tacticalStyle));
  const weighted = powers.map((p) => Math.pow(Math.max(1, p), ODDS_EXPONENT));
  const total = weighted.reduce((s, w) => s + w, 0) || 1;
  const odds = {};
  codes.forEach((c, i) => { odds[c] = weighted[i] / total; });
  return odds;
}

// Predicts which of an XI's own players is most likely to end up its top scorer/assist
// provider, using the exact same attack/support weighting matchSim uses to pick real
// goal/assist events — so the prediction and the simulation agree with each other.
function predictKeyPlayers(xi, formation, tacticalStyle = 'balanced') {
  const slotByCode = new Map(getSlots(formation).map((s) => [s.code, s]));
  let bestScorer = null;
  let bestScorerScore = -1;
  let bestAssist = null;
  let bestAssistScore = -1;
  let bestPressure = null;
  let bestPressureScore = -1;
  const styleKey = normalizeStyle(tacticalStyle);
  const style = TACTICAL_STYLES[styleKey] || TACTICAL_STYLES.balanced;
  const ratings = computeTeamRatings(xi, formation);
  const chem = computeChemistry(xi, formation);
  const power = computePower(xi, formation, styleKey);
  const avgOverall = xi.length ? xi.reduce((s, p) => s + p.overall, 0) / xi.length : 0;
  const starCount = xi.filter((p) => p.isStar).length;
  const bestOverall = xi.length ? Math.max(...xi.map((p) => p.overall || 0)) : 0;

  for (const p of xi) {
    const slot = slotByCode.get(p.slotCode);
    const y = slot ? slot.y : 50;
    const quality = qualityWeight(p.overall) * (p.isStar ? 1.1 : 1);
    const influence = slotInfluence(slot);
    const atkScore = influence.attack * p.overall * quality * (style.tempo * 0.34 + style.risk * 0.26 + style.transition * 0.4);
    const assistScore = influence.creation * p.overall * quality * (style.control * 0.48 + style.press * 0.18 + style.transition * 0.34);
    const pressureScore = p.overall * quality * (p.isStar ? 1.18 : 1) * (influence.creation * 0.35 + influence.defense * 0.25 + style.press * 0.22 + style.starMoment * 0.18);
    if (atkScore > bestScorerScore) { bestScorerScore = atkScore; bestScorer = p; }
    if (assistScore > bestAssistScore) { bestAssistScore = assistScore; bestAssist = p; }
    if (pressureScore > bestPressureScore) { bestPressureScore = pressureScore; bestPressure = p; }
  }

  const riskScore = Math.round((style.risk * 0.45 + style.press * 0.35 + Math.max(0, 1 - chem.chemistry) * 0.2) * 100);
  const riskLabel = riskScore >= 116 ? 'High variance' : riskScore >= 101 ? 'Medium risk' : 'Controlled';
  const ideas = [];
  if (chem.chemistry < 0.58) ideas.push('Improve chemistry: keep more players in their natural line and avoid overloaded position groups.');
  if (starCount === 0) ideas.push('No Game Changer: protect shape and win through chemistry, set pieces and matchups.');
  if (bestOverall >= 86) ideas.push('Elite player impact: put your best overall player in a high-touch slot to raise xG and late-match threat.');
  if (ratings.attack < ratings.defense - 4) ideas.push('Attack needs support: a higher line or creator-heavy style can raise shot volume.');
  if (ratings.defense < ratings.attack - 4) ideas.push('Defense is the weak point: Defensive or Possession can reduce opponent xG.');
  if (styleKey === 'gegenpress') ideas.push('Gegenpress adds pressure and late chaos, but card/foul risk is higher.');
  if (styleKey === 'counter') ideas.push('Counter Attack is strongest when the opponent presses or controls the ball.');
  if (!ideas.length) ideas.push('Balanced profile: your biggest edge is player quality plus stable chemistry.');

  return {
    topScorer: bestScorer ? bestScorer.name : null,
    topAssist: bestAssist ? bestAssist.name : null,
    pressurePlayer: bestPressure ? bestPressure.name : null,
    enginePower: Math.round(power),
    avgOverall: Math.round(avgOverall),
    chemistryPct: Math.round(chem.chemistry * 100),
    starThreatPct: Math.round(Math.min(1, starCount / 4) * 100),
    tacticalStyle: styleKey,
    tacticalStyleLabel: style.label,
    riskLabel,
    ideas: ideas.slice(0, 3)
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
