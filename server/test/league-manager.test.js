const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startLeague } = require('../src/game/leagueEngine');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
const { prepareCareer, careerSnapshot, careerPending, chooseManagerClub, applyDepartures, settleManagerSquads } = require('../src/game/leagueCareer');
const { cohesionSnapshot } = require('../src/game/leagueCohesion');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');

function season(count = 2, options = {}) {
  const clubs = getLeague('pgl').teams.slice(0, count);
  const state = { mode: 'league', leagueId: 'pgl', managerOffers: true, playerDepartures: true, ...options,
    members: new Map(clubs.map((club, i) => [i + 1, { userId: i + 1, username: 'coach' + i,
      clubCode: club.code, formation: '4-3-3', squad: bestXI(club), tacticalStyle: 'balanced', tacticalStyleLocked: true }])) };
  const t = startLeague(state);
  t.stage = 'done'; t.matchday = 34;
  Object.values(t.standings).forEach((row, i) => { row.played = 34; row.pts = 60 + i; });
  for (const club of clubs) t.standings[club.code].pts = 0;
  t.champion = Object.keys(t.standings).at(-1);
  return state;
}

test('manager offers range from zero to two, exclude humans, reserve clubs and persist decisions', () => {
  for (const [random, count] of [[0.1, 0], [0.5, 1], [0.9, 2]]) {
    const t = season(2, { playerDepartures: false }).tournament;
    const before = JSON.stringify(t.slotByCode);
    const career = prepareCareer(t, () => random);
    const offers = Object.values(career.users).flatMap(user => user.offers.map(offer => offer.code));
    assert.equal(offers.length, count * 2);
    assert.equal(new Set(offers).size, offers.length);
    assert.ok(offers.every(code => !t.slotByCode[code].isHuman));
    assert.equal(careerPending(t), count > 0);
    assert.deepEqual(prepareCareer(t, () => 0.01), career);
    const restored = JSON.parse(JSON.stringify(t));
    assert.deepEqual(prepareCareer(restored), career);
    if (count) {
      const human = Object.values(t.slotByCode).find(team => team.userId === 2);
      assert.throws(() => chooseManagerClub(t, 1, human.code), /offered AI club/);
      assert.throws(() => chooseManagerClub(t, 1, career.users[2].offers[0].code), /offered AI club/);
      assert.throws(() => chooseManagerClub(t, 99, null), /no pending/);
      chooseManagerClub(t, 1, career.users[1].offers[0].code);
      assert.equal(careerPending(t), true);
      assert.throws(() => chooseManagerClub(t, 1, null), /no pending/);
      chooseManagerClub(t, 2, null);
      assert.equal(careerSnapshot(t, 2).selectedClubCode, human.code);
      assert.equal(careerPending(t), false);
    }
    assert.equal(JSON.stringify(t.slotByCode), before);
    assert.equal(careerSnapshot(t, 99), null);
  }
  const full = season(18).tournament;
  prepareCareer(full, () => 0.9);
  assert.equal(careerPending(full), false);
  assert.ok(Object.values(full.careerTransition.users).every(user => user.offers.length === 0));
  const active = season().tournament; active.stage = 'league';
  assert.throws(() => prepareCareer(active), /Finish the season/);
  assert.throws(() => chooseManagerClub(active, 1, null), /after the season/);
});

test('poor-results departures affect human and AI bottom-third clubs only, keep valid XIs and retain history', () => {
  const countsSeen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    let value = seed;
    const random = () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 2 ** 32; };
    const t = season(2, { managerOffers: false }).tournament;
    const before = JSON.stringify(t.slotByCode);
    const plans = prepareCareer(t, random).departures;
    assert.equal(JSON.stringify(t.slotByCode), before);
    const next = JSON.parse(JSON.stringify(t));
    applyDepartures(next, plans);
    next.initialXIs = Object.fromEntries(Object.values(next.slotByCode).map(team => [team.code, structuredClone(team.xi)]));
    next.initialClubRosters = structuredClone(next.clubRosters);
    next.matchday = 0;
    const browserState = { mode: 'league', tournament: next, members: new Map([[1, { viewedStep: 0 }]]) };
    const byClub = {};
    for (const entry of plans) {
      const team = next.slotByCode[entry.clubCode];
      assert.ok(entry.rank > 12);
      byClub[entry.clubCode] = (byClub[entry.clubCode] || 0) + 1;
      countsSeen.add(team.isHuman ? 'human' : 'ai');
      assert.ok(!team.xi.some(player => player.id === entry.player.id));
      assert.ok(team.xi.some(player => player.id === entry.replacement.id && player.slotCode === entry.player.slotCode));
      assert.ok(next.freeAgents.some(player => player.id === entry.player.id));
      assert.ok(Object.values(next.clubRosters).every(roster => !roster.some(player => player.id === entry.player.id)));
      assert.equal(team.xi.length, 11);
      assert.equal(new Set(team.xi.map(player => player.id)).size, 11);
      assert.equal(cohesionSnapshot(team).penaltyPercent, 0);
      const profile = clubSquadSnapshot(browserState, 1, entry.clubCode).players.find(player => player.id === entry.player.id);
      assert.equal(profile.status, 'Released');
    }
    for (const count of Object.values(byClub)) { assert.ok(count <= 2); countsSeen.add(count); }
    assert.deepEqual(next.standings, t.standings);
    assert.deepEqual(next.seasonDepartures, plans);
  }
  assert.ok(countsSeen.has('human')); assert.ok(countsSeen.has('ai'));
  assert.ok(countsSeen.has(1)); assert.ok(countsSeen.has(2));
  const disabled = season(2, { managerOffers: false, playerDepartures: false }).tournament;
  assert.deepEqual(prepareCareer(disabled).departures, []);
  assert.equal(careerPending(disabled), false);
});

test('incoming managers get distinct reserve replacements while existing owners keep their players', () => {
  const t = season().tournament;
  const owner = Object.values(t.slotByCode).find(team => team.isHuman);
  const incoming = Object.values(t.slotByCode).filter(team => !team.isHuman).slice(0, 2);
  const keeper = owner.xi.find(player => player.pos === 'GK');
  const before = JSON.stringify(owner.xi);
  for (const team of incoming) {
    const index = team.xi.findIndex(player => player.pos === 'GK');
    team.xi[index] = { ...keeper, slotCode: team.xi[index].slotCode, isCaptain: true };
  }
  const clubs = [incoming[0].code, owner.code, incoming[1].code];
  const changes = settleManagerSquads(t, clubs);
  assert.equal(changes.length, 2); assert.equal(JSON.stringify(owner.xi), before);
  const players = clubs.flatMap(code => t.slotByCode[code].xi.map(player => player.id));
  assert.equal(players.length, 33); assert.equal(new Set(players).size, 33);
  for (const team of incoming) {
    const replacement = team.xi.find(player => player.pos === 'GK');
    assert.notEqual(replacement.id, keeper.id); assert.equal(replacement.isCaptain, true);
    assert.equal(cohesionSnapshot(team).penaltyPercent, 0);
    assert.ok(t.clubRosters[team.code].some(player => player.id === replacement.id));
  }
  const settled = JSON.stringify(t.slotByCode);
  assert.deepEqual(settleManagerSquads(t, clubs), []);
  assert.equal(JSON.stringify(t.slotByCode), settled);
});

test('continuing a season saves each new manager with the offered club squad and preserves the original room', () => {
  process.env.DB_PATH = ':memory:';
  process.env.ADMIN_INITIAL_PASSWORD = 'test-only-admin-password';
  const rm = require('../src/game/roomManager');
  const db = require('../src/db');
  const ids = ['host', 'guest'].map(name => Number(db.prepare('INSERT INTO users(username,email,password_hash) VALUES(?,?,?)').run('career_' + name, name + '@career.test', 'test-only').lastInsertRowid));
  const clubs = getLeague('pgl').teams;
  const previous = rm.createRoom({ mode: 'league', leagueId: 'pgl', creatorId: ids[0], humanSlotsMax: 2, squadMode: 'real',
    managerOffers: true, playerDepartures: true, captainEnabled: true, transferEnabled: false, endTransferEnabled: true, endTransferLimit: 1 });
  ids.forEach((id, i) => { rm.joinRoom(previous, { id, username: 'career_' + i }, '4-3-3', clubs[i].code); rm.initializeRealSquad(previous, id); rm.persistTacticalStyle(previous.id, id, 'balanced'); });
  const state = rm.loadRoomState(previous);
  startLeague(state); state.tournament.stage = 'done'; state.tournament.matchday = 34; state.tournament.champion = clubs[2].code;
  Object.values(state.tournament.standings).forEach((row, i) => { row.played = 34; row.pts = i; });
  const career = prepareCareer(state.tournament, () => 0.9);
  rm.setRoomStatus(previous.id, 'finished'); rm.persistTournamentSnapshot(state);
  let row = rm.getRoomRow(previous.id);
  assert.ok(rm.listUserLeagues(ids[1]).some(league => league.code === row.code && league.betweenSeasons));
  assert.throws(() => rm.continueLeagueSeason(row, ids[1]), /Only the host/);
  assert.equal(rm.continueLeagueSeason(row, ids[0]), null);
  const target = career.users[ids[0]].offers[0].code;
  // Legacy seasons can retain an AI starter after a human has signed him.
  // Taking over that AI club must not duplicate another human's footballer.
  const targetTeam = state.tournament.slotByCode[target];
  const keeperIndex = targetTeam.xi.findIndex(player => player.pos === 'GK');
  const peerKeeper = state.tournament.slotByCode[clubs[1].code].xi.find(player => player.pos === 'GK');
  targetTeam.xi[keeperIndex] = { ...peerKeeper, slotCode: targetTeam.xi[keeperIndex].slotCode };
  const targetXI = structuredClone(state.tournament.slotByCode[target].xi);
  chooseManagerClub(state.tournament, ids[0], target);
  assert.equal(rm.continueLeagueSeason(row, ids[0]), null);
  chooseManagerClub(state.tournament, ids[1], null); rm.persistTournamentSnapshot(state);
  const original = JSON.stringify(state.tournament.slotByCode);
  const next = rm.continueLeagueSeason(row, ids[0]);
  const nextState = rm.loadRoomState(next);
  assert.equal(next.season_number, 2); assert.equal(next.manager_offers, 1); assert.equal(next.player_departures, 1);
  assert.equal(nextState.members.get(ids[0]).clubCode, target);
  const incomingSquad = nextState.members.get(ids[0]).squad;
  assert.equal(incomingSquad.length, 11);
  for (const player of targetXI.filter(player => player.id !== peerKeeper.id)) assert.equal(nextState.members.get(ids[0]).slots[player.slotCode].id, player.id);
  assert.ok(!incomingSquad.some(player => player.id === peerKeeper.id));
  assert.ok(nextState.members.get(ids[1]).squad.some(player => player.id === peerKeeper.id));
  const humanPlayers = [...nextState.members.values()].flatMap(member => member.squad.map(player => player.id));
  assert.equal(new Set(humanPlayers).size, 22);
  assert.equal(nextState.tournament.managerChanges[0].squadUpdates[0].player.id, peerKeeper.id);
  assert.equal(nextState.members.get(ids[1]).clubCode, clubs[1].code);
  assert.equal(nextState.tournament.slotByCode[clubs[0].code].isHuman, false);
  assert.equal(nextState.tournament.slotByCode[target].userId, ids[0]);
  assert.equal(nextState.tournament.slotByCode[target].xi.filter(player => player.isCaptain).length, 1);
  assert.ok(nextState.members.get(ids[0]).captainSlot);
  assert.equal(nextState.tournament.matchday, 0);
  assert.equal(Object.values(nextState.tournament.slotByCode).filter(team => team.isHuman).length, 2);
  assert.equal(nextState.tournament.managerChanges.length, 1);
  assert.equal(JSON.stringify(state.tournament.slotByCode), original);
  row = rm.getRoomRow(previous.id);
  assert.equal(rm.continueLeagueSeason(row, ids[0]).id, next.id);
  assert.equal(rm.getMembers(next.id).find(member => member.user_id === ids[0]).country_code, target);
  assert.ok(rm.listUserLeagues(ids[1]).some(league => league.code === next.code));
  assert.ok(!rm.listUserLeagues(ids[1]).some(league => league.code === row.code));
  const saved = JSON.parse(db.prepare('SELECT tournament_state FROM rooms WHERE id = ?').get(previous.id).tournament_state);
  assert.equal(saved.careerTransition.users[ids[0]].selectedClubCode, target);
  assert.equal(nextState.tournament.previousSeasons[0].userPositions[ids[0]], 18);
  assert.throws(() => rm.createRoom({ creatorId: ids[0], managerOffers: 'true' }), /Career options/);
  assert.throws(() => rm.createRoom({ creatorId: ids[0], managerOffers: true }), /online leagues/);
  const rematch = rm.createRematch(row, ids[0]);
  assert.equal(rm.createRematch(row, ids[0]).id, rematch.id);
  rm.setRoomStatus(rematch.id, 'finished');
  assert.notEqual(rm.createRematch(row, ids[0]).id, rematch.id, 'A finished previous rematch must not reopen an old game');
  db.close();
});
