const assert = require('node:assert/strict');

module.exports = async function leagueCareerScenario({ request, event, connect, restart, host, guest, outsider }) {
  const clubs = (await request('/api/leagues')).leagues[0].teams;
  for (const option of [{managerOffers:'true'}, {playerDepartures:2}]) await request('/api/rooms', {token:host.token,status:400,body:{mode:'league',leagueId:'pgl',clubCode:clubs[0].code,...option}});
  const room = await request('/api/rooms', {token:host.token,status:201,body:{mode:'league',leagueId:'pgl',clubCode:clubs[0].code,squadMode:'real',humanSlotsMax:2,transferEnabled:false,endTransferEnabled:false,managerOffers:true,playerDepartures:true}});
  assert.equal(room.managerOffers, true); assert.equal(room.playerDepartures, true);
  await request(`/api/rooms/${room.code}/join`, {token:guest.token,body:{clubCode:clubs[1].code}});
  await request(`/api/rooms/${room.code}/start`, {token:host.token,method:'POST'});
  let a = await connect(host.token), b = await connect(guest.token);
  function pull(client, input, output, code = room.code, body = {}) {
    const ready = event(client, output); client.emit(input,{code,...body}); return ready;
  }
  function denied(client, input, body = {}) {
    const ready = new Promise(resolve=>client.once('error:message',data=>resolve(data.error)));
    client.emit(input,{code:room.code,...body}); return ready;
  }
  for (const client of [a,b]) {
    await pull(client,'room:join','room:state');
    await pull(client,'draft:setTacticalStyle','draft:tacticalStyleSet',room.code,{tacticalStyle:'balanced'});
  }
  await pull(a,'room:startTournament','tournament:started');
  assert.match(await denied(a,'league:managerDecision',{clubCode:null}),/not accepting/);
  for (let day=1;day<=34;day++) {
    await pull(a,'tournament:advance','tournament:step');
    await pull(b,'tournament:advance','tournament:step');
  }
  assert.match(await denied(b,'league:nextSeason'),/Only the host/);
  const guestUpdate = event(b,'league:careerState');
  const hostPlan = (await pull(a,'league:nextSeason','league:careerState')).career;
  const guestPlan = (await guestUpdate).career;
  const offers = [...hostPlan.offers,...guestPlan.offers].map(offer=>offer.code);
  assert.ok(hostPlan.offers.length<=2 && guestPlan.offers.length<=2);
  assert.equal(new Set(offers).size, offers.length);
  assert.ok(offers.every(code=>code!==clubs[0].code && code!==clubs[1].code));
  assert.equal(hostPlan.users, undefined); assert.equal(guestPlan.users, undefined);
  assert.ok((await request('/api/rooms',{token:guest.token})).leagues.some(league=>league.code===room.code && league.betweenSeasons));
  await restart(); a = await connect(host.token); b = await connect(guest.token);
  const restoredA = await pull(a,'room:join','room:state'), restoredB = await pull(b,'room:join','room:state');
  assert.deepEqual(restoredA.career,hostPlan); assert.deepEqual(restoredB.career,guestPlan);
  const stranger = await connect(outsider.token);
  assert.match(await denied(stranger,'league:managerDecision',{clubCode:null}),/Not a member/);
  if (hostPlan.phase==='choose') {
    assert.match(await denied(a,'league:managerDecision',{clubCode:clubs[1].code}),/offered AI club/);
    const waiting = await pull(a,'league:nextSeason','league:careerState');
    assert.equal(waiting.career.ready,false);
    await pull(a,'league:managerDecision','league:careerState',room.code,{clubCode:hostPlan.offers[0].code});
  }
  if (guestPlan.phase==='choose') await pull(b,'league:managerDecision','league:careerState',room.code,{clubCode:null});
  const nextForGuest = event(b,'league:nextSeasonReady');
  const next = await pull(a,'league:nextSeason','league:nextSeasonReady');
  assert.equal((await nextForGuest).newCode,next.newCode);
  const stateA = await pull(a,'room:join','room:state',next.newCode), stateB = await pull(b,'room:join','room:state',next.newCode);
  assert.equal(stateA.myLineup.code,hostPlan.offers[0]?.code || clubs[0].code);
  assert.equal(stateB.myLineup.code,clubs[1].code);
  assert.equal(stateA.seasonNumber,2); assert.equal(stateA.managerOffers,true); assert.equal(stateA.playerDepartures,true);
  assert.equal(stateA.myLineup.xi.length,11); assert.equal(stateB.myLineup.xi.length,11);
  assert.equal(stateA.transfers.phase,'disabled');
  assert.deepEqual(stateA.league.seasonDepartures,hostPlan.departures);
  assert.equal(stateA.league.table.filter(team=>team.isHuman).length,2);
  const members = (await request(`/api/rooms/${next.newCode}`,{token:host.token})).members;
  assert.equal(new Set(members.map(member=>member.clubCode)).size,2);
  const resumable = (await request('/api/rooms',{token:guest.token})).leagues;
  assert.ok(resumable.some(league=>league.code===next.newCode));
  assert.ok(!resumable.some(league=>league.code===room.code));
  const repeated = await pull(a,'league:nextSeason','league:nextSeasonReady');
  assert.equal(repeated.newCode,next.newCode);
  assert.match(await denied(a,'league:managerDecision',{clubCode:clubs[2].code}),/not accepting/);
  assert.equal((await pull(a,'tournament:advance','tournament:step',next.newCode)).viewedStep,1);
  assert.equal((await pull(b,'tournament:advance','tournament:step',next.newCode)).viewedStep,1);
};
