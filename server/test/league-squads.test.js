const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startLeague } = require('../src/game/leagueEngine');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');
const { bestXI } = require('../src/game/botEngine');
const { getLeague } = require('../src/data/competitions');

test('team browser distinguishes starting XI, roster and club-specific player statistics', () => {
  const clubs = getLeague('pgl').teams;
  const state = { mode: 'league', leagueId: 'pgl', members: new Map([[1, { userId: 1, username: 'coach', clubCode: clubs[0].code,
    squad: bestXI(clubs[0]), formation: '4-3-3', tacticalStyle: 'vertical', tacticalStyleLocked: true, viewedStep: 1 }]]) };
  const t = startLeague(state);
  t.matchday = 2;
  const team = t.slotByCode[clubs[1].code];
  const player = team.xi.find((entry) => entry.pos !== 'GK');
  const makeMatch = (matchday) => ({ aCode: clubs[1].code, bCode: clubs[0].code, matchday,
    lineups: { A: team.xi, B: t.slotByCode[clubs[0].code].xi }, events: [{ side: 'A', type: 'goal', player: player.name }] });
  t.matchLog = [makeMatch(1), makeMatch(2)];
  const data = clubSquadSnapshot(state, 1, clubs[1].code);
  assert.equal(data.matchday, 1);
  assert.equal(data.players.filter((entry) => entry.status === 'Starting XI').length, 11);
  assert.equal(data.players.find((entry) => entry.id === player.id).stats.goals, 1);
  assert.equal(data.players.find((entry) => entry.id === player.id).stats.appearances, 1);
  assert.ok(data.players.some((entry) => entry.status === 'Club roster' && entry.stats.appearances === 0));
  assert.throws(() => clubSquadSnapshot(state, 9, clubs[1].code), /not a member/);
  assert.throws(() => clubSquadSnapshot(state, 1, 'IRN'), /not part/);
});
