// Simple statistical match simulator: team strength (avg overall) -> expected goals -> Poisson sample.

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

function expectedGoals(strengthFor, strengthAgainst) {
  const diff = strengthFor - strengthAgainst;
  return clamp(1.35 + diff / 18, 0.15, 4.5);
}

function simulateMatch(teamA, teamB, { knockout = false } = {}) {
  const xgA = expectedGoals(teamA.strength, teamB.strength);
  const xgB = expectedGoals(teamB.strength, teamA.strength);

  let goalsA = poissonSample(xgA);
  let goalsB = poissonSample(xgB);
  goalsA = clamp(goalsA, 0, 9);
  goalsB = clamp(goalsB, 0, 9);

  const result = { goalsA, goalsB, wentToPenalties: false, penaltyWinner: null };

  if (knockout && goalsA === goalsB) {
    result.wentToPenalties = true;
    const diff = teamA.strength - teamB.strength;
    const probA = clamp(0.5 + diff / 400, 0.35, 0.65);
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

module.exports = { simulateMatch, poissonSample };
