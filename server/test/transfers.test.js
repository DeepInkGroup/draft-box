const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startLeague } = require('../src/game/leagueEngine');
const { bestXI } = require('../src/game/botEngine');
const { getLeague } = require('../src/data/competitions');
const { planTransfer, transferSnapshot, transfersPending, statsByPlayer } = require('../src/game/leagueTransfers');

function season() {
  const club = getLeague('pgl').teams[0];
  const squad = bestXI(club, '4-3-3');
  const state = { mode: 'league', leagueId: 'pgl', members: new Map([[1, { userId: 1, username: 'coach', clubCode: club.code, squad, formation: '4-3-3', tacticalStyleLocked: true, tacticalStyle: 'balanced', captainSlot: 'GK' }]]) };
  return startLeague(state);
}

test('transfer validation keeps an XI unchanged until two players leave, and requires two valid replacements', () => {
  const t = season();
  assert.throws(() => planTransfer(t, 1, 'release', { playerIds: [] }), /not open/);
  t.matchday = 17;
  const team = Object.values(t.slotByCode).find((slot) => slot.userId === 1);
  const ids = [team.xi[0].id, team.xi[1].id];
  assert.equal(transferSnapshot(t, 1, 17).phase, 'release');
  assert.equal(transfersPending(t), true);
  assert.throws(() => planTransfer(t, 1, 'release', { playerIds: [ids[0]] }), /exactly two/);
  assert.throws(() => planTransfer(t, 1, 'release', { playerIds: [ids[0], 'foreign-player'] }), /your XI/);
  const next = planTransfer(t, 1, 'release', { playerIds: ids });
  assert.equal(team.xi.length, 11);
  const signing = transferSnapshot(next, 1, 17);
  assert.equal(signing.squad.length, 9);
  assert.equal(signing.market.some((player) => ids.includes(player.id)), false);
  const used = new Set();
  const picks = signing.vacancies.map((slot) => {
    const player = signing.market.find((entry) => entry.eligibleSlots.includes(slot.code) && !used.has(entry.id));
    used.add(player.id);
    return { playerId: player.id, slotCode: slot.code };
  });
  const wrongRole = signing.market.find((player) => !player.eligibleSlots.includes(picks[0].slotCode) && player.id !== picks[1].playerId);
  assert.throws(() => planTransfer(next, 1, 'sign', { picks: [{ ...picks[0], playerId: wrongRole.id }, picks[1]] }), /fits each/);
  assert.throws(() => planTransfer(next, 1, 'skip'), /vacant positions/);
  const complete = planTransfer(next, 1, 'sign', { picks });
  const summary = transferSnapshot(complete, 1, 17);
  assert.equal(summary.phase, 'complete');
  assert.equal(summary.squad.length, 11);
  assert.equal(summary.squad.filter((player) => player.isCaptain).length, 1);
  assert.equal(summary.squad.find((player) => player.isCaptain).slotCode, 'GK');
  assert.equal(transfersPending(complete), false);
  assert.throws(() => planTransfer(complete, 1, 'release', { playerIds: ids }), /not open/);
  assert.equal(planTransfer(t, 1, 'skip').transferWindow.users[1].phase, 'skipped');
});

test('player statistics use saved match lineups after players leave the team', () => {
  const t = season();
  const [a, b] = Object.keys(t.slotByCode);
  const player = t.slotByCode[a].xi[0];
  t.matchLog.push({ aCode: a, bCode: b, lineups: { A: t.slotByCode[a].xi.map((entry) => ({ ...entry })), B: t.slotByCode[b].xi }, events: [{ side: 'A', type: 'save', player: player.name }] });
  t.slotByCode[a].xi = t.slotByCode[a].xi.filter((entry) => entry.id !== player.id);
  assert.equal(statsByPlayer(t).get(player.id).appearances, 1);
  assert.equal(statsByPlayer(t).get(player.id).saves, 1);
});
