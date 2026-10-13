const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');

async function startServer(dbPath, cwd) {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], {
    cwd,
    env: { ...process.env, PORT: '0', DB_PATH: dbPath, JWT_SECRET: 'deployment-test-secret', ADMIN_INITIAL_PASSWORD: 'test-admin-initial-password', CORS_ORIGIN: 'https://deepinkgroup.github.io' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  });
  let logs = '';
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${logs}`)), 15000);
      child.stderr.on('data', (data) => { logs += data; });
      child.stdout.on('data', (data) => {
        logs += data;
        const match = logs.match(/listening on :(\d+)/);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
      });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited (${code}): ${logs}`)); });
    });
    return { base, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${name}`)), 15000);
    const success = (data) => finish(null, data);
    const failure = (data) => finish(new Error(data.error || data.message || String(data)));
    function finish(error, data) {
      clearTimeout(timer);
      socket.off(name, success);
      socket.off('error:message', failure);
      socket.off('connect_error', failure);
      error ? reject(error) : resolve(data);
    }
    socket.once(name, success);
    socket.once('error:message', failure);
    socket.once('connect_error', failure);
  });
}

test('hosted app supports multiplayer, World Cup, a complete PGL season and persistent SQLite', { timeout: 150000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'draftbox-test-'));
  let server;
  const sockets = [];
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    if (server) await server.stop();
    await rm(dir, { recursive: true, force: true });
  });
  const dbPath = path.join(dir, 'saved.sqlite');
  // Start outside server/ to catch paths that accidentally depend on the CWD.
  server = await startServer(dbPath, dir);

  async function request(route, { token, body, method = body ? 'POST' : 'GET', status = 200 } = {}) {
    const response = await fetch(server.base + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }

  assert.equal((await request('/api/health')).ok, true);
  const page = await fetch(server.base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /js\/deploy-config\.js/);
  for (const asset of ['/js/config.js', '/js/deploy-config.js', '/css/style.css']) {
    const response = await fetch(server.base + asset);
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get('content-type'), /text\/html/);
  }
  await request('/api/missing', { status: 404 });
  const cors = await fetch(server.base + '/api/health', { headers: { Origin: 'https://deepinkgroup.github.io' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), 'https://deepinkgroup.github.io');
  assert.equal((await request('/api/teams')).teams.length, 48);
  await request('/api/auth/me', { status: 401 });
  await request('/api/tactics', { status: 401 });

  const owner = await request('/api/auth/register', { body: { username: 'host_test', email: 'host@example.test', password: 'test-password' }, status: 201 });
  const friend = await request('/api/auth/register', { body: { username: 'friend_test', email: 'friend@example.test', password: 'test-password' }, status: 201 });
  assert.equal((await request('/api/auth/me', { token: owner.token })).user.username, 'host_test');
  const admin = await request('/api/auth/login', { body: { username: 'Admin', password: 'test-admin-initial-password' } });
  assert.equal(admin.user.role, 'admin');
  assert.equal((await request('/api/auth/me', { token: admin.token })).user.role, 'admin');
  assert.equal(owner.user.role, 'user');
  await request('/api/auth/register', { body: { username: 'admin', email: 'reserved@example.test', password: 'test-password' }, status: 400 });
  const injection = await request('/api/auth/register', { body: { username: 'injection_test', email: 'injection@example.test', password: 'test-password', role: 'admin' }, status: 201 });
  assert.equal(injection.user.role, 'user');
  await request('/api/admin/overview', { status: 401 });
  for (const route of ['/api/admin/overview', '/api/admin/users', '/api/admin/users/1', '/api/admin/players', '/api/admin/leagues', '/api/admin/leagues/missing', '/api/tactics', '/api/tactics/templates', '/api/tactics/1/versions']) await request(route, { token: owner.token, status: 403 });
  for (const [route, method] of [['/api/tactics', 'POST'], ['/api/tactics/1', 'PUT'], ['/api/tactics/1', 'DELETE'], ['/api/tactics/preview', 'POST'], ['/api/tactics/1/restore', 'POST']]) await request(route, { token: injection.token, method, body: { name: 'Forbidden' }, status: 403 });
  const jwt = require('jsonwebtoken');
  const spoofed = jwt.sign({ id: owner.user.id, username: owner.user.username, role: 'admin' }, 'deployment-test-secret');
  await request('/api/admin/overview', { token: spoofed, status: 403 });
  const adminPlayers = await request('/api/admin/players', { token: admin.token });
  assert.equal(adminPlayers.players.length, 510);
  assert.equal(adminPlayers.clubs.length, 18);
  assert.equal((await request('/api/admin/players?competition=worldcup', { token: admin.token })).players.length, 1248);
  assert.equal((await request('/api/tactics/templates', { token: admin.token })).length, 12);
  const tactic = await request('/api/tactics', { token: admin.token, body: { name: 'Deployment tactic', attack: 999, defense: -99, possession: 999, user_id: owner.user.id }, status: 201 });
  assert.equal(typeof tactic.id, 'number');
  assert.equal(tactic.user_id, admin.user.id);
  assert.equal(tactic.version, 1);
  assert.ok(tactic.attack <= 1.28 && tactic.defense >= .72 && tactic.possession <= 8);
  const updated = await request('/api/tactics/' + tactic.id, { token: admin.token, method: 'PUT', body: { ...tactic, name: 'Updated tactic', attack: .9 } });
  assert.equal(updated.version, 2);
  await request('/api/tactics/' + tactic.id, { token: admin.token, method: 'PUT', body: { ...tactic, name: 'Stale' }, status: 409 });
  const restored = await request('/api/tactics/' + tactic.id + '/restore', { token: admin.token, body: { version: 1 } });
  assert.equal(restored.version, 3);
  assert.equal(restored.name, tactic.name);
  assert.equal((await request('/api/tactics/' + tactic.id + '/versions', { token: admin.token })).length, 3);
  const analysis = await request('/api/tactics/preview', { token: admin.token, body: { tactic: { name: 'Lab test', attack: 1.15, defense: .85 }, clubCode: adminPlayers.clubs[0].code, opponentCode: adminPlayers.clubs[1].code, samples: 20, formation: '4-3-3' } });
  assert.equal(analysis.samples, 20);
  for (const stats of [analysis.candidate, analysis.baseline]) {
    assert.equal(stats.wins + stats.draws + stats.losses, 20);
    assert.ok(Number.isFinite(stats.xg) && stats.xg > 0);
  }
  assert.equal((await request('/api/tactics', { token: admin.token })).length, 1);
  assert.equal((await request('/api/tactics/' + tactic.id + '/versions', { token: admin.token })).length, 3);
  await request('/api/tactics/preview', { token: admin.token, body: { clubCode: 'invalid', opponentCode: 'invalid' }, status: 400 });
  const room = await request('/api/rooms', { token: owner.token, body: { name: 'Hosted multiplayer', humanSlotsMax: 2, pickTimeMs: 0 }, status: 201 });

  async function connect(token) {
    const socket = io(server.base, { auth: { token }, transports: ['websocket'], autoConnect: false, reconnection: false });
    sockets.push(socket);
    const ready = event(socket, 'connect');
    socket.connect();
    await ready;
    return socket;
  }
  const hostSocket = await connect(owner.token);
  let ready = event(hostSocket, 'room:state');
  const initialMembers = event(hostSocket, 'room:memberUpdate');
  hostSocket.emit('room:join', { code: room.code });
  assert.equal((await ready).stage, 'lobby');
  await initialMembers;
  ready = event(hostSocket, 'room:memberUpdate');
  await request(`/api/rooms/${room.code}/join`, { token: friend.token, body: { formation: '4-4-2' } });
  assert.equal((await ready).members.length, 2);
  const accounts = await request('/api/admin/users?search=host%40example.test', { token: admin.token });
  assert.equal(accounts.total, 1);
  assert.equal(accounts.users[0].username, owner.user.username);
  assert.equal(accounts.users[0].email, 'host@example.test');
  assert.equal(accounts.users[0].status, 'online');
  assert.ok(accounts.users[0].lastLogin && accounts.users[0].lastSeen);
  assert.ok(!('password_hash' in accounts.users[0]));
  const userDetail = await request('/api/admin/users/' + owner.user.id, { token: admin.token });
  assert.equal(userDetail.games.total, 1);
  assert.equal(userDetail.rooms[0].code, room.code);
  assert.ok(!('password_hash' in userDetail.user));
  await request('/api/admin/users/999999', { token: admin.token, status: 404 });
  await request('/api/admin/users/no-id', { token: admin.token, status: 400 });
  assert.equal((await request('/api/admin/users?role=admin', { token: admin.token })).total, 1);
  assert.equal((await request('/api/admin/users?search=notfound', { token: admin.token })).total, 0);
  const presenceA = await connect(injection.token), presenceB = await connect(injection.token);
  presenceA.disconnect();
  assert.equal((await request('/api/admin/users/' + injection.user.id, { token: admin.token })).user.status, 'online');
  presenceB.disconnect();
  let disconnectedStatus;
  for (let i = 0; i < 10; i++) {
    disconnectedStatus = (await request('/api/admin/users/' + injection.user.id, { token: admin.token })).user.status;
    if (disconnectedStatus !== 'online') break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(disconnectedStatus, 'recent');
  const { DatabaseSync } = require('node:sqlite');
  const fixtures = new DatabaseSync(dbPath);
  fixtures.prepare("UPDATE users SET last_seen_at = '2000-01-01 00:00:00' WHERE id = ?").run(injection.user.id);
  for (let i = 0; i < 21; i++) fixtures.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run('directory_' + i, 'directory_' + i + '@example.test', 'unused-fixture-hash', 'user');
  fixtures.close();
  assert.equal((await request('/api/admin/users?status=offline', { token: admin.token })).users[0].id, injection.user.id);
  const dormant = await request('/api/admin/users?status=new&page=1', { token: admin.token });
  assert.equal(dormant.total, 21);
  assert.equal(dormant.users.length, 20);
  assert.equal(dormant.pages, 2);
  assert.equal((await request('/api/admin/users?status=new&page=2', { token: admin.token })).users.length, 1);
  const friendSocket = await connect(friend.token);
  ready = event(friendSocket, 'room:state');
  friendSocket.emit('room:join', { code: room.code });
  await ready;
  ready = event(friendSocket, 'room:started');
  await request(`/api/rooms/${room.code}/start`, { token: owner.token, body: {} });
  await ready;

  const solo = await request('/api/rooms/singleplayer', { token: owner.token, body: { formation: '4-3-3', pickTimeMs: 0 }, status: 201 });
  ready = event(hostSocket, 'room:state');
  hostSocket.emit('room:join', { code: solo.code });
  assert.equal((await ready).stage, 'drafting');
  ready = event(hostSocket, 'tournament:started');
  hostSocket.emit('draft:autoComplete', { code: solo.code });
  await ready;
  const drafted = await request(`/api/rooms/${solo.code}/state`, { token: owner.token });
  assert.equal(drafted.status, 'group_stage');
  let step;
  for (let i = 0; i < 12 && step?.stage !== 'done'; i++) {
    ready = event(hostSocket, 'tournament:step');
    hostSocket.emit('tournament:advance', { code: solo.code });
    step = await ready;
  }
  assert.equal(step.stage, 'done');
  assert.ok(step.step.champion);
  assert.equal((await request(`/api/rooms/${solo.code}`, { token: owner.token })).status, 'finished');

  sockets.forEach((socket) => socket.disconnect());
  await server.stop();
  server = await startServer(dbPath, dir);
  const login = await request('/api/auth/login', { body: { username: 'host_test', password: 'test-password' } });
  assert.equal(login.user.id, owner.user.id);
  assert.equal((await request(`/api/rooms/${solo.code}`, { token: login.token })).status, 'finished');
  const resumedSocket = await connect(login.token);
  ready = event(resumedSocket, 'room:state');
  resumedSocket.emit('room:join', { code: solo.code });
  assert.equal((await ready).tournamentStage, 'done');

  const catalog = await request('/api/leagues');
  const tacticCatalog = await request('/api/tactical-styles');
  assert.equal(tacticCatalog.styles.length, 12);
  assert.ok(tacticCatalog.styles.some((style) => style.key === 'catenaccio'));
  assert.deepEqual(catalog.leagues.map((league) => league.id), ['pgl']);
  const league = catalog.leagues[0];
  assert.equal(league.teamCount, 18);
  assert.equal(league.matchdays, 34);
  const clubCode = league.teams[0].code;
  await assert.rejects(connect(admin.token), /only use the admin panel/);
  for (const [route, method] of [['/api/rooms', 'GET'], ['/api/rooms', 'POST'], ['/api/rooms/singleplayer', 'POST'], ['/api/rooms/' + room.code + '/join', 'POST'], ['/api/rooms/' + room.code + '/start', 'POST'], ['/api/auth/me/career', 'GET'], ['/api/auth/me/matches', 'GET'], ['/api/auth/friends', 'GET'], ['/api/auth/friends/request', 'POST']]) {
    await request(route, { token: admin.token, method, ...(method === 'POST' ? { body: {} } : {}), status: 403 });
  }

  await request('/api/rooms/singleplayer', { token: login.token, body: { mode: 'league', leagueId: 'missing', clubCode }, status: 400 });
  await request('/api/rooms/singleplayer', { token: login.token, body: { mode: 'league', leagueId: 'pgl', clubCode: 'IRN' }, status: 400 });
  await request('/api/rooms', { token: login.token, body: { mode: 'league', leagueId: 'pgl' }, status: 400 });
  const season = await request('/api/rooms/singleplayer', { token: login.token, body: { mode: 'league', leagueId: 'pgl', clubCode, formation: '4-3-3', pickTimeMs: 0 }, status: 201 });
  assert.equal(season.mode, 'league');
  assert.equal(season.members[0].clubCode, clubCode);
  ready = event(resumedSocket, 'room:state');
  resumedSocket.emit('room:join', { code: season.code });
  assert.equal((await ready).poolRemaining, 510);
  ready = event(resumedSocket, 'draft:reveal');
  resumedSocket.emit('draft:reveal', { code: season.code });
  const reveal = await ready;
  assert.ok(reveal.team.code.startsWith('PGL-'));
  assert.ok(reveal.players.every((player) => player.id.startsWith('pgl-')));
  const { playerFitsSlot } = require('../src/game/formations');
  const manualPlayer = reveal.players.find((player) => player.available);
  const manualSlot = reveal.openSlots.find((slot) => playerFitsSlot(manualPlayer, slot));
  ready = event(resumedSocket, 'draft:picked');
  resumedSocket.emit('draft:pick', { code: season.code, playerId: manualPlayer.id, slotCode: manualSlot.code });
  assert.equal((await ready).player.id, manualPlayer.id);
  ready = event(resumedSocket, 'tournament:started');
  resumedSocket.emit('draft:autoComplete', { code: season.code });
  await ready;
  ready = event(resumedSocket, 'room:state');
  resumedSocket.emit('room:join', { code: season.code });
  const initial = await ready;
  assert.equal(initial.tournamentStage, 'league');
  assert.equal(initial.myLineup.code, clubCode);
  assert.equal(initial.myLineup.xi.length, 11);
  assert.ok(initial.myLineup.xi.every((player) => player.id.startsWith('pgl-')));
  assert.equal(initial.league.table.length, 18);
  assert.equal(initial.league.totalMatchdays, 34);
  const otherClub = league.teams[1].code;
  const initialClub = await request(`/api/rooms/${season.code}/clubs/${otherClub}`, { token: login.token });
  assert.equal(initialClub.players.filter((player) => player.status === 'Starting XI').length, 11);
  assert.ok(initialClub.players.every((player) => player.stats.appearances === 0));
  await request(`/api/rooms/${season.code}/clubs/${otherClub}`, { token: friend.token, status: 403 });
  const leagueResults = [];
  let seasonSocket = resumedSocket;
  for (let matchday = 1; matchday <= 34; matchday++) {
    ready = event(seasonSocket, 'tournament:step');
    seasonSocket.emit('tournament:advance', { code: season.code });
    const result = await ready;
    assert.equal(result.step.matchday, matchday);
    assert.equal(result.step.matches.length, 9);
    assert.equal(result.spectator, false);
    assert.ok(result.step.leagueTable.every((row) => row.played === matchday && row.pts === row.w * 3 + row.d && row.played === row.w + row.d + row.l));
    leagueResults.push(...result.step.matches);
    if (matchday === 17) {
      assert.equal(result.transfers.phase, 'release');
      ready = event(seasonSocket, 'league:transferState');
      seasonSocket.emit('league:transfer', { code: season.code, action: 'skip' });
      assert.equal((await ready).transfers.phase, 'skipped');
    }
    if (matchday === 5) {
      const savedTable = result.step.leagueTable;
      sockets.forEach((socket) => socket.disconnect());
      await server.stop();
      server = await startServer(dbPath, dir);
      seasonSocket = await connect(login.token);
      ready = event(seasonSocket, 'room:state');
      seasonSocket.emit('room:join', { code: season.code });
      const restored = await ready;
      assert.equal(restored.viewedStep, 5);
      assert.deepEqual(restored.myStep.leagueTable, savedTable);
      assert.equal(restored.myLineup.code, clubCode);
      assert.deepEqual(restored.myLineup.xi, initial.myLineup.xi);
      const active = await request('/api/rooms', { token: login.token });
      assert.ok(active.leagues.some((entry) => entry.code === season.code && entry.matchday === 5));
      assert.deepEqual((await request('/api/rooms', { token: friend.token })).leagues, []);
    }
    if (matchday === 34) {
      assert.equal(result.stage, 'done');
      assert.equal(result.step.champion.code, result.step.leagueTable[0].code);
      assert.equal(result.step.myRecord.w + result.step.myRecord.d + result.step.myRecord.l, 34);
      assert.deepEqual(result.step.completedBracket, []);
    }
  }
  assert.equal(leagueResults.length, 306);
  const orderedPairs = new Set(leagueResults.map((match) => `${match.aCode}:${match.bCode}`));
  assert.equal(orderedPairs.size, 306);
  assert.ok(leagueResults.every((match) => !match.wentToPenalties && !match.wentToExtraTime));
  assert.equal((await request(`/api/rooms/${season.code}`, { token: login.token })).status, 'finished');
  assert.equal((await request('/api/rooms', { token: login.token })).leagues.length, 0);
  const history = await request('/api/auth/me/matches', { token: login.token });
  assert.equal(history.tournaments.find((entry) => entry.roomCode === season.code).matches.length, 34);
  ready = event(seasonSocket, 'room:rematchReady');
  seasonSocket.emit('room:rematch', { code: season.code });
  const rematch = await ready;
  const newSeason = await request(`/api/rooms/${rematch.newCode}`, { token: login.token });
  assert.equal(newSeason.mode, 'league');
  assert.equal(newSeason.leagueId, 'pgl');
  assert.equal(newSeason.members[0].clubCode, clubCode);

  for (const transferLimit of [-1, 4, 1.5, '3', null]) await request('/api/rooms/singleplayer', { token: login.token, body: { mode: 'league', leagueId: 'pgl', clubCode, transferLimit }, status: 400 });
  for (const endTransferLimit of [-1,4,1.5,'3',null]) await request('/api/rooms/singleplayer', {token:login.token,body:{mode:'league',leagueId:'pgl',clubCode,endTransferLimit},status:400});
  for (const option of ['endTransferEnabled','endAiTransfers']) await request('/api/rooms/singleplayer',{token:login.token,body:{mode:'league',leagueId:'pgl',clubCode,[option]:'on'},status:400});
  await request('/api/rooms/singleplayer',{token:login.token,body:{mode:'worldcup',pglRatingBoost:true},status:400});
  await request('/api/rooms/singleplayer',{token:login.token,body:{mode:'league',leagueId:'pgl',clubCode,pglRatingBoost:'true'},status:400});
  const real = await request('/api/rooms/singleplayer', { token: login.token, body: { mode: 'league', leagueId: 'pgl', clubCode, squadMode: 'real', formation: '4-3-3', captainEnabled: true, transferLimit: 3 }, status: 201 });
  assert.equal(real.squadMode, 'real');
  assert.equal(real.transferLimit, 3);
  assert.equal(real.members[0].draftComplete, true);
  ready = event(seasonSocket, 'room:state');
  seasonSocket.emit('room:join', { code: real.code });
  const realDraft = await ready;
  assert.equal(realDraft.myDraft.squad.length, 11);
  assert.ok(realDraft.myDraft.squad.every((player) => player.team === clubCode));
  const customDenied = new Promise((resolve) => seasonSocket.once('error:message', resolve));
  seasonSocket.emit('draft:setTacticalStyle', { code: real.code, tacticalStyle: 'custom:' + tactic.id });
  assert.match((await customDenied).error, /custom tactic not found/);
  const earlyFinish = new Promise((resolve) => seasonSocket.once('error:message', resolve));
  seasonSocket.emit('league:finishSeason', { code: real.code });
  assert.match((await earlyFinish).error, /active single-player/);
  ready = event(seasonSocket, 'tournament:started');
  seasonSocket.emit('draft:autoComplete', { code: real.code });
  await ready;
  ready = event(seasonSocket, 'tournament:step');
  seasonSocket.emit('tournament:advance', { code: real.code });
  await ready;
  const outsiderSocket = await connect(friend.token);
  const deniedSkip = new Promise((resolve) => outsiderSocket.once('error:message', resolve));
  outsiderSocket.emit('league:skipToTransfers', { code: real.code });
  assert.match((await deniedSkip).error, /not a member/);
  ready = event(seasonSocket, 'league:midseason');
  seasonSocket.emit('league:skipToTransfers', { code: real.code });
  step = await ready;
  assert.equal(step.viewedStep, 17);
  assert.equal(step.historyLength, 17);
  assert.equal(step.step.matchday, 17);
  const clubAtHalf = await request(`/api/rooms/${real.code}/clubs/${otherClub}`, { token: login.token });
  assert.ok(clubAtHalf.players.filter((player) => player.status === 'Starting XI').every((player) => player.stats.appearances === 17));
  assert.equal(step.transfers.phase, 'release');
  const originalXi = step.transfers.squad;
  assert.ok(originalXi.every((player) => player.stats.appearances === 17));
  const captain = originalXi.find((player) => player.isCaptain);
  const another = originalXi.find((player) => player.id !== captain.id);
  const third = originalXi.find(player => player.id !== captain.id && player.id !== another.id);
  const outgoingIds = [captain.id, another.id, third.id];
  async function expectSocketError(action, pattern) {
    const error = new Promise((resolve) => seasonSocket.once('error:message', resolve));
    action();
    assert.match((await error).error, pattern);
  }
  await expectSocketError(() => seasonSocket.emit('league:finishSeason', { code: real.code }), /transfers/);
  await expectSocketError(() => seasonSocket.emit('tournament:advance', { code: real.code }), /transfer window/);
  await expectSocketError(() => seasonSocket.emit('league:transfer', { code: real.code, action: 'sign', picks: [] }), /replacement/);
  await expectSocketError(() => seasonSocket.emit('league:transfer', { code: real.code, action: 'release', playerIds: [captain.id, captain.id] }), /different players/);
  ready = event(seasonSocket, 'league:transferState');
  seasonSocket.emit('league:transfer', { code: real.code, action: 'release', playerIds: outgoingIds });
  const released = (await ready).transfers;
  assert.equal(released.phase, 'sign');
  assert.equal(released.squad.length, 8);
  assert.equal(released.outgoing.length, 3);
  assert.ok(released.market.every((player) => !outgoingIds.includes(player.id) && player.rawPos && player.clubName && typeof player.overall === 'number' && player.stats));
  await expectSocketError(() => seasonSocket.emit('league:transfer', { code: real.code, action: 'skip' }), /vacant positions/);
  await expectSocketError(() => seasonSocket.emit('tournament:advance', { code: real.code }), /transfer window/);
  sockets.forEach((socket) => socket.disconnect());
  await server.stop();
  server = await startServer(dbPath, dir);
  seasonSocket = await connect(login.token);
  ready = event(seasonSocket, 'room:state');
  seasonSocket.emit('room:join', { code: real.code });
  const restoredTransfers = await ready;
  assert.equal(restoredTransfers.transfers.phase, 'sign');
  assert.equal(restoredTransfers.myLineup.xi.length, 8);
  assert.deepEqual(restoredTransfers.transfers.outgoing, released.outgoing);
  const usedIncoming = new Set();
  const picks = released.vacancies.map((slot) => {
    const player = released.market.find((candidate) => candidate.eligibleSlots.includes(slot.code) && !usedIncoming.has(candidate.id));
    usedIncoming.add(player.id);
    return { slotCode: slot.code, playerId: player.id };
  });
  await expectSocketError(() => seasonSocket.emit('league:transfer', { code: real.code, action: 'sign', picks: [picks[0], picks[0]] }), /different replacement/);
  await expectSocketError(() => seasonSocket.emit('league:transfer', { code: real.code, action: 'sign', picks: [{ slotCode: picks[0].slotCode, playerId: outgoingIds[0] }, ...picks.slice(1)] }), /available league player/);
  ready = event(seasonSocket, 'league:transferState');
  seasonSocket.emit('league:transfer', { code: real.code, action: 'sign', picks });
  const signed = (await ready).transfers;
  assert.equal(signed.phase, 'complete');
  assert.equal(signed.cohesion.penaltyPercent, 4.5);
  assert.equal(signed.cohesion.matchesPlayed, 0);
  assert.equal(signed.squad.length, 11);
  assert.equal(signed.squad.find((player) => player.isCaptain).slotCode, captain.slotCode);
  assert.ok(signed.incoming.every((player) => player.stats.appearances >= 0));
  ready = event(seasonSocket, 'tournament:step');
  seasonSocket.emit('tournament:advance', { code: real.code });
  const secondHalf = await ready;
  assert.equal(secondHalf.step.matchday, 18);
  assert.equal(secondHalf.transfers.cohesion.matchesPlayed, 1);
  sockets.forEach(socket => socket.disconnect());
  await server.stop(); server = await startServer(dbPath, dir);
  seasonSocket = await connect(login.token);
  ready = event(seasonSocket, 'room:state'); seasonSocket.emit('room:join', { code: real.code });
  const recoveryRestored = await ready;
  assert.equal(recoveryRestored.transfers.maxChanges, 3);
  assert.equal(recoveryRestored.transfers.cohesion.matchesPlayed, 1);
  assert.equal(recoveryRestored.transfers.cohesion.penaltyPercent, 3.375);
  const humanMatch = secondHalf.step.matches.find((match) => match.aCode === clubCode || match.bCode === clubCode);
  const humanXi = humanMatch.lineups[humanMatch.aCode === clubCode ? 'A' : 'B'];
  assert.ok(humanXi.every((player) => !outgoingIds.includes(player.id)));
  assert.ok(picks.every((pick) => humanXi.some((player) => player.id === pick.playerId)));
  await expectSocketError(() => seasonSocket.emit('league:skipToTransfers', { code: real.code }), /already passed/);
  await expectSocketError(() => seasonSocket.emit('league:transfer', { code: real.code, action: 'release', playerIds: picks.map((pick) => pick.playerId) }), /not open/);
  const nonmember = await connect(friend.token);
  const deniedFinish = new Promise((resolve) => nonmember.once('error:message', resolve));
  nonmember.emit('league:finishSeason', { code: real.code });
  assert.match((await deniedFinish).error, /not a member/);
  ready = event(seasonSocket, 'league:seasonFinished');
  seasonSocket.emit('league:finishSeason', { code: real.code });
  const finished = await ready;
  assert.equal(finished.stage, 'done');
  assert.equal(finished.viewedStep, 34);
  assert.equal(finished.step.seasonResults.matches, 306);
  assert.equal(finished.step.seasonResults.relegated.length, 2);
  assert.ok(finished.step.seasonResults.scorers.length > 0);
  assert.equal(finished.step.myRecord.w + finished.step.myRecord.d + finished.step.myRecord.l, 34);
  await expectSocketError(() => seasonSocket.emit('league:finishSeason', { code: real.code }), /active single-player/);
  const fullReport = await request('/api/admin/leagues/' + real.code, { token: admin.token });
  assert.equal(fullReport.league.matchday, 34);
  assert.equal(fullReport.clubs.length, 18);
  assert.equal(fullReport.results.matches, 306);
  assert.ok((await request('/api/admin/leagues', { token: admin.token })).some((entry) => entry.code === real.code));
  sockets.forEach((socket) => socket.disconnect());
  await server.stop(); server = await startServer(dbPath, dir);
  assert.equal((await request('/api/auth/login', { body: { username: 'Admin', password: 'test-admin-initial-password' } })).user.id, admin.user.id);
  const finalSocket = await connect(login.token);
  ready = event(finalSocket, 'room:state'); finalSocket.emit('room:join', { code: real.code });
  assert.deepEqual((await ready).myStep.seasonResults, finished.step.seasonResults);
  for (const transferConfig of [{ transferEnabled: false, transferLimit: 3 }, { transferEnabled: true, transferLimit: 0 }]) {
    const noTransfers = await request('/api/rooms/singleplayer', { token: login.token, body: { mode: 'league', leagueId: 'pgl', clubCode, squadMode: 'real', ...transferConfig }, status: 201 });
    assert.equal(noTransfers.transferEnabled, false);
    ready = event(finalSocket, 'room:state'); finalSocket.emit('room:join', { code: noTransfers.code }); await ready;
    ready = event(finalSocket, 'tournament:started'); finalSocket.emit('draft:autoComplete', { code: noTransfers.code }); await ready;
    const early = new Promise(resolve => finalSocket.once('error:message', resolve)); finalSocket.emit('league:finishSeason', { code: noTransfers.code }); assert.match((await early).error, /transfers/);
    ready = event(finalSocket, 'league:midseason'); finalSocket.emit('league:skipToTransfers', { code: noTransfers.code });
    assert.equal((await ready).transfers.phase, 'disabled');
    const blocked = new Promise(resolve => finalSocket.once('error:message', resolve)); finalSocket.emit('league:transfer', { code: noTransfers.code, action: 'skip' }); assert.match((await blocked).error, /not open/);
    ready = event(finalSocket, 'league:seasonFinished'); finalSocket.emit('league:finishSeason', { code: noTransfers.code }); assert.equal((await ready).viewedStep, 34);
    ready = event(finalSocket, 'room:rematchReady'); finalSocket.emit('room:rematch', { code: noTransfers.code });
    const rematchConfig = await request('/api/rooms/' + (await ready).newCode, { token: login.token });
    assert.equal(rematchConfig.transferEnabled, false); assert.equal(rematchConfig.transferLimit, transferConfig.transferLimit);
  }
  for (const bad of [{midseasonTactics:'yes'},{aiTransfers:1}]) await request('/api/rooms/singleplayer',{token:login.token,body:{mode:'league',leagueId:'pgl',clubCode,...bad},status:400});
  const career = await request('/api/rooms/singleplayer', { token: login.token, body: { mode:'league',leagueId:'pgl',clubCode,squadMode:'real',midseasonTactics:true,aiTransfers:true,transferLimit:2,endTransferEnabled:true,endTransferLimit:3,endAiTransfers:false,pglRatingBoost:true }, status:201 });
  assert.equal(career.midseasonTactics,true); assert.equal(career.aiTransfers,true);assert.equal(career.pglRatingBoost,true);
  const careerSocket = await connect(login.token);
  async function careerEvent(name,eventName,body) { const promise=event(careerSocket,eventName);careerSocket.emit(name,{code:career.code,...body});return promise; }
  async function careerError(name,body,pattern) { const promise=new Promise(resolve=>careerSocket.once('error:message',resolve));careerSocket.emit(name,{code:career.code,...body});assert.match((await promise).error,pattern); }
  await careerEvent('room:join','room:state',{});
  await careerEvent('draft:autoComplete','tournament:started',{});
  await careerError('league:tactics',{action:'change',tacticalStyle:'counter'},/Reach mid-season/);
  const half = await careerEvent('league:skipToTransfers','league:midseason',{});
  const basePlayer = require('../src/data/competitions').getPlayer;
  assert.ok(half.transfers.squad.every(player=>player.overall===basePlayer(player.id).overall+10));
  assert.equal(half.transfers.tactics.phase,'choose');assert.ok(half.transfers.log.some(entry=>entry.type==='ai'));
  const initialDeals=half.transfers.log;
  const outsider = await connect(friend.token);
  let denied = new Promise(resolve=>outsider.once('error:message',resolve));outsider.emit('league:tactics',{code:career.code,action:'keep'});assert.match((await denied).error,/Not a member/);
  await careerError('league:nextSeason',{},/Finish your/);
  await careerError('league:tactics',{action:'change',tacticalStyle:'custom:1'},/built-in/);
  const keptSquad=await careerEvent('league:transfer','league:transferState',{action:'skip'});
  assert.equal(keptSquad.transfers.tactics.phase,'choose');
  await careerError('league:finishSeason',{},/tactics/);
  const applied=await careerEvent('league:tactics','league:transferState',{action:'change',tacticalStyle:'counter'});
  assert.equal(applied.transfers.tactics.current,'counter');assert.equal(applied.transfers.tactics.phase,'complete');
  await careerError('league:tactics',{action:'change',tacticalStyle:'vertical'},/not open/);
  const afterChange=await careerEvent('tournament:advance','tournament:step',{});
  const match=afterChange.step.matches.find(match=>match.aCode===clubCode||match.bCode===clubCode);
  assert.equal(match.tactical[match.aCode===clubCode?'A':'B'].key,'counter');
  assert.deepEqual(afterChange.transfers.log,initialDeals);
  const beforeReport=await request('/api/admin/leagues/'+career.code,{token:admin.token});
  const completedCareer=await careerEvent('league:finishSeason','league:seasonFinished',{});
  const oldReport=await request('/api/admin/leagues/'+career.code,{token:admin.token});
  assert.equal(completedCareer.viewedStep,34);
  denied=new Promise(resolve=>outsider.once('error:message',resolve));outsider.emit('league:nextSeason',{code:career.code});assert.match((await denied).error,/Finish your/);
  const continuation=await careerEvent('league:nextSeason','league:nextSeasonReady',{});
  const repeat=await careerEvent('league:nextSeason','league:nextSeasonReady',{});
  assert.equal(continuation.newCode,repeat.newCode);assert.equal(continuation.seasonNumber,2);
  const nextMeta=await request('/api/rooms/'+continuation.newCode,{token:login.token});
  assert.equal(nextMeta.status,'league_stage');assert.equal(nextMeta.midseasonTactics,true);assert.equal(nextMeta.aiTransfers,true);
  assert.equal(nextMeta.pglRatingBoost,true);
  assert.equal(nextMeta.endTransferEnabled,true);assert.equal(nextMeta.endTransferLimit,3);assert.equal(nextMeta.endAiTransfers,false);
  const nextReport=await request('/api/admin/leagues/'+continuation.newCode,{token:admin.token});
  for(const club of nextReport.clubs) {
    const priorClub=oldReport.clubs.find(prior=>prior.code===club.code);
    assert.deepEqual(club.players.filter(player=>player.status==='Starting XI').map(player=>player.id),priorClub.players.filter(player=>player.status==='Starting XI').map(player=>player.id));
    assert.ok(club.players.every(player=>player.stats.appearances===0));
  }
  let promise=event(careerSocket,'room:state');careerSocket.emit('room:join',{code:continuation.newCode});
  const nextState=await promise;
  assert.equal(nextState.league.seasonNumber,2);assert.equal(nextState.league.matchday,0);
  assert.equal(nextState.league.previousSeasons.length,1);assert.equal(nextState.transfers.log.length,0);
  assert.equal(nextState.transfers.tactics.phase,'closed');assert.ok(nextState.league.table.every(row=>row.played===0));
  assert.equal(nextState.transfers.windowType,'endseason');assert.equal(nextState.transfers.phase,'release');
  promise=new Promise(resolve=>careerSocket.once('error:message',resolve));careerSocket.emit('league:skipToTransfers',{code:continuation.newCode});assert.match((await promise).error,/end-of-season/);
  promise=event(careerSocket,'league:transferState');careerSocket.emit('league:transfer',{code:continuation.newCode,action:'release',playerIds:nextState.myLineup.xi.slice(0,3).map(player=>player.id)});
  const endOffers=(await promise).transfers;assert.equal(endOffers.market.length,6);assert.equal(endOffers.squad.length,8);
  const oldAfter=await request('/api/admin/leagues/'+career.code,{token:admin.token});assert.deepEqual(oldAfter,oldReport);
  sockets.forEach(socket=>socket.disconnect());await server.stop();server=await startServer(dbPath,dir);
  const resumeCareer=await connect(login.token);
  promise=event(resumeCareer,'room:state');resumeCareer.emit('room:join',{code:continuation.newCode});
  const endRestored=await promise;assert.equal(endRestored.league.seasonNumber,2);
  assert.ok(endRestored.transfers.market.every(player=>player.overall===basePlayer(player.id).overall+10));
  assert.deepEqual(endRestored.transfers.market,endOffers.market);assert.equal(endRestored.transfers.windowType,'endseason');
  promise=event(resumeCareer,'league:transferState');resumeCareer.emit('league:transfer',{code:continuation.newCode,action:'sign',picks:endOffers.vacancies.map(slot=>({slotCode:slot.code,playerId:endOffers.market.find(player=>player.eligibleSlots.includes(slot.code)).id}))});
  const endSigned=(await promise).transfers;assert.equal(endSigned.squad.length,11);assert.equal(endSigned.cohesion.penaltyPercent,4.5);assert.equal(endSigned.log.length,3);
  assert.ok(endSigned.log.every(entry=>entry.windowType==='endseason'&&entry.matchday===0));
  assert.deepEqual(await request('/api/admin/leagues/'+career.code,{token:admin.token}),oldReport);
  promise=event(resumeCareer,'league:midseason');resumeCareer.emit('league:skipToTransfers',{code:continuation.newCode});await promise;
  promise=event(resumeCareer,'league:transferState');resumeCareer.emit('league:tactics',{code:continuation.newCode,action:'keep'});assert.equal((await promise).transfers.tactics.current,'counter');
  promise=event(resumeCareer,'league:transferState');resumeCareer.emit('league:transfer',{code:continuation.newCode,action:'skip'});await promise;
  promise=event(resumeCareer,'league:seasonFinished');resumeCareer.emit('league:finishSeason',{code:continuation.newCode});await promise;
  promise=event(resumeCareer,'league:nextSeasonReady');resumeCareer.emit('league:nextSeason',{code:continuation.newCode});assert.equal((await promise).seasonNumber,3);
  await request('/api/auth/change-password', { token: admin.token, body: { currentPassword: 'test-admin-initial-password', newPassword: 'changed-admin-password' } });
  await server.stop(); server = await startServer(dbPath, dir);
  await request('/api/auth/login', { body: { username: 'Admin', password: 'test-admin-initial-password' }, status: 401 });
  assert.equal((await request('/api/auth/login', { body: { username: 'Admin', password: 'changed-admin-password' } })).user.role, 'admin');
});
