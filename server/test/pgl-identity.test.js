const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCoaches } = require('../src/data/generate-pgl');
const { getLeague, leagueCatalog } = require('../src/data/competitions');
const { startLeague, leagueSnapshot } = require('../src/game/leagueEngine');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');
const { bestXI } = require('../src/game/botEngine');
const league = getLeague('pgl');
const source = fs.readFileSync(path.join(__dirname, '../../PGL-Coaches.txt'), 'utf8');

test('all supplied coaches and local club crests are available through the league catalog', () => {
  const sections = parseCoaches(source, league.teams);
  const catalog = leagueCatalog().find(entry => entry.id === 'pgl');
  assert.equal(catalog.teams.length, 18);
  assert.equal(catalog.freeAgentCoaches.length, 20);
  assert.equal(catalog.teams.find(club => club.name === 'Persepolis').headCoach.name, 'Mehdi Tartar');
  assert.equal(catalog.freeAgentCoaches[0].name, 'Yahya Golmohammadi');
  assert.equal(catalog.freeAgentCoaches.at(-1).name, 'Masoud Shojaei');
  for (const club of catalog.teams) {
    assert.deepEqual(club.headCoach, sections.get(club.name)[0]);
    const image = fs.readFileSync(path.join(__dirname, '../../web', club.logo));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', club.name);
    assert.ok(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0, club.name);
  }
  assert.deepEqual(catalog.freeAgentCoaches, sections.get('Free Agents'));
});

test('coach import rejects missing clubs, unknown clubs and duplicate coaches', () => {
  assert.throws(() => parseCoaches(source.replace('1- Mehdi Tartar', ''), league.teams), /Expected one head coach for Persepolis/);
  assert.throws(() => parseCoaches(source.replace('1) Persepolis:', '1) Unknown:'), league.teams), /Unknown coach club/);
  assert.throws(() => parseCoaches(source.replace('2- Mojtaba Hosseini', '2- Mehdi Tartar'), league.teams), /Duplicate coach/);
});

test('club profiles show supplied coaches for human and AI clubs, including older saved seasons', () => {
  const club = league.teams[0];
  const state = { mode: 'league', leagueId: 'pgl', members: new Map([[1, { userId: 1, username: 'Human manager', clubCode: club.code,
    squad: bestXI(club), formation: '4-3-3', tacticalStyle: 'balanced', tacticalStyleLocked: true, viewedStep: 0 }]]) };
  const season = startLeague(state);
  assert.deepEqual(leagueSnapshot(season).freeAgentCoaches, league.freeAgentCoaches);
  for (const team of [club, league.teams[1]]) {
    assert.deepEqual(season.slotByCode[team.code].headCoach, team.headCoach);
    delete season.slotByCode[team.code].headCoach; // A save created before coach profiles existed.
    const profile = clubSquadSnapshot(state, 1, team.code);
    assert.deepEqual(profile.headCoach, team.headCoach);
    assert.equal(profile.logo, team.logo);
  }
  assert.equal(clubSquadSnapshot(state, 1, club.code).username, 'Human manager');
});
