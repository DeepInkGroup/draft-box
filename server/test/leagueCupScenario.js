const assert = require('node:assert/strict');
module.exports = async ({ request, event, connect, restart, host, guest }) => {
  const clubs = (await request('/api/leagues')).leagues[0].teams;
  const body = { mode: 'league', leagueId: 'pgl', clubCode: clubs[0].code, squadMode: 'real', transferEnabled: false, knockoutCup: true };
  for (const invalid of [{ ...body, knockoutCup: 'true' }, { mode: 'worldcup', knockoutCup: true }]) {
    await request('/api/rooms', { token: host.token, status: 400, body: invalid });
    await request('/api/rooms/singleplayer', { token: host.token, status: 400, body: invalid });
  }
  const pull = (client, input, output, code, data = {}) => { const pending = event(client, output); client.emit(input, { code, ...data }); return pending; };
  const denied = async (client, input, code, pattern) => {
    const pending = new Promise(resolve => client.once('error:message', resolve));
    client.emit(input, { code }); assert.match((await pending).error, pattern);
  };
  let a = await connect(host.token), b = await connect(guest.token);
  const solo = await request('/api/rooms/singleplayer', { token: host.token, status: 201, body });
  assert.equal(solo.knockoutCup, true);
  await pull(a, 'room:join', 'room:state', solo.code);
  await pull(a, 'draft:autoComplete', 'tournament:started', solo.code);
  await pull(a, 'league:skipToTransfers', 'league:midseason', solo.code);
  const draw = await pull(a, 'league:finishSeason', 'league:seasonFinished', solo.code);
  assert.equal(draw.viewedStep, 34); assert.equal(draw.stage, 'cup_waiting'); assert.equal(draw.league.cup.phase, 'ready');
  assert.equal(draw.league.cup.qualifiers.length, 16); assert.equal(draw.league.cup.rounds[0].matches.length, 8);
  assert.equal(draw.step.seasonResults.matches, 306); assert.equal(draw.step.competitionFinished, false);
  assert.equal((await request('/api/rooms/' + solo.code, { token: host.token })).status, 'league_stage');
  await denied(a, 'league:nextSeason', solo.code, /Finish/);
  await denied(a, 'room:rematch', solo.code, /not finished/);
  await restart(); a = await connect(host.token); b = await connect(guest.token);
  const restored = await pull(a, 'room:join', 'room:state', solo.code);
  assert.deepEqual(restored.league.cup, draw.league.cup);
  await denied(a, 'tournament:advance', solo.code, /owner must start/);
  const opened = await pull(a, 'league:startCup', 'league:cupStarted', solo.code);
  assert.equal(opened.league.cup.phase, 'active');
  assert.deepEqual((await pull(a, 'league:startCup', 'league:cupStarted', solo.code)).league.cup, opened.league.cup);
  for (const [index, count] of [8, 4, 2, 1].entries()) {
    const result = await pull(a, 'tournament:advance', 'tournament:step', solo.code);
    assert.equal(result.viewedStep, 35 + index); assert.equal(result.step.matches.length, count);
    assert.equal(result.league.matchday, 34); assert.equal(result.step.cup, true);
    if (index === 3) { assert.ok(result.league.cup.champion); assert.equal(result.step.seasonResults.matches, 306); }
  }
  const next = await pull(a, 'league:nextSeason', 'league:nextSeasonReady', solo.code);
  assert.equal((await request('/api/rooms/' + next.newCode, { token: host.token })).knockoutCup, true);
  const fresh = await pull(a, 'room:join', 'room:state', next.newCode);
  assert.equal(fresh.league.cup.phase, 'pending'); assert.equal(fresh.viewedStep, 0);
  assert.ok(fresh.league.previousSeasons[0].cupChampion);
  assert.deepEqual(fresh.league.headCoaches, restored.league.headCoaches);
  assert.deepEqual(fresh.league.freeAgentCoaches, restored.league.freeAgentCoaches);
  assert.deepEqual(fresh.league.coachChanges, []);

  const online = await request('/api/rooms', { token: host.token, status: 201, body: { ...body, resultsOnly: true } });
  await request(`/api/rooms/${online.code}/join`, { token: guest.token, body: { clubCode: clubs[1].code } });
  await request(`/api/rooms/${online.code}/start`, { token: host.token, method: 'POST' });
  for (const client of [a, b]) {
    await pull(client, 'room:join', 'room:state', online.code);
    await pull(client, 'draft:setTacticalStyle', 'draft:tacticalStyleSet', online.code, { tacticalStyle: 'balanced' });
  }
  await pull(a, 'room:startTournament', 'tournament:started', online.code);
  let last;
  for (let cursor = 0; cursor < 34; cursor++) {
    last = await pull(b, 'league:autoplay', 'league:autoResults', online.code, { afterMatchday: cursor });
    assert.equal(last.viewedStep, cursor + 1);
  }
  assert.equal(last.stage, 'cup_waiting'); assert.equal(last.league.cup.phase, 'ready');
  assert.equal((await pull(b, 'league:autoplay', 'league:autoResults', online.code, { afterMatchday: 34 })).viewedStep, 34);
  await denied(b, 'league:startCup', online.code, /Only the competition owner/);
  await denied(a, 'league:startCup', online.code, /View the final league results/);
  const behind = await pull(a, 'room:join', 'room:state', online.code);
  assert.equal(behind.tournamentStage, 'league'); assert.equal(behind.league.cup.phase, 'pending');
  for (let cursor = 0; cursor < 34; cursor++) await pull(a, 'league:autoplay', 'league:autoResults', online.code, { afterMatchday: cursor });
  const slowDraw = await pull(a, 'room:join', 'room:state', online.code);
  assert.equal(slowDraw.tournamentStage, 'cup_waiting'); assert.equal(slowDraw.league.cup.champion, null);
  assert.ok(slowDraw.league.cup.rounds[0].matches.every(match => !('winnerCode' in match)));
  assert.deepEqual(slowDraw.league.cup.rounds.slice(1).map(round => round.matches), [[], [], []]);
  await restart(); a = await connect(host.token); b = await connect(guest.token);
  assert.deepEqual((await pull(a, 'room:join', 'room:state', online.code)).league.cup, slowDraw.league.cup);
  await pull(b, 'room:join', 'room:state', online.code);
  const peerStart = event(b, 'league:cupStarted');
  await pull(a, 'league:startCup', 'league:cupStarted', online.code); assert.equal((await peerStart).league.cup.phase, 'active');
  for (let cursor = 34; cursor < 38; cursor++) last = await pull(b, 'league:autoplay', 'league:autoResults', online.code, { afterMatchday: cursor });
  assert.equal(last.stage, 'done'); assert.equal(last.results.length, 38);
  assert.deepEqual(last.results.slice(34).map(round => round.matches.length), [8, 4, 2, 1]);
  assert.ok(last.results.flatMap(round => round.matches).every(match => !match.events && !match.lineups));
  await denied(a, 'league:nextSeason', online.code, /View the cup final/);
  for (let cursor = 34; cursor < 38; cursor++) await pull(a, 'league:autoplay', 'league:autoResults', online.code, { afterMatchday: cursor });
  const done = await pull(a, 'room:join', 'room:state', online.code);
  assert.deepEqual(done.league.cup, last.league.cup); assert.equal(done.tournamentStage, 'done');
  const rematch = await pull(a, 'room:rematch', 'room:rematchReady', online.code);
  const lobby = await request('/api/rooms/' + rematch.newCode, { token: host.token });
  assert.equal(lobby.knockoutCup, true); assert.equal(lobby.resultsOnly, true); assert.equal(lobby.status, 'lobby');
};
