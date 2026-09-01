const TACTICAL_STYLES = {
  defensive: {
    key: 'defensive', label: 'Defensive',
    attack: 0.94, defense: 1.08, possession: -4, passAccuracy: -1, foulBias: 1,
    tempo: 0.88, risk: 0.72, press: 0.72, control: 0.82, transition: 0.92, setPiece: 1.04, starMoment: 0.96,
    midfieldBias: 0.78, finishingBias: 0.94,
    widthBias: 0.82, highlineBias: 0.62, buildupBias: 0.82, setPieceBias: 1.18, physicalityBias: 1.02,
    description: 'Deep block, lower risk, stronger defensive resistance. Midfield sits deep to protect the box; rely on set pieces and rare breaks.',
    longDescription: 'Your shape drops into two solid banks, compressing vertical space. The midfield screen denies through-balls and half-spaces at the cost of forward momentum. Best used when you expect to be out-possessed: rely on your centre-backs, your goalkeeper, and clinical counter-attack quality up front.',
    strengths: ['Low-block resilience', 'Set-piece danger', 'Counter-ready shape'],
    weaknesses: ['Low shot volume', 'Vulnerable to width & circulation']
  },
  balanced: {
    key: 'balanced', label: 'Balanced',
    attack: 1, defense: 1, possession: 0, passAccuracy: 0, foulBias: 0,
    tempo: 1, risk: 1, press: 1, control: 1, transition: 1, setPiece: 1, starMoment: 1,
    midfieldBias: 1, finishingBias: 1,
    widthBias: 1, highlineBias: 1, buildupBias: 1, setPieceBias: 1, physicalityBias: 1,
    description: 'No major weakness, adapts reasonably into any matchup. The vanilla baseline.',
    longDescription: 'Evenly spread commitment between all four lines. Midfield creates at a standard rate and strikers convert at a standard rate — the middle of the road. Ideal when your raw player quality beats the opponent and you want predictable, low-volatility football without sharp counters.',
    strengths: ['No sharp counter', 'Stable chemistry', 'Predictable output'],
    weaknesses: ['No explosive upside', 'Smaller matchup edges']
  },
  gegenpress: {
    key: 'gegenpress', label: 'Gegenpress',
    attack: 1.07, defense: 0.97, possession: 2, passAccuracy: -2, foulBias: 3,
    tempo: 1.15, risk: 1.18, press: 1.24, control: 0.92, transition: 1.1, setPiece: 0.98, starMoment: 1.08,
    midfieldBias: 1.18, finishingBias: 1.06,
    widthBias: 1.08, highlineBias: 1.28, buildupBias: 1.02, setPieceBias: 0.94, physicalityBias: 1.22,
    description: 'High press, more shots and chaos, higher card/foul risk. Midfield wins the ball high, turning recoveries into instant chances.',
    longDescription: 'The moment you lose possession your whole forward six swarm the ball-carrier. Turnovers happen in the final third so your attackers get the ball already facing goal — high xG chances from nothing, but when the press is beaten, huge spaces open behind your back line.',
    strengths: ['High turnovers = high xG', 'Star players thrive', 'Late-game chaos'],
    weaknesses: ['Card & foul risk', 'Exposed on counters']
  },
  possession: {
    key: 'possession', label: 'Possession',
    attack: 1.01, defense: 1.03, possession: 6, passAccuracy: 5, foulBias: -1,
    tempo: 0.94, risk: 0.84, press: 0.9, control: 1.22, transition: 0.9, setPiece: 1.02, starMoment: 1.03,
    midfieldBias: 1.22, finishingBias: 0.92,
    widthBias: 0.96, highlineBias: 1.1, buildupBias: 1.18, setPieceBias: 1.0, physicalityBias: 0.92,
    description: 'Controls territory, improves passing and reduces volatility. Midfield is the engine; striker quality matters less because volume carries you.',
    longDescription: 'Your eight outfield players behind the ball circulate, draw the opponent out, then play through the lines. Shot volume rises, but individual chance quality drops slightly — you wear teams down over 90 minutes rather than hit them on one break.',
    strengths: ['Territory control', 'High-passing volumes', 'Low volatility'],
    weaknesses: ['Vulnerable to gegenpress', 'Low conversion ok']
  },
  counter: {
    key: 'counter', label: 'Counter Attack',
    attack: 1.06, defense: 1.01, possession: -5, passAccuracy: -2, foulBias: 0,
    tempo: 1.08, risk: 1.08, press: 0.82, control: 0.78, transition: 1.26, setPiece: 1.06, starMoment: 1.05,
    midfieldBias: 0.82, finishingBias: 1.16,
    widthBias: 1.16, highlineBias: 0.74, buildupBias: 0.78, setPieceBias: 1.06, physicalityBias: 1.02,
    description: 'Absorbs pressure and turns transitions into high-value chances. Midfield quality is sacrificed for sprint speed in the last line — finishers eat up loose balls.',
    longDescription: 'You let the opponent have the ball in non-danger zones, then explode the instant you win it. Three or four players surge forward on a vertical pass. Wingers and strikers face a disorganised defence: few-but-high-value chances, so conversion matters far more than chance creation.',
    strengths: ['High-value breaks', 'Defends deep, then pounces', 'Star strikers feast'],
    weaknesses: ['Low possession', 'Struggles vs deep blocks']
  },
  wingplay: {
    key: 'wingplay', label: 'Wing Play',
    attack: 1.04, defense: 0.99, possession: 1, passAccuracy: -1, foulBias: 1,
    tempo: 1.07, risk: 1.07, press: 0.96, control: 0.94, transition: 1.12, setPiece: 1.14, starMoment: 1.04,
    midfieldBias: 0.96, finishingBias: 1.08,
    widthBias: 1.34, highlineBias: 1.08, buildupBias: 0.96, setPieceBias: 1.24, physicalityBias: 1.06,
    description: 'Uses width, crossing and set pieces to create chances, with some central-control risk. Wide outlets overload the flanks then fire balls into the mixer.',
    longDescription: 'Full-backs push high, wingers stay wide, and the box fills with runners. Corners, crosses and second balls become your primary route to goal. The centre gets slightly underloaded, so beware teams who can trap you wide and counter the middle.',
    strengths: ['Cross & set-piece threat', 'Stretches compact defences', 'Crossing volume'],
    weaknesses: ['Central control weaker', 'Press can be overrun centrally']
  },
  compact: {
    key: 'compact', label: 'Compact Midfield',
    attack: 0.98, defense: 1.05, possession: 3, passAccuracy: 2, foulBias: -1,
    tempo: 0.9, risk: 0.78, press: 0.94, control: 1.12, transition: 0.86, setPiece: 0.98, starMoment: 0.99,
    midfieldBias: 1.14, finishingBias: 0.9,
    widthBias: 0.72, highlineBias: 0.92, buildupBias: 1.06, setPieceBias: 0.94, physicalityBias: 1.08,
    description: 'Narrows the pitch, protects the middle and improves control, but creates fewer fast breaks. The midfield five is everything.',
    longDescription: 'The midfield block stays narrow horizontally. Through-balls almost never land; opponents get funnelled wide so their crosses come from bad angles. Wingers tuck infield, full-backs hold, the pitch feels tiny. Beat you via central overloads? Almost never. Width, though, can destroy you.',
    strengths: ['Central lane lockdown', 'Second balls won', 'Hard to play through'],
    weaknesses: ['Fewer fast breaks', 'Vulnerable to width']
  },
  direct: {
    key: 'direct', label: 'Direct Play',
    attack: 1.05, defense: 1.0, possession: -6, passAccuracy: -4, foulBias: 2,
    tempo: 1.1, risk: 1.14, press: 0.86, control: 0.76, transition: 1.18, setPiece: 1.1, starMoment: 1.06,
    midfieldBias: 0.72, finishingBias: 1.24,
    widthBias: 1.04, highlineBias: 1.02, buildupBias: 0.6, setPieceBias: 1.22, physicalityBias: 1.14,
    description: 'Bypass the midfield entirely — long balls, target-man play and fast vertical runs forward. Striker quality is everything. Chance creation by midfield is intentionally low; the striker feeds on scraps and second balls but converts at a premium.',
    longDescription: 'Why build through the middle when you can go direct? Goalkeeper kicks long, centre-backs ping diagonals, wingers chase flick-ons. Your midfield sees little of the ball so raw chance creation suffers badly, but an elite finisher feeds on turnovers, flick-ons and through-balls. Ideal if your strikers are 90+ but your midfield is paper-thin.',
    strengths: ['Elite finishers overperform xG', 'Simple game plan', 'Set pieces amplify striker conversion rate', 'Big-man presence'],
    weaknesses: ['Low chance creation (midfield matters less)', 'Vulnerable on turnovers']
  },
  'tiki-taka': {
    key: 'tiki-taka', label: 'Tiki-Taka',
    attack: 1.03, defense: 1.02, possession: 9, passAccuracy: 8, foulBias: -2,
    tempo: 0.9, risk: 0.76, press: 0.94, control: 1.3, transition: 0.84, setPiece: 0.96, starMoment: 1.02,
    midfieldBias: 1.32, finishingBias: 0.88,
    widthBias: 0.88, highlineBias: 1.18, buildupBias: 1.34, setPieceBias: 0.86, physicalityBias: 0.84,
    description: 'Ultra patient short-passing circulation. The midfield generates mountains of xG by attrition but demands elite passers; finishing suffers slightly because individual chances are less dangerous.',
    longDescription: 'Every outfield player is comfortable on the ball. Triangles everywhere, 1-2 touches every pass, 500–600 completed passes per match. Midfield is EVERYTHING — pure volume wears defences down over 90 minutes so even average chances stack up. But a single 75-rated striker will seriously underperform because every single chance is half-chances rather than clear-cuts.',
    strengths: ['Dominant chance creation volume', 'Dominant passing', 'Low-attrition, high territory', 'Extreme low turnovers'],
    weaknesses: ['Poor against gegenpress', 'Finishing underperforms xG']
  }
};

const STYLE_KEYS = Object.keys(TACTICAL_STYLES);

const MATCHUP_EDGE = {
  defensive: { counter: 0.06, gegenpress: -0.03, possession: -0.04, direct: 0.07, 'tiki-taka': -0.05, wingplay: -0.05, compact: 0.02 },
  gegenpress: { possession: 0.08, counter: -0.07, defensive: 0.03, 'tiki-taka': 0.1, direct: 0.02, wingplay: 0.03, compact: -0.02 },
  possession: { defensive: 0.06, counter: -0.04, gegenpress: -0.08, wingplay: 0.05, compact: 0.03, direct: -0.02, 'tiki-taka': -0.03 },
  counter: { gegenpress: 0.08, possession: 0.05, defensive: -0.06, direct: -0.04, 'tiki-taka': 0.06, compact: 0.02, wingplay: 0.02 },
  wingplay: { defensive: 0.04, compact: 0.05, possession: -0.03, gegenpress: -0.02, 'tiki-taka': 0.04, counter: -0.02, direct: 0.03 },
  compact: { gegenpress: 0.05, counter: 0.04, wingplay: -0.05, possession: -0.02, direct: 0.06, defensive: -0.02, 'tiki-taka': 0.02 },
  balanced: { defensive: 0.01, gegenpress: 0.01, possession: 0.01, counter: 0.01, direct: 0.01, wingplay: 0.01, compact: 0.01, 'tiki-taka': 0.01 },
  direct: { defensive: -0.05, gegenpress: -0.02, possession: 0.04, counter: 0.04, compact: -0.06, wingplay: -0.03, 'tiki-taka': 0.05 },
  'tiki-taka': { defensive: 0.05, gegenpress: -0.1, possession: -0.03, counter: -0.06, wingplay: -0.04, direct: -0.05, compact: -0.02 }
};

function isCustomStyleKey(style) {
  return /^custom:\d+$/.test(String(style || ''));
}

function normalizeStyle(style) {
  if (STYLE_KEYS.includes(style)) return style;
  if (isCustomStyleKey(style)) return String(style);
  return 'balanced';
}

function baseStyleKey(style) {
  return STYLE_KEYS.includes(style) ? style : 'balanced';
}

function randomStyle() {
  return STYLE_KEYS[Math.floor(Math.random() * STYLE_KEYS.length)];
}

function matchupEdge(ownStyle, oppStyle) {
  const own = baseStyleKey(normalizeStyle(ownStyle));
  const opp = baseStyleKey(normalizeStyle(oppStyle));
  if (own === opp) return 0;
  return (MATCHUP_EDGE[own] && MATCHUP_EDGE[own][opp]) || 0;
}

const BIAS_LABELS = {
  midfieldBias: 'Creation',
  finishingBias: 'Finishing',
  widthBias: 'Width',
  highlineBias: 'Line',
  buildupBias: 'Buildup',
  setPieceBias: 'Set Piece',
  physicalityBias: 'Physical'
};

module.exports = { TACTICAL_STYLES, STYLE_KEYS, normalizeStyle, baseStyleKey, isCustomStyleKey, randomStyle, matchupEdge, BIAS_LABELS };
