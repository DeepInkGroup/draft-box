const TACTICAL_STYLES = {
  defensive: {
    key: 'defensive', label: 'Defensive', attack: 0.94, defense: 1.08, possession: -4, passAccuracy: -1, foulBias: 1,
    tempo: 0.88, risk: 0.72, press: 0.72, control: 0.82, transition: 0.92, setPiece: 1.04, starMoment: 0.96,
    description: 'Deep block, lower risk, stronger defensive resistance.'
  },
  balanced: {
    key: 'balanced', label: 'Balanced', attack: 1, defense: 1, possession: 0, passAccuracy: 0, foulBias: 0,
    tempo: 1, risk: 1, press: 1, control: 1, transition: 1, setPiece: 1, starMoment: 1,
    description: 'No major weakness, adapts reasonably into any matchup.'
  },
  gegenpress: {
    key: 'gegenpress', label: 'Gegenpress', attack: 1.07, defense: 0.97, possession: 2, passAccuracy: -2, foulBias: 3,
    tempo: 1.15, risk: 1.18, press: 1.24, control: 0.92, transition: 1.1, setPiece: 0.98, starMoment: 1.08,
    description: 'High press, more shots and chaos, higher card/foul risk.'
  },
  possession: {
    key: 'possession', label: 'Possession', attack: 1.01, defense: 1.03, possession: 6, passAccuracy: 5, foulBias: -1,
    tempo: 0.94, risk: 0.84, press: 0.9, control: 1.22, transition: 0.9, setPiece: 1.02, starMoment: 1.03,
    description: 'Controls territory, improves passing and reduces volatility.'
  },
  counter: {
    key: 'counter', label: 'Counter Attack', attack: 1.06, defense: 1.01, possession: -5, passAccuracy: -2, foulBias: 0,
    tempo: 1.08, risk: 1.08, press: 0.82, control: 0.78, transition: 1.26, setPiece: 1.06, starMoment: 1.05,
    description: 'Absorbs pressure and turns transitions into high-value chances.'
  },
  wingplay: {
    key: 'wingplay', label: 'Wing Play', attack: 1.04, defense: 0.99, possession: 1, passAccuracy: -1, foulBias: 1,
    tempo: 1.07, risk: 1.07, press: 0.96, control: 0.94, transition: 1.12, setPiece: 1.14, starMoment: 1.04,
    description: 'Uses width, crossing and set pieces to create chances, with some central-control risk.'
  },
  compact: {
    key: 'compact', label: 'Compact Midfield', attack: 0.98, defense: 1.05, possession: 3, passAccuracy: 2, foulBias: -1,
    tempo: 0.9, risk: 0.78, press: 0.94, control: 1.12, transition: 0.86, setPiece: 0.98, starMoment: 0.99,
    description: 'Narrows the pitch, protects the middle and improves control, but creates fewer fast breaks.'
  }
};

const STYLE_KEYS = Object.keys(TACTICAL_STYLES);

const MATCHUP_EDGE = {
  defensive: { counter: 0.06, gegenpress: -0.03, possession: -0.04 },
  gegenpress: { possession: 0.08, counter: -0.07, defensive: 0.03 },
  possession: { defensive: 0.06, counter: -0.04, gegenpress: -0.08 },
  counter: { gegenpress: 0.08, possession: 0.05, defensive: -0.06 },
  wingplay: { defensive: 0.04, compact: 0.05, possession: -0.03, gegenpress: -0.02 },
  compact: { gegenpress: 0.05, counter: 0.04, wingplay: -0.05, possession: -0.02 },
  balanced: { defensive: 0.01, gegenpress: 0.01, possession: 0.01, counter: 0.01 }
};

function normalizeStyle(style) {
  return STYLE_KEYS.includes(style) ? style : 'balanced';
}

function randomStyle() {
  return STYLE_KEYS[Math.floor(Math.random() * STYLE_KEYS.length)];
}

function matchupEdge(ownStyle, oppStyle) {
  const own = normalizeStyle(ownStyle);
  const opp = normalizeStyle(oppStyle);
  if (own === opp) return 0;
  return (MATCHUP_EDGE[own] && MATCHUP_EDGE[own][opp]) || 0;
}

module.exports = { TACTICAL_STYLES, STYLE_KEYS, normalizeStyle, randomStyle, matchupEdge };
