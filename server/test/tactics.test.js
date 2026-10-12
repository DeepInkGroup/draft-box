const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TACTICAL_STYLES, tacticalCatalog, matchupEdge, normalizeStyle } = require('../src/game/tacticalStyles');
const { getStyleSynergy } = require('../src/game/formations');
const { bestXI, prepareBotForMatch } = require('../src/game/botEngine');
const { simulateMatch } = require('../src/game/matchSim');
const { getLeague } = require('../src/data/competitions');

test('tactic cards use engine modifiers and the same stable formation fit as matches', () => {
  const styles = tacticalCatalog();
  assert.equal(styles.length, 12);
  for (const style of styles) {
    assert.equal(style.mods.ATT, TACTICAL_STYLES[style.key].attack);
    assert.equal(style.mods.RISK, TACTICAL_STYLES[style.key].risk);
    assert.ok(style.strengths.length && style.weaknesses.length);
    for (const formation of style.synergyBest) assert.equal(getStyleSynergy(formation, style.key).match, 'great');
    for (const formation of style.synergyWorst) assert.equal(getStyleSynergy(formation, style.key).match, 'poor');
  }
  assert.deepEqual(getStyleSynergy('4-3-3', 'vertical'), getStyleSynergy('4-3-3', 'vertical'));
  assert.equal(getStyleSynergy('5-4-1', 'catenaccio').match, 'great');
  assert.equal(getStyleSynergy('3-5-2', 'overlap').match, 'poor');
});

test('all three new tactics affect simulated matches and have balanced matchup directions', () => {
  const club = getLeague('pgl').teams[0];
  const opponent = { xi: bestXI(getLeague('pgl').teams[1]), formation: '4-3-3', tacticalStyle: 'balanced', isHuman: false };
  for (const key of ['vertical', 'overlap', 'catenaccio']) {
    const team = { xi: bestXI(club), formation: '4-3-3', tacticalStyle: key, isHuman: true };
    assert.equal(normalizeStyle(key), key);
    const result = simulateMatch(team, opponent, { stage: 'league', knockout: false });
    assert.equal(result.tactical.A.key, key);
    assert.equal(result.tactical.A.mods.attack, TACTICAL_STYLES[key].attack);
    assert.ok(Number.isFinite(result.xgA) && Number.isFinite(result.xgB));
    for (const other of Object.keys(TACTICAL_STYLES)) {
      assert.equal(matchupEdge(key, other) + matchupEdge(other, key), 0);
    }
    const bot = { ...team, isHuman: false };
    prepareBotForMatch(bot, opponent);
    assert.ok(TACTICAL_STYLES[bot.tacticalStyle]);
  }
});
