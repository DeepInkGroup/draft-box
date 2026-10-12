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
    env: { ...process.env, PORT: '0', DB_PATH: dbPath, JWT_SECRET: 'deployment-test-secret', CORS_ORIGIN: 'https://deepinkgroup.github.io' },
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

test('hosted app supports accounts, multiplayer, a full solo tournament and persistent SQLite', { timeout: 90000 }, async (t) => {
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
  assert.deepEqual(await request('/api/tactics', { token: owner.token }), []);
  const tactic = await request('/api/tactics', { token: owner.token, body: { name: 'Deployment tactic' }, status: 201 });
  assert.equal(typeof tactic.id, 'number');
  assert.equal((await request('/api/tactics', { token: owner.token })).length, 1);
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
});
