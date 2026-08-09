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

// Save events: the defending goalkeeper's saves against the shots the attacking side
// didn't convert. xgFaced approximates shot volume/quality (roughly one shot on target
// per 0.3 xG); goalsConceded of those became goals, the rest are saves. Purely flavor
// for the tournament-wide "Most Saves" award — doesn't affect the scoreline.
function generateSaveEvents(team, side, xgFaced, goalsConceded) {
  const gk = team.xi.find((p) => p.pos === 'GK');
  if (!gk) return [];
  const shotsOnTarget = Math.max(goalsConceded, Math.round(xgFaced / 0.3));
  const saves = clamp(shotsOnTarget - goalsConceded, 0, 12);
  const events = [];
  for (let i = 0; i < saves; i++) {
    events.push({ minute: 1 + Math.floor(Math.random() * 90), type: 'save', player: gk.name, pos: 'GK', side });
  }
  return events;
}

// Card system: yellow-card incidents are tracked per player over the match, so a player
// who picks up a second yellow is properly sent off (not just handed another yellow
// event) — plus a small independent chance of a straight (violent-conduct-style) red.
// Either way, a sending-off rattles the dismissed player's own team for a short spell
// afterward, regardless of that individual player's own quality — modeled as a
// temporary Attack+Defense reduction. Since the engine decides a match in one shot
// (not minute-by-minute), the "short spell" is expressed as a fraction of the full 90
// minutes and converted into an average-over-the-match rating reduction. Losing the
// captain specifically hits morale harder — the affected spell runs 1.8x longer.
const YELLOW_INCIDENTS_MAX = 6; // 0-5 yellow-card incidents per match, shared across both sides
const STRAIGHT_RED_CHANCE = 0.035; // per side, independent of accumulated yellows
const REDCARD_IMPACT_PCT = 0.20;
const REDCARD_BASE_MINUTES = 15;
const CAPTAIN_REDCARD_MULTIPLIER = 1.8;

function generateCardEvents(teamA, teamB) {
  const events = [];
  const dismissals = [];
  const sentOff = new Set();
  const yellowCount = new Map();

  const sidePool = (team, side) => team.xi.filter((p) => p.pos !== 'GK').map((p) => ({ ...p, side }));
  const pool = [...sidePool(teamA, 'A'), ...sidePool(teamB, 'B')];
  if (!pool.length) return { events, dismissals };

  const key = (p) => `${p.side}:${p.id}`;
  const eligible = (side) => pool.filter((p) => !sentOff.has(key(p)) && (!side || p.side === side));

  function eject(p, minute, reason) {
    sentOff.add(key(p));
    events.push({ minute, type: 'red', player: p.name, pos: p.pos, side: p.side, reason });
    const affectedMinutes = REDCARD_BASE_MINUTES * (p.isCaptain ? CAPTAIN_REDCARD_MULTIPLIER : 1);
    dismissals.push({ side: p.side, player: p, moraleImpact: REDCARD_IMPACT_PCT * (affectedMinutes / 90) });
  }

  // Yellow-card incidents, resolved chronologically so a second yellow for the same
  // player is recognized as it happens (rather than two independent, unlinked yellows).
  const numYellowIncidents = Math.floor(Math.random() * YELLOW_INCIDENTS_MAX);
  const incidentMinutes = Array.from({ length: numYellowIncidents }, () => 1 + Math.floor(Math.random() * 90)).sort((a, b) => a - b);
  for (const minute of incidentMinutes) {
    const avail = eligible();
    if (!avail.length) break;
    const p = avail[Math.floor(Math.random() * avail.length)];
    const count = (yellowCount.get(key(p)) || 0) + 1;
    yellowCount.set(key(p), count);
    events.push({ minute, type: 'yellow', player: p.name, pos: p.pos, side: p.side });
    if (count >= 2) eject(p, minute, 'second-yellow');
  }

  // Independent straight-red chance per side (at most one dismissal per side from this
  // path). Restricted to players with no card yet at all — a player who already picked
  // up a yellow this match can only be sent off via a second yellow, never an unrelated
  // straight red, so their card history never contradicts itself in minute order.
  for (const side of ['A', 'B']) {
    if (Math.random() >= STRAIGHT_RED_CHANCE) continue;
    const avail = eligible(side).filter((p) => !yellowCount.has(key(p)));
    if (!avail.length) continue;
    const p = avail[Math.floor(Math.random() * avail.length)];
    eject(p, 1 + Math.floor(Math.random() * 90), 'straight-red');
  }

  return { events, dismissals };
}

// Match stats (possession, passes, shots, corners, fouls) are derived straight from the
// same Attack/Defense ratings used for xG — the better/more cohesive side tends to see
// more of the ball, pass it more cleanly, and generate more shots/corners. Cards and
// saves are exact tallies from the already-generated event list (final, including any
// extra-time events). Narrative, like the event feed; doesn't feed back into the score.
function computeMatchStats(ratingsA, ratingsB, xgA, xgB, goalsA, goalsB, events) {
  const qualityDiff = (ratingsA.attack + ratingsA.defense) - (ratingsB.attack + ratingsB.defense);
  const possessionA = Math.round(clamp(50 + qualityDiff * 0.6, 32, 68));
  const possessionB = 100 - possessionA;

  const avgA = (ratingsA.attack + ratingsA.defense) / 2;
  const avgB = (ratingsB.attack + ratingsB.defense) / 2;
  const passAccuracyA = Math.round(clamp(68 + (avgA - 75) * 0.7, 55, 94));
  const passAccuracyB = Math.round(clamp(68 + (avgB - 75) * 0.7, 55, 94));

  const totalPasses = 780 + Math.round((Math.random() - 0.5) * 120);
  const passesA = Math.round((totalPasses * possessionA) / 100);
  const passesB = totalPasses - passesA;

  // Shots on target reuse the same ~0.3-xG-per-shot approximation as save events;
  // total shots assume roughly 42% land on target, a typical real-football rate.
  const shotsOnTargetA = Math.max(goalsA, Math.round(xgA / 0.3));
  const shotsOnTargetB = Math.max(goalsB, Math.round(xgB / 0.3));
  const shotsA = Math.round(shotsOnTargetA / 0.42);
  const shotsB = Math.round(shotsOnTargetB / 0.42);

  const cornersTotal = 7 + Math.floor(Math.random() * 7); // 7-13
  const cornersA = Math.round((cornersTotal * possessionA) / 100);
  const cornersB = cornersTotal - cornersA;

  // Fouls correlate loosely with chasing the game — the side seeing less of the ball
  // tends to commit a few more.
  const foulsA = Math.round(clamp(10 + (possessionB - possessionA) * 0.08 + (Math.random() - 0.5) * 4, 4, 20));
  const foulsB = Math.round(clamp(10 + (possessionA - possessionB) * 0.08 + (Math.random() - 0.5) * 4, 4, 20));

  const tally = (type, side) => events.filter((e) => e.type === type && e.side === side).length;

  return {
    A: {
      possession: possessionA, passAccuracy: passAccuracyA, passes: passesA,
      shots: shotsA, shotsOnTarget: shotsOnTargetA, corners: cornersA, fouls: foulsA,
      yellowCards: tally('yellow', 'A'), redCards: tally('red', 'A'), saves: tally('save', 'A')
    },
    B: {
      possession: possessionB, passAccuracy: passAccuracyB, passes: passesB,
      shots: shotsB, shotsOnTarget: shotsOnTargetB, corners: cornersB, fouls: foulsB,
      yellowCards: tally('yellow', 'B'), redCards: tally('red', 'B'), saves: tally('save', 'B')
    }
  };
}

// Extra time: two 15-minute periods (minutes 91-120), only reached in knockout matches
// still level after 90'. Lower-scoring than normal time — legs are tired and sides play
// more cautiously — modeled as roughly a third of a full match's expected goals.
function simulateExtraTime(ratingsA, ratingsB, edgeA, edgeB, teamA, teamB) {
  const etXgA = expectedGoals(ratingsA.attack, ratingsB.defense, edgeA) * (30 / 90);
  const etXgB = expectedGoals(ratingsB.attack, ratingsA.defense, edgeB) * (30 / 90);
  const goalsA = clamp(poissonSample(etXgA), 0, 4);
  const goalsB = clamp(poissonSample(etXgB), 0, 4);
  const events = [
    ...generateGoalEvents(teamA, goalsA).map((e) => ({ ...e, side: 'A', minute: 91 + Math.floor(Math.random() * 30) })),
    ...generateGoalEvents(teamB, goalsB).map((e) => ({ ...e, side: 'B', minute: 91 + Math.floor(Math.random() * 30) }))
  ];
  return { goalsA, goalsB, events };
}

// Penalty shootout: proper kick-by-kick, not an instant coin flip. Each side's best
// takers (by overall) go first; success chance is quality-weighted. Standard 5 rounds
// each, with the real-football early-stop rule (stop once the trailing side can no
// longer mathematically catch up in the remaining initial-round kicks), then sudden
// death — one kick each per round — until someone is left standing.
function orderedKickers(team) {
  const outfield = team.xi.filter((p) => p.pos !== 'GK');
  const pool = outfield.length ? outfield : team.xi;
  return pool.slice().sort((a, b) => b.overall - a.overall);
}

function simulatePenaltyShootout(teamA, teamB) {
  const kickersA = orderedKickers(teamA);
  const kickersB = orderedKickers(teamB);
  const kickProb = (p) => clamp(0.62 + (p.overall - 75) / 200, 0.45, 0.9);

  const kicks = [];
  let scoreA = 0;
  let scoreB = 0;
  let round = 1;
  while (true) {
    const kA = kickersA[(round - 1) % kickersA.length];
    const scoredA = Math.random() < kickProb(kA);
    kicks.push({ side: 'A', player: kA.name, scored: scoredA, round });
    if (scoredA) scoreA += 1;

    const kB = kickersB[(round - 1) % kickersB.length];
    const scoredB = Math.random() < kickProb(kB);
    kicks.push({ side: 'B', player: kB.name, scored: scoredB, round });
    if (scoredB) scoreB += 1;

    if (round >= 5) {
      if (scoreA !== scoreB) break; // decided after at least 5 rounds each
      round += 1; // sudden death: continue one kick each per round until decided
      continue;
    }

    const remaining = 5 - round;
    if (scoreA > scoreB + remaining || scoreB > scoreA + remaining) break; // trailing side can no longer catch up
    round += 1;
  }

  return { kicks, penaltyWinner: scoreA > scoreB ? 'A' : 'B', penalties: { A: scoreA, B: scoreB } };
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

  const cardPlan = generateCardEvents(teamA, teamB);
  for (const d of cardPlan.dismissals) {
    const affected = d.side === 'A' ? ratingsA : ratingsB;
    affected.attack *= (1 - d.moraleImpact);
    affected.defense *= (1 - d.moraleImpact);
  }

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
  const saveEvents = [
    ...generateSaveEvents(teamA, 'A', xgB, goalsB),
    ...generateSaveEvents(teamB, 'B', xgA, goalsA)
  ];
  let events = [...goalEvents, ...cardPlan.events, ...saveEvents];

  let wentToExtraTime = false;
  let etGoalsA = 0;
  let etGoalsB = 0;
  let wentToPenalties = false;
  let penaltyWinner = null;
  let penalties = null;
  let penaltyKicks = null;

  // Knockout draws play extra time before penalties — never straight to a shootout.
  if (knockout && goalsA === goalsB) {
    wentToExtraTime = true;
    const et = simulateExtraTime(ratingsA, ratingsB, edgeA, edgeB, teamA, teamB);
    etGoalsA = et.goalsA;
    etGoalsB = et.goalsB;
    goalsA += etGoalsA;
    goalsB += etGoalsB;
    events = [...events, ...et.events];

    if (goalsA === goalsB) {
      wentToPenalties = true;
      const shootout = simulatePenaltyShootout(teamA, teamB);
      penaltyWinner = shootout.penaltyWinner;
      penalties = shootout.penalties;
      penaltyKicks = shootout.kicks;
    }
  }

  events.sort((a, b) => a.minute - b.minute);
  const stats = computeMatchStats(ratingsA, ratingsB, xgA, xgB, goalsA, goalsB, events);

  return {
    goalsA, goalsB, xgA, xgB, stats, events,
    wentToExtraTime, etGoalsA, etGoalsB,
    wentToPenalties, penaltyWinner, penalties, penaltyKicks
  };
}

module.exports = { simulateMatch, poissonSample, formationEdge };
