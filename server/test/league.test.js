const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parsePgl } = require('../src/data/generate-pgl');
const pgl = require('../src/data/pgl.json');
const { createFixtures, rankTable } = require('../src/game/leagueEngine');

test('PGL data exactly preserves the supplied clubs, player positions, ratings and stars', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'PGL-Players.txt'), 'utf8');
  assert.deepEqual(parsePgl(source), pgl);
  assert.equal(pgl.teams.length, 18);
  assert.equal(pgl.teams.flatMap((club) => club.players).length, 510);
  const players = pgl.teams.flatMap((club) => club.players);
  assert.ok(players.some((player) => player.name === 'Dániel Gera' && player.rawPos === 'RB, RWB, RM, RW'));
  assert.ok(players.some((player) => player.name === 'Payam Niazmand' && player.overall === 75 && player.isStar));
  assert.throws(() => parsePgl('1) Club:\n1- Invalid player'), /line 2/);
});

test('home-and-away schedule plays every ordered pair once, with no double-booked clubs', () => {
  for (const size of [18, 5, 2]) {
    const clubs = Array.from({ length: size }, (_, index) => `club-${index}`);
    const rounds = createFixtures(clubs);
    const pairs = new Set();
    for (const matches of rounds) {
      const clubsPlaying = matches.flatMap((match) => [match.aCode, match.bCode]);
      assert.equal(new Set(clubsPlaying).size, clubsPlaying.length);
      for (const match of matches) {
        assert.notEqual(match.aCode, match.bCode);
        assert.ok(!pairs.has(`${match.aCode}:${match.bCode}`));
        pairs.add(`${match.aCode}:${match.bCode}`);
      }
    }
    assert.equal(pairs.size, size * (size - 1));
    for (const club of clubs) {
      const matches = rounds.flat();
      assert.equal(matches.filter((match) => match.aCode === club).length, size - 1);
      assert.equal(matches.filter((match) => match.bCode === club).length, size - 1);
    }
  }
});

test('table ranking uses points, goal difference and goals scored with a stable final fallback', () => {
  const t = { standings: {
    a: { pts: 8, gf: 5, ga: 3 }, b: { pts: 8, gf: 7, ga: 5 }, c: { pts: 9, gf: 1, ga: 6 }, d: { pts: 8, gf: 5, ga: 2 }
  }, slotByCode: Object.fromEntries(['a', 'b', 'c', 'd'].map((code) => [code, { name: code }])) };
  assert.deepEqual(rankTable(t).map((row) => row.code), ['c', 'd', 'b', 'a']);
});
