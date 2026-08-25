const TACTICAL_STYLES = {
  defensive: {
    key: 'defensive', label: 'Defensive', attack: 0.94, defense: 1.08, possession: -4, passAccuracy: -1, foulBias: 1,
    description: 'Deep block, lower risk, stronger defensive resistance.'
  },
  balanced: {
    key: 'balanced', label: 'Balanced', attack: 1, defense: 1, possession: 0, passAccuracy: 0, foulBias: 0,
    description: 'No major weakness, adapts reasonably into any matchup.'
  },
  gegenpress: {
    key: 'gegenpress', label: 'Gegenpress', attack: 1.07, defense: 0.97, possession: 2, passAccuracy: -2, foulBias: 3,
    description: 'High press, more shots and chaos, higher card/foul risk.'
  },
  possession: {
    key: 'possession', label: 'Possession', attack: 1.01, defense: 1.03, possession: 6, passAccuracy: 5, foulBias: -1,
    description: 'Controls territory, improves passing and reduces volatility.'
  },
  counter: {
    key: 'counter', label: 'Counter Attack', attack: 1.06, defense: 1.01, possession: -5, passAccuracy: -2, foulBias: 0,
    description: 'Absorbs pressure and turns transitions into high-value chances.'
  }
};

const STYLE_KEYS = Object.keys(TACTICAL_STYLES);

const MATCHUP_EDGE = {
  defensive: { counter: 0.06, gegenpress: -0.03, possession: -0.04 },
  gegenpress: { possession: 0.08, counter: -0.07, defensive: 0.03 },
  possession: { defensive: 0.06, counter: -0.04, gegenpress: -0.08 },
  counter: { gegenpress: 0.08, possession: 0.05, defensive: -0.06 },
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
