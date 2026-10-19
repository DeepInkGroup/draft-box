const assert = require('node:assert/strict');
module.exports = async ({ request, event, connect, restart, host, guest }) => {
  const clubs = (await request('/api/leagues')).leagues[0].teams;
  let a = await connect(host.token), b = await connect(guest.token);
  function pull(client, input, output, code, body = {}) { const ready = event(client, output); client.emit(input, {code,...body}); return ready; }
  const one = await request('/api/rooms',{token:host.token,status:201,body:{name:'Old lobby'}});
  const two = await request('/api/rooms',{token:host.token,status:201,body:{name:'Current lobby'}});
  await pull(a,'room:join','room:state',one.code);
  await pull(a,'room:join','room:state',two.code);
  let stale = 0; const listener = () => stale++; a.on('room:started',listener);
  await request(`/api/rooms/${one.code}/start`,{token:host.token,method:'POST'});
  await new Promise(resolve=>setTimeout(resolve,100));
  a.off('room:started',listener); assert.equal(stale,0,'Switching rooms must leave the old broadcast channel');
  const room = await request('/api/rooms',{token:host.token,status:201,body:{mode:'league',leagueId:'pgl',clubCode:clubs[0].code,squadMode:'real',resultsOnly:true,spoilerMode:true,transferLimit:1,endTransferEnabled:false}});
  assert.equal(room.resultsOnly,true); assert.equal(room.spoilerMode,false);
  await request(`/api/rooms/${room.code}/join`,{token:guest.token,body:{clubCode:clubs[1].code}});
  await request(`/api/rooms/${room.code}/start`,{token:host.token,method:'POST'});
  for(const client of [a,b]) {
    await pull(client,'room:join','room:state',room.code);
    await pull(client,'draft:setTacticalStyle','draft:tacticalStyleSet',room.code,{tacticalStyle:'balanced'});
  }
  await pull(a,'room:startTournament','tournament:started',room.code);
  for(let day=1;day<=17;day++) await pull(a,'league:autoplay','league:autoResults',room.code,{afterMatchday:day-1});
  for(let day=1;day<=17;day++) {
    const result=await pull(b,'league:autoplay','league:autoResults',room.code,{afterMatchday:day-1});
    assert.equal(result.viewedStep,day); assert.equal(result.results.length,day);
    assert.ok(result.step.matches.every(match=>!match.events&&!match.lineups));
  }
  await pull(a,'league:transfer','league:transferState',room.code,{action:'skip'});
  assert.equal((await pull(a,'league:autoplay','league:autoResults',room.code,{afterMatchday:17})).viewedStep,17);
  await pull(b,'league:transfer','league:transferState',room.code,{action:'skip'});
  for(let day=18;day<=34;day++) await pull(a,'league:autoplay','league:autoResults',room.code,{afterMatchday:day-1});
  const saved=await pull(b,'room:join','room:state',room.code);
  assert.equal(saved.viewedStep,17); assert.equal(saved.tournamentStage,'league'); assert.equal(saved.results.length,17);
  await restart(); a=await connect(host.token); b=await connect(guest.token);
  const restored=await pull(b,'room:join','room:state',room.code);
  assert.deepEqual(restored.results,saved.results);
  for(let day=18;day<=34;day++) {
    const result=await pull(b,'league:autoplay','league:autoResults',room.code,{afterMatchday:day-1});
    assert.equal(result.viewedStep,day); assert.equal(result.results.length,day);
    assert.equal(result.stage,day===34?'done':'league');
  }
  await pull(a,'room:join','room:state',room.code);
  const peer=event(b,'room:rematchReady');
  const first=await pull(a,'room:rematch','room:rematchReady',room.code);
  assert.equal((await peer).newCode,first.newCode);
  const repeat=await pull(a,'room:rematch','room:rematchReady',room.code);
  assert.equal(repeat.newCode,first.newCode,'Repeated rematch requests must return one saved room');
  const next=await pull(a,'room:join','room:state',first.newCode);
  assert.equal(next.stage,'lobby'); assert.equal(next.resultsOnly,true); assert.equal(next.members.length,2);
  await request(`/api/rooms/${first.newCode}/start`,{token:host.token,method:'POST'});
  const fresh=await pull(a,'room:join','room:state',first.newCode);
  assert.equal(fresh.stage,'drafting'); assert.equal(fresh.myDraft.squad.length,11); assert.equal(fresh.myDraft.tacticalStyleLocked,false);
};
