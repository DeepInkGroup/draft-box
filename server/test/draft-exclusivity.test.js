const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getLeague } = require('../src/data/competitions');
const { getSlots } = require('../src/game/formations');
const { pickPlayer } = require('../src/game/draftEngine');
test('two league users revealing the same club cannot draft the same footballer', () => {
  const clubs = getLeague('pgl').teams;
  const member = id => ({ userId: id, formation: '4-3-3', currentReveal: clubs[0].code, clubCode: clubs[id - 1].code,
    slots: Object.fromEntries(getSlots('4-3-3').map(slot => [slot.code, null])), squad: [] });
  const state = { mode: 'league', leagueId: 'pgl', members: new Map([[1, member(1)], [2, member(2)]]), pool: new Set(clubs.flatMap(club => club.players.map(player => player.id))) };
  const player = clubs[0].players.find(player => player.pos === 'GK');
  pickPlayer(state, 1, player.id, 'GK');
  assert.throws(() => pickPlayer(state, 2, player.id, 'GK'), /already taken/);
  assert.equal(state.members.get(1).squad.length, 1);
  assert.equal(state.members.get(2).squad.length, 0);
  assert.equal(state.pool.has(player.id), false);
});
