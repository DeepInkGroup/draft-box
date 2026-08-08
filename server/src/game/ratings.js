const { getSlots } = require('./formations');

// Every slot gets a continuous attack/defense weight from its pitch depth (y):
// y=0 (the opponent's goal line) is pure attack, y=100 (own goal/GK) is pure defense.
function slotWeights(y) {
  return { attack: 1 - y / 100, defense: y / 100 };
}

// Weighted-average team ratings from an 11-player XI (each needs .overall and .slotCode)
// plus a small composure bonus for real star players (capped at 3 stars).
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
    atkNum += p.overall * w.attack;
    atkDen += w.attack;
    defNum += p.overall * w.defense;
    defDen += w.defense;
    overallSum += p.overall;
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

module.exports = { computeTeamRatings, slotWeights };
