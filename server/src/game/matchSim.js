const { computeTeamRatings, computeChemistry } = require('./ratings');
const { getProfile, getSlots } = require('./formations');

// Simulates a match from each side's Attack/Defense ratings (player quality, weighted by
// slot depth) plus a formation "edge" term (attacking shape vs. the opponent's defensive
// shape, and width mismatch) so the tactical setup — not just raw player quality — shapes
// the result. See the rulebook PDF for the full derivation.

function poissonSample(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// How much team X's attacking shape overwhelms team Y's defensive shape, plus a bonus
// for X being meaningfully wider than Y (stretching a narrower defense). Clamped so no
// single formation matchup can dominate a match on its own — it nudges the scoreline,
// player quality still decides most games.
function formationEdge(formationX, formationY) {
  const px = getProfile(formationX);
  const py = getProfile(formationY);
  const shapeEdge = (px.atkShape - py.defShape) * 0.4;
  const widthEdge = (px.width - py.width) * 0.06;
  return clamp(shapeEdge + widthEdge, -6, 6);
}

function expectedGoals(ratingFor, ratingAgainst, edge) {
  return clamp(1.35 + (ratingFor - ratingAgainst) / 18 + edge / 10, 0.15, 4.5);
}

function pickWeighted(candidates, weightFn) {
  const weights = candidates.map((c) => Math.max(0.001, weightFn(c)));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function slotY(player, formation) {
  const slot = getSlots(formation).find((s) => s.code === player.slotCode);
  return slot ? slot.y : 50;
}

// Goal events: scorer likelihood peaks up front (low y) and scales with quality; assists
// (present on ~75% of goals) come mainly from midfield-depth players.
function generateGoalEvents(team, count) {
  const events = [];
  const outfield = team.xi.filter((p) => p.pos !== 'GK');
  const pool = outfield.length ? outfield : team.xi;
  for (let i = 0; i < count; i++) {
    const scorer = pickWeighted(pool, (p) => (1 - slotY(p, team.formation) / 100) * (0.6 + p.overall / 200));
    let assist = null;
    const assistCandidates = pool.filter((p) => p !== scorer);
    if (assistCandidates.length && Math.random() < 0.75) {
      assist = pickWeighted(assistCandidates, (p) => 1 - Math.abs(slotY(p, team.formation) - 45) / 60);
    }
    events.push({
      minute: 1 + Math.floor(Math.random() * 90),
      type: 'goal',
      player: scorer.name,
      pos: scorer.pos,
      assistBy: assist ? assist.name : null
    });
  }
  return events;
}

// Cards: a handful of yellows most matches, spread across both sides (any outfield
// player), and a rare red. Purely flavor — doesn't affect the scoreline.
function generateCardEvents(teamA, teamB) {
  const events = [];
  const pool = [
    ...teamA.xi.filter((p) => p.pos !== 'GK').map((p) => ({ ...p, side: 'A' })),
    ...teamB.xi.filter((p) => p.pos !== 'GK').map((p) => ({ ...p, side: 'B' }))
  ];
  if (!pool.length) return events;

  const numYellows = Math.floor(Math.random() * 5); // 0-4
  for (let i = 0; i < numYellows; i++) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    events.push({ minute: 1 + Math.floor(Math.random() * 90), type: 'yellow', player: p.name, pos: p.pos, side: p.side });
  }
  if (Math.random() < 0.07) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    events.push({ minute: 1 + Math.floor(Math.random() * 90), type: 'red', player: p.name, pos: p.pos, side: p.side });
  }
  return events;
}

function simulateMatch(teamA, teamB, { knockout = false } = {}) {
  const ratingsA = computeTeamRatings(teamA.xi, teamA.formation);
  const ratingsB = computeTeamRatings(teamB.xi, teamB.formation);
  const chemA = computeChemistry(teamA.xi, teamA.formation);
  const chemB = computeChemistry(teamB.xi, teamB.formation);
  ratingsA.attack *= chemA.multiplier;
  ratingsA.defense *= chemA.multiplier;
  ratingsB.attack *= chemB.multiplier;
  ratingsB.defense *= chemB.multiplier;
  const edgeA = formationEdge(teamA.formation, teamB.formation);
  const edgeB = formationEdge(teamB.formation, teamA.formation);

  const xgA = expectedGoals(ratingsA.attack, ratingsB.defense, edgeA);
  const xgB = expectedGoals(ratingsB.attack, ratingsA.defense, edgeB);

  let goalsA = clamp(poissonSample(xgA), 0, 9);
  let goalsB = clamp(poissonSample(xgB), 0, 9);

  const goalEvents = [
    ...generateGoalEvents(teamA, goalsA).map((e) => ({ ...e, side: 'A' })),
    ...generateGoalEvents(teamB, goalsB).map((e) => ({ ...e, side: 'B' }))
  ];
  const cardEvents = generateCardEvents(teamA, teamB);
  const events = [...goalEvents, ...cardEvents].sort((a, b) => a.minute - b.minute);

  const result = { goalsA, goalsB, xgA, xgB, wentToPenalties: false, penaltyWinner: null, events };

  if (knockout && goalsA === goalsB) {
    result.wentToPenalties = true;
    const composureA = ratingsA.attack + ratingsA.defense;
    const composureB = ratingsB.attack + ratingsB.defense;
    const probA = clamp(0.5 + (composureA - composureB) / 400, 0.35, 0.65);
    const aWins = Math.random() < probA;
    const winnerPens = 3 + Math.floor(Math.random() * 3); // 3-5
    const loserPens = Math.max(0, winnerPens - (1 + Math.floor(Math.random() * 3)));
    result.penaltyWinner = aWins ? 'A' : 'B';
    result.penalties = aWins
      ? { A: winnerPens, B: loserPens }
      : { A: loserPens, B: winnerPens };
  }

  return result;
}

module.exports = { simulateMatch, poissonSample, formationEdge };
