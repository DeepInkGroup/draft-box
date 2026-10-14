const assert = require('node:assert/strict');
const { playerFitsSlot } = require('../src/game/formations');

module.exports = async function multiplayerLeagueScenario({ request, event, connect, restart, host, guest, outsider }) {
  const catalog = (await request('/api/leagues')).leagues[0];
  const [clubA, clubB] = catalog.teams;
  assert.equal(catalog.singlePlayerOnly, false);
  assert.equal(catalog.multiplayerMaxPlayers, 18);
  const capped = await request('/api/rooms', { token: host.token, status: 201, body: { mode: 'league', leagueId: 'pgl', clubCode: clubA.code, humanSlotsMax: 32 } });
  assert.equal(capped.humanSlotsMax, 18);
  const solo = await request('/api/rooms/singleplayer', { token: host.token, status: 201, body: { mode: 'league', leagueId: 'pgl', clubCode: clubA.code, pickTimeMs: 10000 } });
  assert.equal(solo.pickTimeMs, 0);
  const room = await request('/api/rooms', { token: host.token, status: 201, body: {
    mode: 'league', leagueId: 'pgl', clubCode: clubA.code, squadMode: 'real', humanSlotsMax: 2, pickTimeMs: 30000,
    midseasonTactics: true, aiTransfers: true, endAiTransfers: true, endTransferEnabled: true, endTransferLimit: 1,
    tournamentLength: 'quarter', transferLimit: 3
  } });
  assert.equal(room.pickTimeMs, 30000);
  assert.equal(room.tournamentLength, 'full');
  for (const key of ['midseasonTactics', 'aiTransfers', 'endAiTransfers', 'resultsOnly']) assert.equal(room[key], false);
  await request('/api/rooms/' + room.code + '/join', { token: guest.token, status: 400, body: { clubCode: clubA.code } });
  await request('/api/rooms/' + room.code + '/join', { token: guest.token, status: 400, body: { clubCode: 'IRN' } });
  await request('/api/rooms/' + room.code + '/join', { token: guest.token, body: { clubCode: clubB.code, formation: '4-4-2' } });
  await request('/api/rooms/' + room.code + '/join', { token: outsider.token, status: 400, body: { clubCode: catalog.teams[2].code } });
  await request('/api/rooms/' + room.code + '/start', { token: guest.token, status: 403, method: 'POST' });
  await request('/api/rooms/' + room.code + '/start', { token: host.token, method: 'POST' });
  const draftA = (await request('/api/rooms/' + room.code + '/state', { token: host.token })).myDraft;
  const draftB = (await request('/api/rooms/' + room.code + '/state', { token: guest.token })).myDraft;
  assert.equal(draftA.squad.length, 11); assert.equal(draftB.squad.length, 11);
  assert.ok(draftA.squad.every(player => player.team === clubA.code));
  assert.ok(draftB.squad.every(player => player.team === clubB.code));
  assert.equal(new Set([...draftA.squad, ...draftB.squad].map(player => player.id)).size, 22);
  let a = await connect(host.token), b = await connect(guest.token);
  async function pull(client, input, output, code = room.code, payload = {}) {
    const ready = event(client, output); client.emit(input, { code, ...payload }); return ready;
  }
  async function denied(client, input, code = room.code, payload = {}) {
    const ready = new Promise(resolve => client.once('error:message', resolve)); client.emit(input, { code, ...payload }); return (await ready).error;
  }
  await pull(a, 'room:join', 'room:state'); await pull(b, 'room:join', 'room:state');
  await pull(a, 'draft:setTacticalStyle', 'draft:tacticalStyleSet', room.code, { tacticalStyle: 'balanced' });
  await pull(b, 'draft:setTacticalStyle', 'draft:tacticalStyleSet', room.code, { tacticalStyle: 'counter' });
  const startedA = event(a, 'tournament:started'), startedB = event(b, 'tournament:started');
  a.emit('room:startTournament', { code: room.code }); await Promise.all([startedA, startedB]);
  const initialA = await pull(a, 'room:join', 'room:state'), initialB = await pull(b, 'room:join', 'room:state');
  assert.equal(initialA.myLineup.code, clubA.code); assert.equal(initialB.myLineup.code, clubB.code);
  assert.equal(initialA.league.table.filter(team => team.isHuman).length, 2);
  assert.match(await denied(a, 'league:skipToTransfers'), /single-player/);
  assert.match(await denied(a, 'league:finishSeason'), /single-player/);
  assert.match(await denied(a, 'league:tactics', room.code, { action: 'keep' }), /not open/);
  let stepA, stepB;
  for (let day = 1; day <= 17; day++) {
    stepA = await pull(a, 'tournament:advance', 'tournament:step');
    stepB = await pull(b, 'tournament:advance', 'tournament:step');
    assert.equal(stepA.viewedStep, day); assert.equal(stepB.viewedStep, day);
    const byFixture = matches => matches.slice().sort((a, b) => a.aCode.localeCompare(b.aCode));
    assert.deepEqual(byFixture(stepA.step.matches), byFixture(stepB.step.matches));
    assert.deepEqual(stepA.league.table, stepB.league.table);
  }
  assert.equal(stepA.transfers.phase, 'release'); assert.equal(stepB.transfers.phase, 'release');
  await restart(); a = await connect(host.token); b = await connect(guest.token);
  stepA = await pull(a, 'room:join', 'room:state'); stepB = await pull(b, 'room:join', 'room:state');
  assert.equal(stepA.viewedStep, 17); assert.equal(stepB.viewedStep, 17);
  function transfer(client, id, action, payload = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { client.off('league:transferState', listener); reject(new Error('Transfer update timed out')); }, 15000);
      const listener = data => { if (data.userId !== id) return; clearTimeout(timer); client.off('league:transferState', listener); resolve(data.transfers); };
      client.on('league:transferState', listener); client.emit('league:transfer', { code: room.code, action, ...payload });
    });
  }
  const signingA = await transfer(a, host.user.id, 'release', { playerIds: [stepA.transfers.squad[0].id] });
  const guestConnection = await connect(guest.token);
  const signingB = await transfer(guestConnection, guest.user.id, 'release', { playerIds: [stepB.transfers.squad[0].id] });
  assert.equal(new Set([...signingA.market, ...signingB.market].map(player => player.id)).size, 4);
  const picks = snapshot => snapshot.vacancies.map(slot => ({ slotCode: slot.code, playerId: snapshot.market.find(player => player.eligibleSlots.includes(slot.code)).id }));
  const guestNotified = new Promise(resolve => {
    const listener = data => { if (data.userId !== host.user.id) return; b.off('league:transferState', listener); resolve(data); };
    b.on('league:transferState', listener);
  });
  const completeA = await transfer(a, host.user.id, 'sign', { picks: picks(signingA) });
  assert.equal((await guestNotified).userId, host.user.id);
  assert.equal(completeA.phase, 'complete'); assert.equal(completeA.waitingFor[0].userId, guest.user.id);
  assert.match(await denied(a, 'tournament:advance'), /all players/);
  const completeB = await transfer(b, guest.user.id, 'sign', { picks: picks(signingB) });
  assert.equal(completeB.waitingFor.length, 0);
  for (let day = 18; day <= 34; day++) {
    stepA = await pull(a, 'tournament:advance', 'tournament:step');
    stepB = await pull(b, 'tournament:advance', 'tournament:step');
    assert.equal(stepA.viewedStep, day); assert.equal(stepB.viewedStep, day);
    assert.deepEqual(stepA.league.table, stepB.league.table);
  }
  assert.equal(stepA.stage, 'done'); assert.equal(stepB.stage, 'done');
  assert.equal(stepA.step.seasonResults.matches, 306);
  assert.equal(stepB.step.seasonResults.matches, 306);
  assert.match(await denied(b, 'league:nextSeason'), /Only the host/);
  const nextGuest = event(b, 'league:nextSeasonReady');
  const hostConnection = await connect(host.token);
  const next = await pull(hostConnection, 'league:nextSeason', 'league:nextSeasonReady');
  assert.equal((await nextGuest).newCode, next.newCode);
  const continuedA = await pull(a, 'room:join', 'room:state', next.newCode), continuedB = await pull(b, 'room:join', 'room:state', next.newCode);
  assert.equal(continuedA.singlePlayer, false); assert.equal(continuedA.seasonNumber, 2);
  assert.equal(continuedA.transfers.phase, 'release'); assert.equal(continuedB.transfers.phase, 'release');
  assert.equal(continuedA.transfers.maxChanges, 1);
  assert.equal(continuedA.myLineup.xi.length, 11); assert.equal(continuedB.myLineup.xi.length, 11);
  assert.equal(continuedA.league.previousSeasons[0].positions[clubB.code], stepB.league.table.find(team => team.code === clubB.code).rank);
  assert.equal(continuedA.aiTransfers, false); assert.equal(continuedA.midseasonTactics, false);

  // Draft Style uses a shared player pool but keeps each user's club assignment.
  const draftRoom = await request('/api/rooms', { token: host.token, status: 201, body: { mode: 'league', leagueId: 'pgl', clubCode: clubA.code, humanSlotsMax: 2, pickTimeMs: 0, transferEnabled: false } });
  await request('/api/rooms/' + draftRoom.code + '/join', { token: guest.token, body: { clubCode: clubB.code } });
  await request('/api/rooms/' + draftRoom.code + '/start', { token: host.token, method: 'POST' });
  await pull(a, 'room:join', 'room:state', draftRoom.code); await pull(b, 'room:join', 'room:state', draftRoom.code);
  const drafted = new Set();
  for (const client of [a, b]) for (let i = 0; i < 11; i++) {
    const reveal = await pull(client, 'draft:reveal', 'draft:reveal', draftRoom.code);
    const slot = reveal.openSlots.find(slot => reveal.players.some(player => player.available && playerFitsSlot(player, slot)));
    const player = reveal.players.find(player => player.available && playerFitsSlot(player, slot));
    assert.ok(player.id.startsWith('pgl-')); assert.ok(!drafted.has(player.id)); drafted.add(player.id);
    await pull(client, 'draft:pick', 'draft:picked', draftRoom.code, { playerId: player.id, slotCode: slot.code });
  }
  assert.equal(drafted.size, 22);
  await pull(a, 'draft:setTacticalStyle', 'draft:tacticalStyleSet', draftRoom.code, { tacticalStyle: 'balanced' });
  await pull(b, 'draft:setTacticalStyle', 'draft:tacticalStyleSet', draftRoom.code, { tacticalStyle: 'balanced' });
  await pull(a, 'room:startTournament', 'tournament:started', draftRoom.code);
  assert.equal((await pull(b, 'room:join', 'room:state', draftRoom.code)).myLineup.code, clubB.code);
};
