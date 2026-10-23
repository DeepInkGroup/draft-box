const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
const { startLeague, leagueSnapshot } = require('../src/game/leagueEngine');
const { reviewAiCoaches, coachSnapshot } = require('../src/game/leagueCoaches');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');
const { cohesionSnapshot, startCohesionRecovery } = require('../src/game/leagueCohesion');

function season() {
  const club = getLeague('pgl').teams.at(-1);
  const state = { mode: 'league', leagueId: 'pgl', members: new Map([[1, { userId: 1, username: 'coach', clubCode: club.code,
    squad: bestXI(club), formation: '4-3-3', tacticalStyle: 'balanced', tacticalStyleLocked: true, viewedStep: 17 }]]) };
  startLeague(state); return state;
}
function table(t) {
  return Object.keys(t.slotByCode).map((code, i) => ({ code, rank: i + 1, played: t.matchday, pts: i >= 12 ? 8 : 40 }));
}

test('poor AI clubs appoint distinct free-agent coaches at scheduled reviews while humans and successful clubs stay protected', () => {
  const { tournament: t } = season(), before = structuredClone(t.slotByCode);
  const freeIds = new Set(t.freeAgentCoaches.map(coach => coach.id));
  t.matchday = 16; reviewAiCoaches(t, table(t), () => 0); assert.equal(t.coachChanges.length, 0);
  t.matchday = 17; reviewAiCoaches(t, table(t), () => 0); assert.equal(t.coachChanges.length, 2);
  for (const change of t.coachChanges) {
    assert.ok(change.rank > 12); assert.ok(freeIds.has(change.to.id));
    assert.equal(t.slotByCode[change.clubCode].isHuman, false);
    assert.equal(t.slotByCode[change.clubCode].headCoach.id, change.to.id);
    assert.ok(!t.freeAgentCoaches.some(coach => coach.id === change.to.id));
    assert.ok(t.freeAgentCoaches.some(coach => coach.id === change.from.id));
    assert.deepEqual(t.slotByCode[change.clubCode].xi, before[change.clubCode].xi);
  }
  for (const team of Object.values(t.slotByCode).filter(team => team.isHuman)) assert.deepEqual(team.headCoach, before[team.code].headCoach);
  const saved = JSON.stringify(t); reviewAiCoaches(t, table(t), () => .9); assert.equal(JSON.stringify(t), saved);
  t.matchday = 34; reviewAiCoaches(t, table(t), () => 0); assert.equal(t.coachChanges.length, 4);
  assert.equal(new Set(t.coachChanges.map(change => change.clubCode)).size, 4);
  const employed = Object.values(t.slotByCode).map(team => team.headCoach.id);
  assert.equal(new Set(employed).size, employed.length);
  assert.ok(t.freeAgentCoaches.every(coach => !employed.includes(coach.id)));
});

test('coaching history, club profiles and the free-agent market respect saved viewing progress', () => {
  const state = season(), t = state.tournament;
  t.matchday = 17; reviewAiCoaches(t, table(t), () => 0);
  const at17 = coachSnapshot(t, 17), replaced = t.coachChanges[0];
  t.matchday = 34; reviewAiCoaches(t, table(t), () => 0);
  assert.deepEqual(coachSnapshot(JSON.parse(JSON.stringify(t)), 17), at17);
  assert.equal(coachSnapshot(t, 16).coachChanges.length, 0);
  assert.deepEqual(coachSnapshot(t, 16).headCoaches[replaced.clubCode], replaced.from);
  assert.equal(leagueSnapshot(t, 17).coachChanges.length, 2);
  state.members.get(1).viewedStep = 16;
  assert.deepEqual(clubSquadSnapshot(state, 1, replaced.clubCode).headCoach, replaced.from);
  state.members.get(1).viewedStep = 17;
  assert.deepEqual(clubSquadSnapshot(state, 1, replaced.clubCode).headCoach, replaced.to);
  const hydrated = JSON.parse(JSON.stringify(t)); reviewAiCoaches(hydrated, table(hydrated), () => .9);
  assert.deepEqual(hydrated, JSON.parse(JSON.stringify(t)));
});

test('AI clubs meeting the points threshold keep their coach even in the bottom third', () => {
  const { tournament: t } = season(); t.matchday = 17;
  reviewAiCoaches(t, table(t).map(row => ({ ...row, pts: row.played * 2 })), () => 0);
  assert.equal(t.coachChanges.length, 0);
});

test('only mid-season roster changes reduce chemistry, including when loading older end-season saves', () => {
  const team = {};
  startCohesionRecovery(team, 3, 17); assert.equal(cohesionSnapshot(team).penaltyPercent, 4.5);
  startCohesionRecovery(team, 3, 0); assert.equal(cohesionSnapshot(team).penaltyPercent, 0);
  team.rosterCohesion = { changedPlayers: 3, matchesPlayed: 0, changedAfterMatchday: 0 };
  assert.equal(cohesionSnapshot(team).multiplier, 1);
});
