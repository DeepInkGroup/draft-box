const { computeTeamRatings, computeChemistry } = require('./ratings');
const { getProfile, getSlots } = require('./formations');
const { TACTICAL_STYLES, normalizeStyle, matchupEdge } = require('./tacticalStyles');

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
  const diff = clamp(ratingFor - ratingAgainst, -28, 28);
  const attackTier = clamp((ratingFor - 76) / 55, -0.12, 0.28);
  const defensiveResistance = clamp((ratingAgainst - 76) / 70, -0.08, 0.22);
  const matchupShape = clamp(edge * 0.035, -0.18, 0.18);
  const qualitySwing = diff * 0.022;
  return clamp(1.05 + qualitySwing + attackTier + matchupShape - defensiveResistance, 0.28, 2.65);
}

// The opposing goalkeeper's own quality — not just their contribution to the averaged
// Defense rating — measurably suppresses or inflates the chance a shot actually goes in.
// 75 overall is neutral; a genuinely elite keeper (88-90+, Alisson/Courtois territory)
// cuts the opponent's expected goals by up to ~12%, a weak one concedes ~12% more —
// real football's "a great keeper single-handedly wins you points" effect, distinct from
// the rest of the back line.
const GK_MODIFIER_COEFF = 0.01;
function gkModifier(gkOverall) {
  return clamp(1 - (gkOverall - 75) * GK_MODIFIER_COEFF, 0.8, 1.2);
}

// A team's "emotional" state — momentum carried in from recent results, not raw quality.
// tournamentEngine tracks each team's morale (-1..+1) across the whole tournament, updated
// after every match (see updateMorale there) and stored on the team's persistent slot, so
// it's simply whatever's on team.morale here. A confident side coming off good results
// plays with a bit more conviction; a shaken one coming off a bad result underperforms its
// paper quality — a real but modest swing, the same scale as Chemistry (Section 5).
const MORALE_SWING = 0.05;
const HUMAN_VS_AI_POWER_MULTIPLIER = 1.2;
function moraleModifier(morale) {
  return 1 + clamp(morale || 0, -1, 1) * MORALE_SWING;
}

function applyHumanVsAiBoost(ratings, ownTeam, opponentTeam) {
  if (!ownTeam.isHuman || opponentTeam.isHuman) return;
  const compressedBoost = 1 + (HUMAN_VS_AI_POWER_MULTIPLIER - 1) * 0.45;
  ratings.attack *= compressedBoost;
  ratings.defense *= compressedBoost;
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

// Individual quality weight for goal involvement, exponential rather than linear so a
// genuine star (85-90+ overall) meaningfully outproduces a squad-depth player (60-65) —
// real football's "a handful of players account for most of the output" pattern — instead
// of everyone in a plausible slot having near-equal odds regardless of who they are.
// 75 overall is the pivot (weight 1); ~4x spread between a 60 and a 90 overall player.
const QUALITY_CURVE_BASE = 1.06;
function qualityWeight(overall) {
  return Math.pow(QUALITY_CURVE_BASE, overall - 75);
}

function slotRole(slot) {
  if (!slot) return { attack: 0.5, support: 0.5, shield: 0.5, save: 0 };
  const attack = clamp(1 - slot.y / 100, 0.05, 0.95);
  const support = clamp(1 - Math.abs(slot.y - 45) / 55, 0.1, 1);
  const shield = clamp(slot.y / 100, 0.05, 0.95);
  const save = slot.group === 'GK' ? 1 : 0;
  return { attack, support, shield, save };
}

function influenceProfile(team, tactical) {
  const slots = new Map(getSlots(team.formation).map((s) => [s.code, s]));
  let attack = 0;
  let support = 0;
  let shield = 0;
  let attackDen = 0;
  let supportDen = 0;
  let shieldDen = 0;
  let keeper = 75;
  let starClutch = 0;

  for (const p of team.xi) {
    const role = slotRole(slots.get(p.slotCode));
    const q = qualityWeight(p.overall);
    attack += p.overall * q * role.attack;
    support += p.overall * q * role.support;
    shield += p.overall * q * role.shield;
    attackDen += q * role.attack;
    supportDen += q * role.support;
    shieldDen += q * role.shield;
    if (p.pos === 'GK') keeper = p.overall;
    if (p.isStar) starClutch += Math.max(0, p.overall - 82) * q;
  }

  const n = Math.max(1, team.xi.length);
  const attackFocus = attack / Math.max(1, attackDen);
  const supportFocus = support / Math.max(1, supportDen);
  const shieldFocus = shield / Math.max(1, shieldDen);
  const tacticalStress = Math.max(0, tactical.mods.risk - 1) * 0.55 + Math.max(0, tactical.mods.press - 1) * 0.45;
  const staminaDrag = clamp(tacticalStress * (1 - clamp((supportFocus - 68) / 20, 0, 1)) * 0.08, 0, 0.08);

  return {
    attackFocus,
    supportFocus,
    shieldFocus,
    keeper,
    starClutch: clamp(starClutch / (n * 10), 0, 0.12),
    staminaDrag
  };
}

function influenceXgBonus(own, opp, ownTactical, oppTactical, possession) {
  const creatorLift = clamp((own.supportFocus - 75) / 180, -0.05, 0.1) * ownTactical.mods.control;
  const finisherLift = clamp((own.attackFocus - 75) / 170, -0.05, 0.11) * (ownTactical.mods.tempo * 0.45 + ownTactical.mods.transition * 0.35 + ownTactical.mods.risk * 0.2);
  const shieldTax = clamp((opp.shieldFocus - 75) / 165, -0.08, 0.1) * oppTactical.mods.defense;
  const territory = clamp((possession - 50) / 360, -0.055, 0.055);
  return clamp(creatorLift + finisherLift + own.starClutch * 0.55 + territory - shieldTax - own.staminaDrag, -0.16, 0.22);
}

function tacticalPlan(ownStyle, oppStyle) {
  const key = normalizeStyle(ownStyle);
  const style = TACTICAL_STYLES[key] || TACTICAL_STYLES.balanced;
  const edge = matchupEdge(key, oppStyle);
  return { key, label: style.label, description: style.description, edge, mods: style };
}

function applyTacticalStyle(ratings, plan) {
  const tempoAtk = 1 + (plan.mods.tempo - 1) * 0.045;
  const riskAtk = 1 + (plan.mods.risk - 1) * 0.035;
  const transitionAtk = 1 + (plan.mods.transition - 1) * 0.035;
  const controlDef = 1 + (plan.mods.control - 1) * 0.03;
  const pressDef = 1 + (plan.mods.press - 1) * 0.025;
  const riskDef = 1 - Math.max(0, plan.mods.risk - 1) * 0.045;
  ratings.attack *= plan.mods.attack * (1 + plan.edge) * tempoAtk * riskAtk * transitionAtk;
  ratings.defense *= plan.mods.defense * (1 + plan.edge * 0.55) * controlDef * pressDef * riskDef;
}

function starCandidates(team, dismissalMinutes = null, minute = 80) {
  return team.xi.filter((p) => p.isStar && !isPlayerDismissedAt(p, dismissalMinutes, minute));
}

function maybeStarMoment(team, side, context, dismissalMinutes, minuteRange, phase, plan = tacticalPlan(team.tacticalStyle, 'balanced')) {
  const candidates = starCandidates(team, dismissalMinutes, minuteRange[0]);
  if (!candidates.length) return null;
  const best = candidates.reduce((top, p) => !top || p.overall > top.overall ? p : top, null);
  const stage = context.stage || 'group';
  let chance = phase === 'extra' ? 0.08 : 0.045;
  if (context.knockout) chance += 0.025;
  if (stage === 'final') chance += 0.045;
  chance += clamp((best.overall - 84) * 0.012, 0, 0.08);
  chance *= plan.mods.starMoment;
  if (phase === 'extra') chance *= 1 + Math.max(0, plan.mods.control - 1) * 0.12;
  if (Math.random() >= chance) return null;
  const player = pickWeighted(candidates, (p) => qualityWeight(p.overall) * (p.overall >= 85 ? 1.25 : 1));
  const minute = minuteRange[0] + Math.floor(Math.random() * (minuteRange[1] - minuteRange[0] + 1));
  const boost = phase === 'extra' ? 0.08 + Math.random() * 0.16 : 0.1 + Math.random() * 0.2;
  return {
    minute,
    type: 'star',
    side,
    player: player.name,
    pos: player.pos,
    boost: Math.round(boost * 100) / 100,
    phase,
    effect: phase === 'extra' ? 'created an extra-time game-changing chance' : 'created a late game-changing chance'
  };
}

// Dismissal tracking needs to be resilient against squads whose player ids aren't
// perfectly stable (e.g. legacy imports, manually-edited pools, or older rooms saved
// before id normalization). For any dismissal lookup we check two keys: the player's
// id (the primary, unique key) and a secondary "name + position" fingerprint so the
// exact same real person can never be treated as active once they've been ordered
// off. A player is considered ACTIVE (available for selection) at a given minute
// only if BOTH lookups agree they have NOT been dismissed before that minute.
function isPlayerDismissedAt(player, dismissalMap, minute) {
  if (!dismissalMap) return false;
  const byId = dismissalMap.get(player.id);
  if (byId != null && minute >= byId) return true;
  const fp = `${player.name}|${player.pos}`;
  const byFp = dismissalMap.get(fp);
  if (byFp != null && minute >= byFp) return true;
  return false;
}

// Mirror the same two-key lookup used at dismissal-check time when we originally
// build the dismissal map, so both sides (recording and checking) agree.
function recordDismissal(dismissalMap, player, minute) {
  dismissalMap.set(player.id, minute);
  dismissalMap.set(`${player.name}|${player.pos}`, minute);
}

// Goal events: scorer likelihood peaks up front (low y) and scales with individual
// quality; assists (present on ~75% of goals) come mainly from midfield-depth players,
// also quality-weighted — a team's best creator sets up far more goals than a bench
// player in a similar slot. A player already sent off by the goal's minute (per
// dismissalMinutes) can't be picked as scorer or assist — they're off the pitch,
// so they can't be involved in a goal that happens afterward.
function generateGoalEvents(team, count, dismissalMinutes = null, minuteRange = [1, 90]) {
  const events = [];
  const outfield = team.xi.filter((p) => p.pos !== 'GK');
  const fullPool = outfield.length ? outfield : team.xi;
  const [minMinute, maxMinute] = minuteRange;
  const span = maxMinute - minMinute + 1;
  for (let i = 0; i < count; i++) {
    const minute = minMinute + Math.floor(Math.random() * span);
    const activePool = fullPool.filter((p) => !isPlayerDismissedAt(p, dismissalMinutes, minute));
    const pool = activePool.length ? activePool : fullPool;
    const scorer = pickWeighted(pool, (p) => Math.pow(Math.max(0.08, 1 - slotY(p, team.formation) / 100), 1.25) * qualityWeight(p.overall) * (p.isStar ? 1.08 : 1));
    let assist = null;
    const assistCandidates = pool.filter((p) => p !== scorer);
    if (assistCandidates.length && Math.random() < 0.75) {
      assist = pickWeighted(assistCandidates, (p) => Math.max(0.1, 1 - Math.abs(slotY(p, team.formation) - 45) / 60) * qualityWeight(p.overall) * (p.isStar ? 1.05 : 1));
    }
    events.push({
      minute,
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
// If the keeper has been dismissed (rare, but possible via a straight red) they can
// no longer make saves after that minute, so any saves sampled are capped to keep
// events and stats consistent with the dismissal.
function generateSaveEvents(team, side, xgFaced, goalsConceded, dismissalMinutes = null) {
  const gk = team.xi.find((p) => p.pos === 'GK');
  if (!gk) return [];
  const shotsOnTarget = Math.max(goalsConceded, Math.round(xgFaced / 0.3));
  let saves = clamp(shotsOnTarget - goalsConceded, 0, 12);
  const events = [];
  const gkEjectedAt = dismissalMinutes ? dismissalMinutes.get(gk.id) ?? dismissalMinutes.get(`${gk.name}|${gk.pos}`) ?? null : null;
  for (let i = 0; i < saves; i++) {
    let minute = 1 + Math.floor(Math.random() * 90);
    if (gkEjectedAt != null) {
      if (minute >= gkEjectedAt) {
        minute = 1 + Math.floor(Math.random() * Math.max(1, gkEjectedAt - 1));
        if (minute >= gkEjectedAt) {
          saves -= 1;
          continue;
        }
      }
    }
    events.push({ minute, type: 'save', player: gk.name, pos: 'GK', side });
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
  const dismissalMinutesA = new Map();
  const dismissalMinutesB = new Map();

  const sidePool = (team, side) => team.xi.filter((p) => p.pos !== 'GK').map((p) => ({ ...p, side }));
  const pool = [...sidePool(teamA, 'A'), ...sidePool(teamB, 'B')];
  if (!pool.length) return { events, dismissals, dismissalMinutesA, dismissalMinutesB };

  const key = (p) => `${p.side}:${p.id}|${p.name}|${p.pos}`;
  const eligible = (side) => pool.filter((p) => !sentOff.has(key(p)) && (!side || p.side === side));

  function eject(p, minute, reason) {
    sentOff.add(key(p));
    recordDismissal(p.side === 'A' ? dismissalMinutesA : dismissalMinutesB, p, minute);
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

  return { events, dismissals, dismissalMinutesA, dismissalMinutesB };
}

// Possession is derived straight from the same Attack/Defense ratings used for xG — the
// better/more cohesive side tends to see more of the ball. Computed early (before goals
// are decided) because corners and fouls — and, through them, a real chunk of expected
// goals — flow from it. See setPieceXgBonus below.
function computePossession(ratingsA, ratingsB, styleA, styleB) {
  const qualityDiff = (ratingsA.attack + ratingsA.defense) - (ratingsB.attack + ratingsB.defense);
  const controlSwing = (styleA.mods.control - styleB.mods.control) * 14;
  const pressSwing = (styleA.mods.press - styleB.mods.press) * 4;
  const tempoSwing = (styleB.mods.tempo - styleA.mods.tempo) * 3;
  const styleSwing = (styleA.mods.possession - styleB.mods.possession) + controlSwing + pressSwing + tempoSwing + (styleA.edge - styleB.edge) * 18;
  const possessionA = Math.round(clamp(50 + qualityDiff * 0.6 + styleSwing, 28, 72));
  return { possessionA, possessionB: 100 - possessionA };
}

// Corners and fouls-won are set-piece opportunities, not just narrative color. Fouls
// correlate loosely with chasing the game — the side seeing less of the ball tends to
// commit a few more, handing the opponent a free kick.
function computeSetPieces(possessionA, possessionB, styleA, styleB) {
  const tempoLift = ((styleA.mods.tempo + styleB.mods.tempo + styleA.mods.press + styleB.mods.press) / 4 - 1) * 3;
  const cornersTotal = clamp(7 + Math.floor(Math.random() * 7) + Math.round(tempoLift), 5, 16);
  const cornerShareA = clamp(possessionA + (styleA.mods.press - styleB.mods.press) * 5 + (styleA.mods.transition - styleB.mods.transition) * 3, 25, 75);
  const cornersA = Math.round((cornersTotal * cornerShareA) / 100);
  const cornersB = cornersTotal - cornersA;
  const foulsA = Math.round(clamp(10 + styleA.mods.foulBias + (styleA.mods.risk - 1) * 4 + (styleA.mods.press - 1) * 3 + (possessionB - possessionA) * 0.08 + (Math.random() - 0.5) * 4, 4, 25));
  const foulsB = Math.round(clamp(10 + styleB.mods.foulBias + (styleB.mods.risk - 1) * 4 + (styleB.mods.press - 1) * 3 + (possessionA - possessionB) * 0.08 + (Math.random() - 0.5) * 4, 4, 25));
  return { cornersA, cornersB, foulsA, foulsB };
}

// Corners and fouls conceded by the opponent are real goalscoring opportunities in their
// own right — a set piece routine or a dead-ball delivery converts independently of open
// play quality. Modest per-instance bonuses (a team averaging ~6 corners and ~10 opponent
// fouls picks up roughly +0.19 xG from set pieces alone) so a side that dominates corners
// and draws a lot of fouls gets a real, visible nudge in the scoreline, not just a
// cosmetic stat line.
const CORNER_XG_BONUS = 0.011;
const FOUL_XG_BONUS = 0.0045;
function setPieceXgBonus(myCorners, oppFouls, style) {
  return (myCorners * CORNER_XG_BONUS + oppFouls * FOUL_XG_BONUS) * style.mods.setPiece;
}

function transitionXgBonus(myStyle, oppStyle, possession) {
  const transitionEdge = (myStyle.mods.transition - 1) * 0.13;
  const pressTrap = Math.max(0, oppStyle.mods.press - 1) * Math.max(0, 50 - possession) * 0.0025;
  const riskSpace = Math.max(0, oppStyle.mods.risk - 1) * myStyle.mods.transition * 0.045;
  return clamp(transitionEdge + pressTrap + riskSpace, -0.04, 0.12);
}

// Shots, passes, cards and saves round out the stat line — shots/passes are narrative
// approximations of the same quality gap that produced the scoreline; cards and saves are
// exact tallies from the already-generated event list (final, including any extra-time
// events), so the stat line and event feed always agree.
function computeMatchStats(ratingsA, ratingsB, xgA, xgB, goalsA, goalsB, events, possessionA, possessionB, cornersA, cornersB, foulsA, foulsB, styleA, styleB) {
  const avgA = (ratingsA.attack + ratingsA.defense) / 2;
  const avgB = (ratingsB.attack + ratingsB.defense) / 2;
  const passAccuracyA = Math.round(clamp(68 + (avgA - 75) * 0.7 + styleA.mods.passAccuracy + (styleA.mods.control - 1) * 8 - Math.max(0, styleA.mods.risk - 1) * 4, 55, 94));
  const passAccuracyB = Math.round(clamp(68 + (avgB - 75) * 0.7 + styleB.mods.passAccuracy + (styleB.mods.control - 1) * 8 - Math.max(0, styleB.mods.risk - 1) * 4, 55, 94));

  const totalPasses = 780 + Math.round((Math.random() - 0.5) * 120);
  const passesA = Math.round((totalPasses * possessionA) / 100);
  const passesB = totalPasses - passesA;

  // Around one shot on target per 0.36 xG keeps scorelines and stat lines in a
  // football-like band; high-tempo styles add attempts without turning every chance
  // into a clear shot on target.
  const shotsOnTargetA = Math.max(goalsA, Math.round(xgA / 0.36));
  const shotsOnTargetB = Math.max(goalsB, Math.round(xgB / 0.36));
  const shotsA = Math.round((shotsOnTargetA / 0.38) * (styleA.mods.tempo * 0.45 + styleA.mods.risk * 0.22 + styleA.mods.transition * 0.18 + styleA.mods.control * 0.15));
  const shotsB = Math.round((shotsOnTargetB / 0.38) * (styleB.mods.tempo * 0.45 + styleB.mods.risk * 0.22 + styleB.mods.transition * 0.18 + styleB.mods.control * 0.15));

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
function simulateExtraTime(ratingsA, ratingsB, edgeA, edgeB, teamA, teamB, dismissalMinutesA, dismissalMinutesB, gkModA, gkModB, context, tacticalA, tacticalB) {
  const starA = maybeStarMoment(teamA, 'A', context, dismissalMinutesA, [100, 120], 'extra', tacticalA);
  const starB = maybeStarMoment(teamB, 'B', context, dismissalMinutesB, [100, 120], 'extra', tacticalB);
  const etXgA = expectedGoals(ratingsA.attack, ratingsB.defense, edgeA) * gkModB * 0.28 + transitionXgBonus(tacticalA, tacticalB, 50) * 0.3 + (starA ? starA.boost : 0);
  const etXgB = expectedGoals(ratingsB.attack, ratingsA.defense, edgeB) * gkModA * 0.28 + transitionXgBonus(tacticalB, tacticalA, 50) * 0.3 + (starB ? starB.boost : 0);
  const goalsA = clamp(poissonSample(etXgA), 0, 4);
  const goalsB = clamp(poissonSample(etXgB), 0, 4);
  const events = [
    ...generateGoalEvents(teamA, goalsA, dismissalMinutesA, [91, 120]).map((e) => ({ ...e, side: 'A' })),
    ...generateGoalEvents(teamB, goalsB, dismissalMinutesB, [91, 120]).map((e) => ({ ...e, side: 'B' })),
    ...[starA, starB].filter(Boolean)
  ];
  return { goalsA, goalsB, events, starMoments: [starA, starB].filter(Boolean) };
}

// Penalty shootout: proper kick-by-kick, not an instant coin flip. Each side's best
// takers (by overall) go first; success chance is quality-weighted by both the kicker's
// own ability AND the opposing keeper's (the same gkModifier used for open play — a
// shootout-saving goalkeeper is a real, recognizable thing). Standard 5 rounds each,
// with the real-football early-stop rule (stop once the trailing side can no longer
// mathematically catch up in the remaining initial-round kicks), then sudden death —
// one kick each per round — until someone is left standing.
function orderedKickers(team, dismissedIds = null) {
  const isKickable = (p) => {
    if (!dismissedIds) return true;
    if (dismissedIds.has(p.id)) return false;
    if (dismissedIds.has(`${p.name}|${p.pos}`)) return false;
    return true;
  };
  const outfield = team.xi.filter((p) => p.pos !== 'GK' && isKickable(p));
  const fallback = team.xi.filter(isKickable);
  const pool = outfield.length ? outfield : (fallback.length ? fallback : team.xi);
  return pool.slice().sort((a, b) => b.overall - a.overall);
}

function simulatePenaltyShootout(teamA, teamB, dismissedIdsA = null, dismissedIdsB = null, gkModA = 1, gkModB = 1, context = {}) {
  const kickersA = orderedKickers(teamA, dismissedIdsA);
  const kickersB = orderedKickers(teamB, dismissedIdsB);
  const kickProb = (p, oppGkMod, round) => {
    const starBoost = p.isStar ? (round > 5 || context.stage === 'final' ? 0.05 : 0.03) : 0;
    return clamp((0.62 + (p.overall - 75) / 180 + starBoost) * oppGkMod, 0.35, 0.94);
  };

  const kicks = [];
  let scoreA = 0;
  let scoreB = 0;
  let round = 1;
  while (true) {
    const kA = kickersA[(round - 1) % kickersA.length];
    const scoredA = Math.random() < kickProb(kA, gkModB, round);
    kicks.push({ side: 'A', player: kA.name, scored: scoredA, round });
    if (scoredA) scoreA += 1;

    const kB = kickersB[(round - 1) % kickersB.length];
    const scoredB = Math.random() < kickProb(kB, gkModA, round);
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

function simulateMatch(teamA, teamB, { knockout = false, stage = 'group' } = {}) {
  const ratingsA = computeTeamRatings(teamA.xi, teamA.formation);
  const ratingsB = computeTeamRatings(teamB.xi, teamB.formation);
  const chemA = computeChemistry(teamA.xi, teamA.formation);
  const chemB = computeChemistry(teamB.xi, teamB.formation);
  ratingsA.attack *= chemA.multiplier;
  ratingsA.defense *= chemA.multiplier;
  ratingsB.attack *= chemB.multiplier;
  ratingsB.defense *= chemB.multiplier;

  const moraleModA = moraleModifier(teamA.morale);
  const moraleModB = moraleModifier(teamB.morale);
  ratingsA.attack *= moraleModA;
  ratingsA.defense *= moraleModA;
  ratingsB.attack *= moraleModB;
  ratingsB.defense *= moraleModB;

  applyHumanVsAiBoost(ratingsA, teamA, teamB);
  applyHumanVsAiBoost(ratingsB, teamB, teamA);

  const tacticalA = tacticalPlan(teamA.tacticalStyle, teamB.tacticalStyle);
  const tacticalB = tacticalPlan(teamB.tacticalStyle, teamA.tacticalStyle);
  applyTacticalStyle(ratingsA, tacticalA);
  applyTacticalStyle(ratingsB, tacticalB);

  const cardPlan = generateCardEvents(teamA, teamB);
  for (const d of cardPlan.dismissals) {
    const affected = d.side === 'A' ? ratingsA : ratingsB;
    affected.attack *= (1 - d.moraleImpact);
    affected.defense *= (1 - d.moraleImpact);
  }

  const edgeA = formationEdge(teamA.formation, teamB.formation);
  const edgeB = formationEdge(teamB.formation, teamA.formation);

  const gkA = teamA.xi.find((p) => p.pos === 'GK');
  const gkB = teamB.xi.find((p) => p.pos === 'GK');
  const gkModA = gkModifier(gkA ? gkA.overall : 75);
  const gkModB = gkModifier(gkB ? gkB.overall : 75);

  const { possessionA, possessionB } = computePossession(ratingsA, ratingsB, tacticalA, tacticalB);
  const { cornersA, cornersB, foulsA, foulsB } = computeSetPieces(possessionA, possessionB, tacticalA, tacticalB);
  const setPieceBonusA = setPieceXgBonus(cornersA, foulsB, tacticalA);
  const setPieceBonusB = setPieceXgBonus(cornersB, foulsA, tacticalB);
  const transitionBonusA = transitionXgBonus(tacticalA, tacticalB, possessionA);
  const transitionBonusB = transitionXgBonus(tacticalB, tacticalA, possessionB);
  const influenceA = influenceProfile(teamA, tacticalA);
  const influenceB = influenceProfile(teamB, tacticalB);
  const playerBonusA = influenceXgBonus(influenceA, influenceB, tacticalA, tacticalB, possessionA);
  const playerBonusB = influenceXgBonus(influenceB, influenceA, tacticalB, tacticalA, possessionB);

  const context = { knockout, stage };
  const lateStarA = maybeStarMoment(teamA, 'A', context, cardPlan.dismissalMinutesA, [80, 90], 'late', tacticalA);
  const lateStarB = maybeStarMoment(teamB, 'B', context, cardPlan.dismissalMinutesB, [80, 90], 'late', tacticalB);
  let starMoments = [lateStarA, lateStarB].filter(Boolean);

  const xgA = clamp(expectedGoals(ratingsA.attack, ratingsB.defense, edgeA) * gkModB + setPieceBonusA + transitionBonusA + playerBonusA + (lateStarA ? lateStarA.boost : 0), 0.18, 3.25);
  const xgB = clamp(expectedGoals(ratingsB.attack, ratingsA.defense, edgeB) * gkModA + setPieceBonusB + transitionBonusB + playerBonusB + (lateStarB ? lateStarB.boost : 0), 0.18, 3.25);

  let goalsA = clamp(poissonSample(xgA), 0, 7);
  let goalsB = clamp(poissonSample(xgB), 0, 7);

  const goalEvents = [
    ...generateGoalEvents(teamA, goalsA, cardPlan.dismissalMinutesA).map((e) => ({ ...e, side: 'A' })),
    ...generateGoalEvents(teamB, goalsB, cardPlan.dismissalMinutesB).map((e) => ({ ...e, side: 'B' }))
  ];
  const saveEvents = [
    ...generateSaveEvents(teamA, 'A', xgB, goalsB, cardPlan.dismissalMinutesA),
    ...generateSaveEvents(teamB, 'B', xgA, goalsA, cardPlan.dismissalMinutesB)
  ];
  let events = [...goalEvents, ...cardPlan.events, ...saveEvents, ...starMoments];

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
    const et = simulateExtraTime(ratingsA, ratingsB, edgeA, edgeB, teamA, teamB, cardPlan.dismissalMinutesA, cardPlan.dismissalMinutesB, gkModA, gkModB, context, tacticalA, tacticalB);
    etGoalsA = et.goalsA;
    etGoalsB = et.goalsB;
    goalsA += etGoalsA;
    goalsB += etGoalsB;
    events = [...events, ...et.events];
    starMoments = [...starMoments, ...(et.starMoments || [])];

    if (goalsA === goalsB) {
      wentToPenalties = true;
      const dismissedIdsA = new Set(cardPlan.dismissalMinutesA.keys());
      const dismissedIdsB = new Set(cardPlan.dismissalMinutesB.keys());
      const shootout = simulatePenaltyShootout(teamA, teamB, dismissedIdsA, dismissedIdsB, gkModA, gkModB, context);
      penaltyWinner = shootout.penaltyWinner;
      penalties = shootout.penalties;
      penaltyKicks = shootout.kicks;
    }
  }

  events.sort((a, b) => a.minute - b.minute);
  const stats = computeMatchStats(ratingsA, ratingsB, xgA, xgB, goalsA, goalsB, events, possessionA, possessionB, cornersA, cornersB, foulsA, foulsB, tacticalA, tacticalB);

  return {
    goalsA, goalsB, xgA, xgB, stats, events,
    tactical: { A: tacticalA, B: tacticalB },
    chemistry: { A: chemA, B: chemB },
    influence: { A: influenceA, B: influenceB },
    starMoments,
    wentToExtraTime, etGoalsA, etGoalsB,
    wentToPenalties, penaltyWinner, penalties, penaltyKicks
  };
}

module.exports = { simulateMatch, poissonSample, formationEdge };
