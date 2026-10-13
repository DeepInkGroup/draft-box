const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
const { startLeague, simulateLeagueStep } = require('../src/game/leagueEngine');
const { transferSnapshot, planTransfer, ensureOffers, openEndSeasonTransfers } = require('../src/game/leagueTransfers');
const { randomSample } = require('../src/game/transferOffers');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');
function season(options = {}) {
  const club = getLeague('pgl').teams[0];
  const state = { mode: 'league', leagueId: 'pgl', transferEnabled: true, transferLimit: 3, ...options,
    members: new Map([[1, { userId: 1, username: 'coach', clubCode: club.code, squad: bestXI(club), formation: '4-3-3', tacticalStyle: 'balanced', tacticalStyleLocked: true }]]) };
  startLeague(state); return state;
}
test('random offers ignore ratings, stay fixed, reject unoffered players and cannot conflict', () => {
  const items = [{overall: 90}, {overall: 20}, {overall: 60}];
  assert.deepEqual(randomSample(items, 2, () => .5), [items[1], items[2]]);
  assert.equal(items.length, 3);
  for (const count of [1, 2, 3]) {
    const t = season().tournament; t.matchday = 17;
    const team = Object.values(t.slotByCode).find(team => team.userId === 1);
    const next = planTransfer(t, 1, 'release', { playerIds: team.xi.slice(0, count).map(player => player.id) });
    const snapshot = transferSnapshot(next, 1, 17);
    assert.equal(snapshot.market.length, count * 2);
    assert.equal(new Set(snapshot.market.map(player => player.id)).size, count * 2);
    assert.deepEqual(transferSnapshot(JSON.parse(JSON.stringify(next)), 1, 17).market, snapshot.market);
    const picks = snapshot.vacancies.map(slot => {
      const offers = snapshot.market.filter(player => player.eligibleSlots.includes(slot.code));
      assert.equal(offers.length, 2);
      return {slotCode: slot.code, playerId: offers[1].id};
    });
    const foreign = getLeague('pgl').teams.flatMap(club => club.players).find(player => !snapshot.market.some(offer => offer.id === player.id));
    assert.throws(() => planTransfer(next, 1, 'sign', {picks: [{...picks[0], playerId: foreign.id}, ...picks.slice(1)]}), /available league player/);
    assert.equal(transferSnapshot(planTransfer(next, 1, 'sign', {picks}), 1, 17).squad.length, 11);
    const progress = next.transferWindow.users[1];
    delete progress.offers; ensureOffers(next, progress, () => 0); const first = JSON.stringify(progress.offers);
    delete progress.offers; ensureOffers(next, progress, () => .999);
    assert.notEqual(JSON.stringify(progress.offers), first);
  }
});
test('end-season settings are independent, block play and apply chemistry to the new season', () => {
  for (const maxChanges of [1, 2, 3]) {
    const state = season({transferEnabled: false, endTransferEnabled: true, endTransferLimit: maxChanges, endAiTransfers: true});
    const t = state.tournament;
    // Initial seasons have no prior season to transfer after.
    assert.equal(transferSnapshot(t, 1, 0).phase, 'disabled');
    openEndSeasonTransfers(t);
    const release = transferSnapshot(t, 1, 0);
    assert.equal(release.windowType, 'endseason'); assert.equal(release.maxChanges, maxChanges);
    assert.ok(release.log.length > 0); assert.ok(release.log.every(entry => entry.windowType === 'endseason'));
    assert.throws(() => simulateLeagueStep(state, () => {}), /end-of-season/);
    const log = JSON.stringify(t.transferLog); openEndSeasonTransfers(t); assert.equal(JSON.stringify(t.transferLog), log);
    const next = planTransfer(t, 1, 'release', {playerIds: release.squad.slice(0, maxChanges).map(player => player.id)});
    const signing = transferSnapshot(next, 1, 0);
    const picks = signing.vacancies.map(slot => ({slotCode: slot.code, playerId: signing.market.find(player => player.eligibleSlots.includes(slot.code)).id}));
    state.tournament = planTransfer(next, 1, 'sign', {picks});
    assert.equal(transferSnapshot(state.tournament, 1, 0).cohesion.penaltyPercent, maxChanges * 1.5);
    for (let day = 1; day <= 4; day++) simulateLeagueStep(state, () => {});
    assert.equal(transferSnapshot(state.tournament, 1, 4).cohesion.penaltyPercent, 0);
    assert.equal(transferSnapshot(state.tournament, 1, 4).phase, 'disabled');
    // A later XI must not appear when browsing the beginning of the season.
    const human = Object.values(state.tournament.slotByCode).find(team => team.userId === 1);
    state.members.get(1).viewedStep = 0;
    const initialIds = state.tournament.initialXIs[human.code].map(player => player.id).sort();
    human.xi[0] = {...human.xi[0], id: 'future-signing'};
    assert.deepEqual(clubSquadSnapshot(state, 1, human.code).players.filter(player => player.status === 'Starting XI').map(player => player.id).sort(), initialIds);
  }
  for (const options of [{endTransferEnabled:false}, {endTransferEnabled:true,endTransferLimit:0}]) {
    const t = season(options).tournament;openEndSeasonTransfers(t);assert.equal(t.endTransferWindow, undefined);
  }
});
