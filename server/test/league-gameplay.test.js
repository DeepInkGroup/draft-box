const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getSlots, FORMATIONS } = require('../src/game/formations');
const { leagueTeamModel, roleFit, leagueDismissalImpact } = require('../src/game/leagueMatchModel');
const { simulateMatch } = require('../src/game/matchSim');
const { prepareBotForMatch, prepareLeagueFixture } = require('../src/game/botEngine');
const { reassignXI } = require('../src/game/leagueFormation');
const { analyzeMatch } = require('../src/game/matchAnalysis');

function team(name, overall = 70) {
  return { code: name, name, formation: '4-3-3', tacticalStyle: 'balanced', isHuman: false, morale: 0,
    xi: getSlots('4-3-3').map((slot, index) => ({ id: name + index, name: name + ' ' + slot.code,
      team: name, pos: slot.group, rawPos: slot.short, overall, slotCode: slot.code, isStar: false })) };
}
function seeded(seed, run) {
  const original = Math.random;
  Math.random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  try { return run(); } finally { Math.random = original; }
}
const play = (a, b, seed, options = {}) => seeded(seed, () => simulateMatch(a, b, { stage: 'league', ...options }));

test('league teams use identical rules for human and AI managers without mutating their players', () => {
  const a = team('A'), b = team('B'), saved = JSON.stringify([a, b]);
  for (let seed = 1; seed <= 30; seed++) {
    const ai = play(a, b, seed), human = play({ ...a, isHuman: true }, b, seed);
    for (const field of ['goalsA', 'goalsB', 'xgA', 'xgB', 'stats', 'events', 'chemistry', 'finishing', 'leagueGameplay']) assert.deepEqual(human[field], ai[field]);
    assert.equal(human.engineSignal.qualityTacticalMultiplier, ai.engineSignal.qualityTacticalMultiplier);
  }
  assert.equal(JSON.stringify([a, b]), saved);
});

test('home advantage belongs to the home fixture and cup ties remain neutral', () => {
  const a = team('A'), b = team('B');
  for (let seed = 1; seed <= 20; seed++) {
    const neutral = play(a, b, seed), home = play(a, b, seed, { homeSide: 'A' }), away = play(a, b, seed, { homeSide: 'B' });
    assert.ok(home.xgA > neutral.xgA); assert.equal(home.xgB, neutral.xgB);
    assert.ok(away.xgB > neutral.xgB); assert.equal(away.xgA, neutral.xgA);
    const cup = play(a, b, seed, { stage: 'final', knockout: true, competition: 'league', homeSide: 'A' });
    assert.equal(cup.leagueGameplay.homeSide, null);
    assert.deepEqual(cup, play(a, b, seed, { stage: 'final', knockout: true, competition: 'league' }));
    if (cup.wentToExtraTime) {
      assert.ok(cup.xgA > cup.leagueGameplay.regulationXg.A); assert.ok(cup.xgB > cup.leagueGameplay.regulationXg.B);
    }
    if (cup.goalsA === cup.goalsB) assert.ok(cup.wentToPenalties && ['A', 'B'].includes(cup.penaltyWinner));
  }
});

test('keepers, defenders, midfielders and forwards influence their actual jobs, and role cover stays playable', () => {
  const base = team('A'), original = leagueTeamModel(base);
  const improved = group => leagueTeamModel({ ...base, xi: base.xi.map(player => ({ ...player, overall: player.pos === group ? 85 : player.overall })) });
  const keeper = improved('GK'), midfield = improved('MF'), forwards = improved('FW'), defense = improved('DF');
  assert.equal(keeper.ratings.attack, original.ratings.attack); assert.equal(keeper.ratings.control, original.ratings.control);
  assert.ok(keeper.ratings.defense > original.ratings.defense);
  assert.ok(midfield.ratings.control > forwards.ratings.control && midfield.ratings.control > defense.ratings.control);
  assert.ok(forwards.ratings.attack > midfield.ratings.attack && defense.ratings.defense > midfield.ratings.defense);
  const forward = base.xi.find(player => player.pos === 'FW'), back = getSlots(base.formation).find(slot => slot.group === 'DF');
  assert.ok(roleFit(forward, back) < 1);
  for (const formation of Object.keys(FORMATIONS)) {
    const xi = reassignXI(base.xi, base.formation, formation), model = leagueTeamModel({ ...base, formation, xi });
    assert.equal(model.team.xi.length, 11); assert.ok(Number.isFinite(model.ratings.attack));
    assert.ok(model.team.xi.every(player => Number.isFinite(player.overall) && player.overall > 0));
  }
  const captain = { ...base, xi: base.xi.map((player, index) => ({ ...player, overall: 101, isCaptain: index === 0 })) };
  assert.ok(leagueTeamModel(captain).team.xi.every(player => player.overall >= 101), 'Captain selection must never lower a boosted rating');
});

test('seeded league balance rewards stronger squads while allowing draws and upsets with sensible scoring roles', () => {
  const strong = team('Strong', 75), weak = team('Weak', 65), equal = team('Equal', 70), other = team('Other', 70);
  const totals = seeded(8182, () => {
    const result = { wins: 0, upsets: 0, draws: 0, goals: 0, equalWins: 0, equalLosses: 0, forwardGoals: 0, defenderGoals: 0, midfieldAssists: 0, defenderAssists: 0 };
    for (let index = 0; index < 1400; index++) {
      const unequal = simulateMatch(strong, weak, { stage: 'league' });
      result.wins += unequal.goalsA > unequal.goalsB; result.upsets += unequal.goalsA < unequal.goalsB;
      const match = simulateMatch(equal, other, { stage: 'league' });
      result.draws += match.goalsA === match.goalsB; result.equalWins += match.goalsA > match.goalsB; result.equalLosses += match.goalsA < match.goalsB;
      result.goals += match.goalsA + match.goalsB;
      for (const goal of match.events.filter(event => event.type === 'goal' && event.side === 'A')) {
        const scorer = equal.xi.find(player => player.name === goal.player), creator = equal.xi.find(player => player.name === goal.assistBy);
        assert.notEqual(scorer.pos, 'GK');
        result.forwardGoals += scorer.pos === 'FW'; result.defenderGoals += scorer.pos === 'DF';
        result.midfieldAssists += creator?.pos === 'MF'; result.defenderAssists += creator?.pos === 'DF';
      }
    }
    return result;
  });
  assert.ok(totals.wins / 1400 > .5 && totals.wins / 1400 < .9, JSON.stringify(totals));
  assert.ok(totals.upsets > 40, JSON.stringify(totals)); assert.ok(totals.draws / 1400 > .15 && totals.draws / 1400 < .38);
  assert.ok(totals.goals / 1400 > 1.8 && totals.goals / 1400 < 3.3);
  assert.ok(Math.abs(totals.equalWins - totals.equalLosses) / 1400 < .08);
  assert.ok(totals.forwardGoals > totals.defenderGoals * 2 && totals.midfieldAssists > totals.defenderAssists);
});

test('sending-off impact follows remaining match time and dismissed players cannot score or assist later', () => {
  assert.ok(leagueDismissalImpact(5).attack > leagueDismissalImpact(85).attack * 10);
  assert.equal(leagueDismissalImpact(90).attack, 0);
  const a = team('A'), b = team('B'); let dismissals = 0;
  for (let seed = 1; seed < 150; seed++) {
    const match = play(a, b, seed);
    for (const red of match.events.filter(event => event.type === 'red')) {
      dismissals++;
      assert.ok(!match.events.some(event => event.type === 'goal' && event.side === red.side && event.minute >= red.minute && (event.player === red.player || event.assistBy === red.player)));
    }
  }
  assert.ok(dismissals > 0);
});

test('league scorelines, shots, goalkeeper saves and player events agree through normal and extra time', () => {
  const a = team('A'), b = team('B'); let extraTimeMatches = 0;
  for (let seed = 1; seed <= 100; seed++) for (const cup of [false, true]) {
    const match = play(a, b, seed, cup ? { stage: 'final', knockout: true, competition: 'league' } : {});
    extraTimeMatches += match.wentToExtraTime;
    for (const side of ['A', 'B']) {
      const opponent = side === 'A' ? 'B' : 'A', goals = match['goals' + side];
      assert.ok(match.stats[side].shots >= match.stats[side].shotsOnTarget && match.stats[side].shotsOnTarget >= goals);
      assert.equal(match.stats[opponent].saves, match.stats[side].shotsOnTarget - goals);
      assert.equal(match.events.filter(event => event.type === 'goal' && event.side === side).length, goals);
      assert.equal(match.events.filter(event => event.type === 'save' && event.side === side).length, match.stats[side].saves);
      assert.ok(match.events.every(event => event.minute >= 1 && event.minute <= (match.wentToExtraTime ? 120 : 90)));
    }
  }
  assert.ok(extraTimeMatches > 0);
});

test('AI plans are prepared simultaneously and match reports explain league roles and venue', () => {
  const a = team('A'), b = { ...team('B'), tacticalStyle: 'counter' }, expectedA = structuredClone(a), expectedB = structuredClone(b);
  prepareBotForMatch(expectedA, b); prepareBotForMatch(expectedB, a); prepareLeagueFixture(a, b);
  assert.equal(a.tacticalStyle, expectedA.tacticalStyle); assert.equal(b.tacticalStyle, expectedB.tacticalStyle);
  const match = play(a, b, 22, { homeSide: 'A' }), analysis = analyzeMatch(match, 'A', 'A', 'B');
  assert.ok(analysis.factors.some(factor => factor.label === 'League Venue' && factor.value === 'Home'));
  assert.ok(analysis.factors.some(factor => factor.label === 'Player Roles'));
  assert.ok(analysis.factors.some(factor => factor.label === 'Midfield Quality'));
});
