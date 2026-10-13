const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transferSettings } = require('../src/game/leagueSettings');
const { startLeague, simulateLeagueStep } = require('../src/game/leagueEngine');
const { planTransfer, transferSnapshot, transfersPending } = require('../src/game/leagueTransfers');
const { cohesionSnapshot, startCohesionRecovery, recoverCohesion } = require('../src/game/leagueCohesion');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
const { simulateMatch } = require('../src/game/matchSim');
function season(limit=2, enabled=true) {
 const club=getLeague('pgl').teams[0];
 const state={mode:'league',leagueId:'pgl',transferEnabled:enabled,transferLimit:limit,members:new Map([[1,{userId:1,clubCode:club.code,username:'coach',squad:bestXI(club),formation:'4-3-3',tacticalStyle:'balanced',tacticalStyleLocked:true}]])};
 startLeague(state);state.tournament.matchday=17;return state;
}
test('transfer settings disable zero/closed windows and enforce all 0–3 limits',()=>{
 assert.deepEqual(transferSettings(),{enabled:true,maxChanges:2});
 for(const invalid of [-1,4,1.5,'3',null]) assert.throws(()=>transferSettings(true,invalid),/0 to 3/);
 assert.throws(()=>transferSettings('false',2),/enabled or disabled/);
 for(const [enabled,limit] of [[false,3],[true,0]]) {
  const t=season(limit,enabled).tournament;
  assert.equal(transferSnapshot(t,1,17).phase,'disabled');assert.equal(transfersPending(t),false);
  assert.throws(()=>planTransfer(t,1,'release',{playerIds:[Object.values(t.slotByCode)[0].xi[0].id]}),/not open/);
 }
 for(const limit of [1,2,3]) {
  const state=season(limit),t=state.tournament,team=Object.values(t.slotByCode).find(s=>s.userId===1);
  assert.throws(()=>planTransfer(t,1,'release',{playerIds:team.xi.slice(0,limit+1).map(p=>p.id)}),new RegExp('maximum '+limit));
  const released=planTransfer(t,1,'release',{playerIds:team.xi.slice(0,limit).map(p=>p.id)});
  const signing=transferSnapshot(released,1,17),used=new Set();
  const picks=signing.vacancies.map(slot=>{const p=signing.market.find(p=>p.eligibleSlots.includes(slot.code)&&!used.has(p.id));used.add(p.id);return {slotCode:slot.code,playerId:p.id};});
  assert.throws(()=>planTransfer(released,1,'sign',{picks:picks.slice(1)}),/each vacant position/);
  state.tournament=planTransfer(released,1,'sign',{picks});
  const own=state.tournament.slotByCode[team.code];
  assert.equal(own.xi.length,11);assert.equal(cohesionSnapshot(own).penaltyPercent,limit*1.5);
  assert.equal(transferSnapshot(state.tournament,1,17).cohesion.matchesPlayed,0);
  // Viewing, serialization and snapshots cannot advance recovery.
  state.tournament=JSON.parse(JSON.stringify(state.tournament));
  transferSnapshot(state.tournament,1,17);transferSnapshot(state.tournament,1,17);
  for(let match=0;match<5;match++) {
   const step=simulateLeagueStep(state,()=>{});
   const report=step.matches.find(m=>m.aCode===team.code||m.bCode===team.code);
   const c=report.chemistry[report.aCode===team.code?'A':'B'].rosterCohesion;
   assert.equal(c.matchesPlayed,Math.min(4,match));assert.equal(c.multiplier,cohesionSnapshot({rosterCohesion:{changedPlayers:limit,matchesPlayed:match}}).multiplier);
   assert.equal(transferSnapshot(state.tournament,1,state.tournament.matchday).cohesion.matchesPlayed,Math.min(4,match+1));
  }
  assert.equal(cohesionSnapshot(state.tournament.slotByCode[team.code]).multiplier,1);
  assert.equal(cohesionSnapshot(state.tournament.slotByCode[Object.keys(state.tournament.slotByCode)[1]]).multiplier,1);
 }
 assert.equal(cohesionSnapshot(Object.values(planTransfer(season().tournament,1,'skip').slotByCode)[0]).multiplier,1);
});
test('temporary coordination affects actual league chemistry and disappears after four games',()=>{
 const [club,opp]=getLeague('pgl').teams;
 const own={xi:bestXI(club),formation:'4-3-3',tacticalStyle:'balanced',isHuman:true,morale:0};
 const rival={xi:bestXI(opp),formation:'4-3-3',tacticalStyle:'balanced',isHuman:true,morale:0};
 const base=simulateMatch(own,rival,{stage:'league'}).chemistry.A.multiplier;
 startCohesionRecovery(own,3,17);
 const affected=simulateMatch(own,rival,{stage:'league'});
 assert.equal(affected.chemistry.A.multiplier,base*.955);
 assert.equal(simulateMatch(own,rival,{stage:'group'}).chemistry.A.multiplier,base);
 let previous=affected.chemistry.A.multiplier;
 for(let i=0;i<4;i++) {recoverCohesion(own);const current=simulateMatch(own,rival,{stage:'league'}).chemistry.A.multiplier;assert.ok(current>previous);previous=current;}
 assert.equal(previous,base);
});
