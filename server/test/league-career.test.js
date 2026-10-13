const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startLeague, simulateLeagueStep } = require('../src/game/leagueEngine');
const { transferSnapshot } = require('../src/game/leagueTransfers');
const { planTacticChange, tacticsPending } = require('../src/game/leagueMidseason');
const { runAiTransfers } = require('../src/game/leagueAiTransfers');
const { cohesionSnapshot } = require('../src/game/leagueCohesion');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
function season(options={}) {
 const club=getLeague('pgl').teams[0];
 const member={userId:1,username:'coach',clubCode:club.code,squad:bestXI(club),formation:'4-3-3',tacticalStyle:'balanced',tacticalStyleLocked:true,viewedStep:17};
 const state={mode:'league',leagueId:'pgl',transferEnabled:false,transferLimit:2,...options,members:new Map([[1,member]])};
 startLeague(state);return state;
}
test('optional mid-season tactics pauses independently of transfers and accepts one choice',()=>{
 const state=season({midseasonTactics:true}); const t=state.tournament;
 assert.throws(()=>planTacticChange(t,1,'change','counter'),/not open/);
 t.matchday=17;
 assert.equal(transferSnapshot(t,1,17).phase,'disabled');
 assert.equal(transferSnapshot(t,1,17).tactics.phase,'choose');
 assert.equal(tacticsPending(t),true);
 assert.throws(()=>simulateLeagueStep(state,()=>{}),/mid-season tactic/);
 for(const style of ['invalid','custom:1']) assert.throws(()=>planTacticChange(t,1,'change',style),/built-in/);
 const changed=planTacticChange(t,1,'change','counter');
 assert.equal(Object.values(changed.slotByCode).find(team=>team.userId===1).tacticalStyle,'counter');
 assert.equal(Object.values(t.slotByCode).find(team=>team.userId===1).tacticalStyle,'balanced');
 assert.equal(tacticsPending(changed),false);
 assert.throws(()=>planTacticChange(changed,1,'change','vertical'),/not open/);
 assert.equal(tacticsPending(planTacticChange(t,1,'keep')),false);
 assert.throws(()=>planTacticChange(season().tournament,1,'keep'),/not open/);
 state.tournament=JSON.parse(JSON.stringify(changed));
 const step=simulateLeagueStep(state,()=>{}),code=Object.values(changed.slotByCode).find(team=>team.userId===1).code;
 const match=step.matches.find(match=>match.aCode===code||match.bCode===code);
 assert.equal(match.tactical[match.aCode===code?'A':'B'].key,'counter');
});
test('AI deals preserve ownership, protect humans, keep full XIs and apply recovery once',()=>{
 const original=JSON.stringify(getLeague('pgl'));
 for(const limit of [1,2,3]) {
  const state=season({aiTransfers:true,transferEnabled:true,transferLimit:limit}),t=state.tournament;
  const human=Object.values(t.slotByCode).find(team=>team.isHuman),beforeHuman=JSON.stringify(human.xi);
  const starters=new Set(Object.values(t.slotByCode).flatMap(team=>team.xi.map(player=>player.id)));
  const rosterIds=Object.values(t.clubRosters).flat().map(player=>player.id).sort();
  runAiTransfers(t); assert.equal(t.transferLog.length,0);
  t.matchday=17;runAiTransfers(t);assert.ok(t.transferLog.length>0);
  const involved={};
  for(const entry of t.transferLog) {
   assert.equal(entry.type,'ai');assert.notEqual(entry.from,human.code);assert.notEqual(entry.to,human.code);
   assert.equal(starters.has(entry.player.id),false);
   assert.equal(entry.offeredPlayerIds.length,2);
   assert.ok(entry.offeredPlayerIds.includes(entry.player.id));
   involved[entry.from]=(involved[entry.from]||0)+1;involved[entry.to]=(involved[entry.to]||0)+1;
   assert.ok(t.clubRosters[entry.to].some(player=>player.id===entry.player.id));
   assert.ok(!t.clubRosters[entry.from].some(player=>player.id===entry.player.id));
  }
  assert.ok(Object.values(involved).every(count=>count<=limit));
  assert.equal(JSON.stringify(human.xi),beforeHuman);
  assert.deepEqual(Object.values(t.clubRosters).flat().map(player=>player.id).sort(),rosterIds);
  for(const team of Object.values(t.slotByCode)) {
   assert.equal(team.xi.length,11);assert.equal(new Set(team.xi.map(player=>player.id)).size,11);
   assert.ok(cohesionSnapshot(team).penaltyPercent<=limit*1.5);
  }
  const log=JSON.stringify(t.transferLog);runAiTransfers(t);assert.equal(JSON.stringify(t.transferLog),log);
  const reloaded=JSON.parse(JSON.stringify(t));runAiTransfers(reloaded);assert.equal(JSON.stringify(reloaded.transferLog),log);
  assert.equal(transferSnapshot(t,1,16).log.length,0);
  state.members.get(1).viewedStep=16;
  const first=t.transferLog[0];
  assert.ok(clubSquadSnapshot(state,1,first.to).players.filter(player=>player.status==='Starting XI').some(player=>player.id===first.exchangedPlayer.id));
  state.members.get(1).viewedStep=17;
  assert.ok(clubSquadSnapshot(state,1,first.to).players.filter(player=>player.status==='Starting XI').some(player=>player.id===first.player.id));
 }
 assert.equal(JSON.stringify(getLeague('pgl')),original);
 for(const options of [{aiTransfers:false,transferEnabled:true},{aiTransfers:true,transferEnabled:false},{aiTransfers:true,transferEnabled:true,transferLimit:0}]) {
  const t=season(options).tournament;t.matchday=17;runAiTransfers(t);assert.equal(t.transferLog.length,0);
 }
});
