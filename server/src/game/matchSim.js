const { computeTeamRatings } = require('./ratings');
const { getProfile } = require('./formations');

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

function simulateMatch(teamA, teamB, { knockout = false } = {}) {
  const ratingsA = computeTeamRatings(teamA.xi, teamA.formation);
  const ratingsB = computeTeamRatings(teamB.xi, teamB.formation);
  const edgeA = formationEdge(teamA.formation, teamB.formation);
  const edgeB = formationEdge(teamB.formation, teamA.formation);

  const xgA = expectedGoals(ratingsA.attack, ratingsB.defense, edgeA);
  const xgB = expectedGoals(ratingsB.attack, ratingsA.defense, edgeB);

  let goalsA = clamp(poissonSample(xgA), 0, 9);
  let goalsB = clamp(poissonSample(xgB), 0, 9);

  const result = { goalsA, goalsB, xgA, xgB, wentToPenalties: false, penaltyWinner: null };

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
