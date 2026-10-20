const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
const { startLeague, rankTable, leagueSnapshot } = require('../src/game/leagueEngine');
const { simulateNextStep, decorateStep } = require('../src/game/tournamentEngine');
const { seedLeagueCup, simulateCupStep, cupSnapshot, leagueStageAtCursor } = require('../src/game/leagueCup');
const { playAutomaticLeague, leagueScoreResults } = require('../src/game/leagueAutoplay');
const { seasonResults } = require('../src/game/leagueResults');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');

function season(options = {}) {
  const clubs = getLeague('pgl').teams;
  const members = new Map(clubs.slice(0, 2).map((club, i) => [i + 1, {
    userId: i + 1, username: 'manager' + i, clubCode: club.code, squad: bestXI(club),
    formation: '4-3-3', tacticalStyle: 'balanced', tacticalStyleLocked: true, viewedStep: 0
  }]));
  const state = { mode: 'league', leagueId: 'pgl', knockoutCup: true, resultsOnly: true, transferEnabled: false, ...options, members };
  startLeague(state); return state;
}
function regularSeason(state) { for (let day = 0; day < 34; day++) simulateNextStep(state); return state.tournament; }

test('cup qualifies exactly the top sixteen after all league fixtures, with a saved random draw', () => {
  const state = season(), t = state.tournament;
  for (let day = 0; day < 33; day++) simulateNextStep(state);
  assert.equal(t.cup, undefined); assert.equal(cupSnapshot(t, 33).phase, 'pending');
  const last = simulateNextStep(state), table = rankTable(t);
  assert.equal(last.champion, true); assert.equal(last.competitionFinished, false);
  assert.equal(t.matchLog.length, 306); assert.equal(t.stage, 'cup_r16');
  assert.deepEqual(t.cup.qualifiers, table.slice(0, 16).map(row => row.code));
  assert.deepEqual([...t.cup.draw].sort(), [...t.cup.qualifiers].sort());
  assert.equal(new Set(t.cup.draw).size, 16); assert.equal(t.cup.rounds[0].fixtures.length, 8);
  for (const row of table) assert.equal(t.slotByCode[row.code].eliminated, row.rank > 16);
  const saved = JSON.stringify(t.cup); seedLeagueCup(state, table, () => 0); assert.equal(JSON.stringify(t.cup), saved);
  const cloned = structuredClone(state); delete cloned.tournament.cup;
  seedLeagueCup(cloned, table, () => 0);
  assert.notDeepEqual(cloned.tournament.cup.draw, t.cup.qualifiers, 'Draw shuffles the ranked qualifiers');
  assert.deepEqual(JSON.parse(JSON.stringify(t)).cup, t.cup);
});

test('single elimination advances 8, 4, 2 and 1 winners, preserving the league title and standings', () => {
  const state = season(), t = regularSeason(state), leagueTitle = t.champion;
  const finalTable = JSON.stringify(rankTable(t)), regularAwards = seasonResults(t);
  let entrants = t.cup.draw;
  for (const [index, count] of [8, 4, 2, 1].entries()) {
    const step = simulateNextStep(state), winners = step.matches.map(match => match.winnerCode);
    assert.equal(step.matches.length, count); assert.equal(step.cup, true);
    assert.deepEqual(step.matches.flatMap(match => [match.aCode, match.bCode]), entrants);
    assert.equal(new Set(winners).size, count);
    for (const match of step.matches) {
      assert.ok([match.aCode, match.bCode].includes(match.winnerCode));
      if (match.goalsA === match.goalsB) { assert.equal(match.wentToPenalties, true); assert.ok(['A', 'B'].includes(match.penaltyWinner)); }
      assert.equal(t.slotByCode[match.winnerCode].eliminated, false);
      assert.equal(t.slotByCode[match.winnerCode === match.aCode ? match.bCode : match.aCode].eliminated, true);
    }
    assert.equal(step.competitionFinished, index === 3); entrants = winners;
  }
  assert.equal(t.cup.champion, entrants[0]); assert.equal(t.stage, 'done'); assert.equal(t.champion, leagueTitle);
  assert.equal(t.matchday, 34); assert.equal(t.history.length, 38); assert.equal(t.matchLog.length, 321);
  assert.equal(JSON.stringify(rankTable(t)), finalTable); assert.deepEqual(seasonResults(t), regularAwards);
  const final = decorateStep(state, 37, 1);
  assert.equal(final.cupChampion.code, t.cup.champion); assert.equal(final.champion.code, leagueTitle);
  assert.equal(final.seasonResults.matches, 306); assert.equal(simulateNextStep(state), null);
  for (const cursor of [34, 38]) {
    state.members.get(1).viewedStep = cursor;
    const squad = clubSquadSnapshot(state, 1, t.cup.champion);
    assert.equal(squad.cupRounds, cursor - 34);
    assert.equal(squad.players.reduce((sum, player) => sum + player.stats.appearances, 0), cursor * 11);
  }
});

test('penalties resolve drawn cup ties and behind members cannot see future bracket winners', () => {
  const state = season(), t = regularSeason(state);
  const penalties = () => ({ goalsA: 1, goalsB: 1, wentToExtraTime: true, wentToPenalties: true, penaltyWinner: 'B', penalties: { A: 3, B: 4 }, events: [] });
  for (let round = 0; round < 4; round++) {
    const step = simulateCupStep(state, penalties);
    assert.ok(step.matches.every(match => match.winnerCode === match.bCode));
  }
  const reloaded = JSON.parse(JSON.stringify(t));
  const unseen = cupSnapshot(reloaded, 33); assert.equal(unseen.qualifiers, undefined); assert.equal(unseen.champion, undefined);
  for (let cursor = 34; cursor <= 38; cursor++) {
    const cup = cupSnapshot(reloaded, cursor);
    assert.equal(cup.completedRounds, cursor - 34);
    assert.equal(leagueSnapshot(reloaded, cursor).matchday, 34);
    for (const [index, round] of cup.rounds.entries()) {
      if (index > cursor - 34) assert.deepEqual(round.matches, []);
      else for (const match of round.matches) assert.equal('winnerCode' in match, index < cursor - 34);
    }
    assert.equal(!!cup.champion, cursor === 38);
    assert.equal(leagueStageAtCursor(reloaded, cursor), ['cup_r16', 'cup_qf', 'cup_sf', 'cup_final', 'done'][cursor - 34]);
  }
  assert.equal(cupSnapshot(reloaded, 35).rounds[0].matches[0].penalties.B, 4);
  const record = decorateStep(state, 33, 1).myRecord;
  assert.equal(record.w + record.d + record.l, 34);
});

test('automatic multiplayer results show all four cup rounds once per member, including eliminated spectators', () => {
  const state = season();
  for (let cursor = 0; cursor < 38; cursor++) {
    assert.equal(playAutomaticLeague(state, 1, () => simulateNextStep(state), cursor), 1);
    assert.equal(state.members.get(1).viewedStep, cursor + 1);
  }
  const t = state.tournament, saved = JSON.stringify(t);
  for (let cursor = 0; cursor < 38; cursor++) {
    playAutomaticLeague(state, 2, () => { throw Error('Must only replay the saved round'); }, cursor);
    assert.equal(state.members.get(2).viewedStep, cursor + 1);
  }
  playAutomaticLeague(state, 2, () => { throw Error('Already finished'); }, 34);
  assert.equal(JSON.stringify(t), saved); assert.equal(state.members.get(2).viewedStep, 38);
  const scores = leagueScoreResults(t, 38);
  assert.deepEqual(scores.slice(34).map(round => round.matches.length), [8, 4, 2, 1]);
  assert.ok(scores.slice(34).every(round => round.cup && round.label.includes('PGL Knockout Cup')));
  assert.ok(scores.flatMap(round => round.matches).every(match => !('events' in match) && !('lineups' in match)));
  const disabled = season({ knockoutCup: false }); regularSeason(disabled);
  assert.equal(disabled.tournament.stage, 'done'); assert.equal(disabled.tournament.history.length, 34);
  assert.equal(cupSnapshot(disabled.tournament, 34), null);
});
