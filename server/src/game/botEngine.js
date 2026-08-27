const { FORMATIONS, getSlots, playerFitsSlot, getProfile } = require('./formations');
const { computePower, computeTeamRatings, computeChemistry } = require('./ratings');
const { STYLE_KEYS, TACTICAL_STYLES, matchupEdge, normalizeStyle } = require('./tacticalStyles');

const BOT_FORMATION = '4-3-3';
const CENTRAL_SLOT_RE = /CM|CDM|CAM|LAM|RAM/;

function cloneForSlot(player, slot) {
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    pos: player.pos,
    rawPos: player.rawPos,
    overall: player.overall,
    isStar: player.isStar,
    slotCode: slot.code
  };
}

function slotCandidateScore(player, slot) {
  const exactFit = playerFitsSlot(player, slot);
  const lineFit = player.pos === slot.group;
  const starLift = player.isStar ? 1.2 : 0;
  const specialistLift = exactFit ? 8 : (lineFit ? 2.5 : -10);
  return player.overall + specialistLift + starLift;
}

// Auto-picks a bot's best available XI from its real squad pool, one player per exact slot
// (not just per position group) so bots participate in the same formation-matchup logic
// as human squads.
function bestXI(team, formation = BOT_FORMATION) {
  const slots = getSlots(formation);
  const used = new Set();
  const picked = new Map();

  // Fill the hardest-to-staff slots first. This prevents a generic high-overall player
  // from taking a scarce specialist role that only one or two squad members can play.
  const orderedSlots = slots.slice().sort((a, b) => {
    const fitA = team.players.filter((p) => playerFitsSlot(p, a)).length;
    const fitB = team.players.filter((p) => playerFitsSlot(p, b)).length;
    return fitA - fitB || a.y - b.y;
  });

  for (const slot of orderedSlots) {
    const available = team.players.filter((p) => !used.has(p.id));
    const pool = available.filter((p) => playerFitsSlot(p, slot));
    const sameLine = available.filter((p) => p.pos === slot.group);
    const candidates = pool.length ? pool : (sameLine.length ? sameLine : available);
    const player = candidates.slice().sort((a, b) => slotCandidateScore(b, slot) - slotCandidateScore(a, slot))[0];
    if (!player) continue;
    used.add(player.id);
    picked.set(slot.code, cloneForSlot(player, slot));
  }

  return slots.map((slot) => picked.get(slot.code)).filter(Boolean);
}

function teamStrength(xi) {
  if (!xi.length) return 0;
  return xi.reduce((s, p) => s + p.overall, 0) / xi.length;
}

function average(players) {
  return players.length ? players.reduce((s, p) => s + p.overall, 0) / players.length : 0;
}

function lineAverage(xi, group) {
  return average(xi.filter((p) => p.pos === group));
}

function styleFitScore(xi, formation, styleKey, opponent = null) {
  const style = TACTICAL_STYLES[normalizeStyle(styleKey)] || TACTICAL_STYLES.balanced;
  const ratings = computeTeamRatings(xi, formation);
  const chem = computeChemistry(xi, formation);
  const profile = getProfile(formation);
  const avg = teamStrength(xi);
  const stars = xi.filter((p) => p.isStar).length;
  const attackBias = ratings.attack - ratings.defense;
  const centralPlayers = xi.filter((p) => p.slotCode && CENTRAL_SLOT_RE.test(p.slotCode));
  const controlCore = average(centralPlayers) || avg;
  const defenseAvg = lineAverage(xi, 'DF') || avg;
  const midfieldAvg = lineAverage(xi, 'MF') || avg;
  const forwardAvg = lineAverage(xi, 'FW') || avg;

  let score = ((ratings.attack + ratings.defense) / 2) * chem.multiplier;
  score += chem.positionFit * 7;
  score += (avg - 74) * 0.7;
  score += stars * style.starMoment * 1.2;

  if (styleKey === 'defensive') score += Math.max(0, defenseAvg - forwardAvg) * 0.55 + Math.max(0, 74 - avg) * 0.22;
  if (styleKey === 'balanced') score += chem.chemistry * 2.5 + Math.max(0, 5 - Math.abs(attackBias)) * 0.22;
  if (styleKey === 'gegenpress') score += Math.max(0, midfieldAvg - 74) * 0.45 + Math.max(0, forwardAvg - 75) * 0.28 - Math.max(0, 75 - controlCore) * 0.5;
  if (styleKey === 'possession') score += Math.max(0, controlCore - 74) * 0.55 + chem.positionFit * 2 - Math.max(0, profile.atkShape - profile.defShape) * 0.3;
  if (styleKey === 'counter') score += Math.max(0, forwardAvg - 74) * 0.38 + Math.max(0, defenseAvg - 73) * 0.3 + Math.max(0, -attackBias) * 0.35;
  if (styleKey === 'wingplay') score += Math.max(0, profile.width - 72) * 0.09 + Math.max(0, forwardAvg - 74) * 0.25;
  if (styleKey === 'compact') score += Math.max(0, midfieldAvg - 73) * 0.42 + Math.max(0, defenseAvg - 73) * 0.35 - Math.max(0, forwardAvg - midfieldAvg) * 0.25;
  score -= Math.max(0, style.risk - 1) * Math.max(0, 74 - controlCore) * 0.85;

  if (opponent) {
    const oppStyle = normalizeStyle(opponent.tacticalStyle);
    const oppPower = computePower(opponent.xi, opponent.formation, oppStyle);
    const powerGap = score - oppPower;
    score += matchupEdge(styleKey, oppStyle) * 95;
    if (powerGap < -5 && (styleKey === 'defensive' || styleKey === 'counter' || styleKey === 'compact')) score += 4;
    if (powerGap > 5 && (styleKey === 'possession' || styleKey === 'gegenpress' || styleKey === 'balanced')) score += 3;
  }

  return score;
}

function bestBotSetup(team) {
  let best = null;
  for (const formation of Object.keys(FORMATIONS)) {
    const xi = bestXI(team, formation);
    if (xi.length !== 11) continue;
    const score = computePower(xi, formation, 'balanced') + computeChemistry(xi, formation).positionFit * 6;
    if (!best || score > best.score) best = { formation, xi, tacticalStyle: 'balanced', score };
  }
  if (best) return best;
  const xi = bestXI(team, BOT_FORMATION);
  return { formation: BOT_FORMATION, xi, tacticalStyle: 'balanced', score: computePower(xi, BOT_FORMATION, 'balanced') };
}

function prepareBotForMatch(team, opponent) {
  if (!team || team.isHuman || !team.xi || !opponent) return team;
  let bestStyle = normalizeStyle(team.tacticalStyle);
  let bestScore = styleFitScore(team.xi, team.formation, bestStyle, opponent);
  for (const style of STYLE_KEYS) {
    const score = styleFitScore(team.xi, team.formation, style, opponent);
    if (score > bestScore) {
      bestStyle = style;
      bestScore = score;
    }
  }
  team.tacticalStyle = bestStyle;
  return team;
}

module.exports = { bestXI, teamStrength, bestBotSetup, prepareBotForMatch, BOT_FORMATION };
