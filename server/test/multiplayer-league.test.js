const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
const { startLeague, simulateLeagueStep } = require('../src/game/leagueEngine');
const { planTransfer, transferSnapshot, transfersPending } = require('../src/game/leagueTransfers');

function season(count = 2) {
  const clubs = getLeague('pgl').teams.slice(0, count);
  const state = { mode: 'league', leagueId: 'pgl', singlePlayer: false, transferEnabled: true, transferLimit: 3,
    members: new Map(clubs.map((club, i) => [i + 1, { userId: i + 1, username: 'coach' + i, clubCode: club.code,
      squad: bestXI(club, '4-3-3'), formation: '4-3-3', tacticalStyle: 'balanced', tacticalStyleLocked: true }])) };
  startLeague(state); state.tournament.matchday = 17; return state;
}
test('multiplayer league assigns distinct human clubs and fills the remaining field with bots', () => {
  const state = season();
  assert.equal(Object.values(state.tournament.slotByCode).filter(team => team.isHuman).length, 2);
  assert.equal(Object.values(state.tournament.slotByCode).filter(team => !team.isHuman).length, 16);
  assert.equal(state.tournament.fixtures.length, 34);
  state.members.get(2).clubCode = state.members.get(1).clubCode;
  assert.throws(() => startLeague(state), /different league club/);
});
test('concurrent player transfers reserve disjoint offers, survive reloads and block the league until everyone finishes', () => {
  const state = season(3);
  const originals = Object.fromEntries(Object.values(state.tournament.slotByCode).filter(team => team.isHuman).map(team => [team.userId, team.xi]));
  for (const id of [1, 2]) state.tournament = planTransfer(state.tournament, id, 'release', { playerIds: originals[id].slice(0, 3).map(player => player.id) });
  const offers = [1, 2].map(id => transferSnapshot(state.tournament, id, 17));
  assert.equal(new Set(offers.flatMap(snapshot => snapshot.market.map(player => player.id))).size, 12);
  const usedHumanPlayers = new Set(Object.values(originals).flat().map(player => player.id));
  assert.ok(offers.every(snapshot => snapshot.market.every(player => !usedHumanPlayers.has(player.id))));
  const reloaded = JSON.parse(JSON.stringify(state.tournament));
  assert.deepEqual(transferSnapshot(reloaded, 2, 17).market, offers[1].market);
  assert.throws(() => simulateLeagueStep(state, () => {}), /complete or skip/);
  for (const id of [1, 2]) {
    const snapshot = transferSnapshot(state.tournament, id, 17);
    const picks = snapshot.vacancies.map(slot => ({ slotCode: slot.code, playerId: snapshot.market.find(player => player.eligibleSlots.includes(slot.code)).id }));
    state.tournament = planTransfer(state.tournament, id, 'sign', { picks });
    assert.equal(Object.values(state.tournament.slotByCode).find(team => team.userId === id).xi.length, 11);
    assert.equal(transfersPending(state.tournament), true);
  }
  assert.deepEqual(transferSnapshot(state.tournament, 1, 17).waitingFor.map(player => player.userId), [3]);
  assert.deepEqual(transferSnapshot(state.tournament, 1, 16).waitingFor, []);
  state.tournament = planTransfer(state.tournament, 3, 'skip');
  assert.equal(transfersPending(state.tournament), false);
  assert.deepEqual(transferSnapshot(state.tournament, 1, 17).waitingFor, []);
  assert.equal(simulateLeagueStep(state, () => {}).matchday, 18);
});
