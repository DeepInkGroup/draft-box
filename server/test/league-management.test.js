const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FORMATIONS, getSlots } = require('../src/game/formations');
const { getLeague } = require('../src/data/competitions');
const { bestXI } = require('../src/game/botEngine');
const { startLeague, simulateLeagueStep } = require('../src/game/leagueEngine');
const { reassignXI, planFormationChange, formationSnapshot } = require('../src/game/leagueFormation');
const { planTacticChange, openEndSeasonTactics } = require('../src/game/leagueMidseason');
const { transferSnapshot, planTransfer } = require('../src/game/leagueTransfers');
const { playAutomaticLeague } = require('../src/game/leagueAutoplay');
const { clubSquadSnapshot } = require('../src/game/leagueSquads');

function season(options = {}) {
  const members = new Map(getLeague('pgl').teams.slice(0,2).map((club,index) => {
    const squad = bestXI(club); squad[3].isCaptain = true;
    return [index + 1, { userId:index+1,username:'coach'+index,clubCode:club.code,squad,formation:'4-3-3',tacticalStyle:'balanced',tacticalStyleLocked:true,captainSlot:squad[3].slotCode,viewedStep:0 }];
  }));
  const state = {mode:'league',leagueId:'pgl',singlePlayer:false,resultsOnly:true,transferEnabled:false,...options,members};
  startLeague(state); return state;
}
test('every formation can change to every other shape with the same eleven players, keeper and captain', () => {
  const xi = season().members.get(1).squad, before = JSON.stringify(xi);
  const captain = xi.find(player=>player.isCaptain).id, keeper = xi.find(player=>player.pos==='GK').id;
  for (const from of Object.keys(FORMATIONS)) {
    const start = reassignXI(xi,'4-3-3',from);
    for (const to of Object.keys(FORMATIONS)) {
      const assigned = reassignXI(start,from,to);
      assert.deepEqual(assigned.map(player=>player.id).sort(),xi.map(player=>player.id).sort());
      assert.deepEqual(assigned.map(player=>player.slotCode),getSlots(to).map(slot=>slot.code));
      assert.equal(assigned.find(player=>player.slotCode==='GK').id,keeper);
      assert.equal(assigned.find(player=>player.isCaptain).id,captain);
      for (const player of assigned) assert.equal(player.pos,xi.find(original=>original.id===player.id).pos);
    }
  }
  assert.equal(JSON.stringify(xi),before);
  assert.throws(()=>reassignXI(xi,'4-3-3','invalid'),/available formation/);
  assert.throws(()=>reassignXI(xi.slice(1),'4-3-3','3-5-2'),/Complete your transfers/);
});
test('independent end-season tactics and mid-season setup windows wait for every user and preserve history', () => {
  const state = season({midseasonTactics:true,endseasonTactics:true,midseasonFormations:true});
  assert.equal(transferSnapshot(state.tournament,1,0).tactics.phase,'closed');
  openEndSeasonTactics(state.tournament);
  const play = id => playAutomaticLeague(state,id,()=>simulateLeagueStep(state,()=>{}));
  assert.equal(play(1),0); assert.equal(state.tournament.matchday,0);
  assert.equal(transferSnapshot(state.tournament,1,0).tactics.windowType,'endseason');
  state.tournament = planTacticChange(state.tournament,1,'change','counter');
  assert.equal(play(1),0);
  state.tournament = planTacticChange(JSON.parse(JSON.stringify(state.tournament)),2,'keep');
  for(let day=1;day<=17;day++) { play(1); play(2); }
  assert.equal(state.tournament.matchday,17);
  const history = JSON.stringify(state.tournament.history);
  assert.equal(formationSnapshot(state.tournament,1,16).phase,'closed');
  assert.equal(transferSnapshot(state.tournament,1,17).tactics.windowType,'midseason');
  state.tournament = planTacticChange(state.tournament,1,'keep');
  state.tournament = planTacticChange(state.tournament,2,'change','vertical');
  assert.equal(play(1),0);
  const code = state.members.get(1).clubCode, original = state.tournament.slotByCode[code].xi;
  state.tournament = planFormationChange(state.tournament,1,'change','5-4-1');
  assert.equal(play(1),0);
  assert.deepEqual(state.tournament.slotByCode[code].xi.map(player=>player.id).sort(),original.map(player=>player.id).sort());
  assert.throws(()=>planFormationChange(state.tournament,1,'change','4-2-4'),/not open/);
  state.tournament = planFormationChange(JSON.parse(JSON.stringify(state.tournament)),2,'keep');
  assert.equal(JSON.stringify(state.tournament.history),history);
  state.members.get(2).viewedStep = 16;
  assert.equal(clubSquadSnapshot(state,2,code).formation,'4-3-3');
  assert.equal(clubSquadSnapshot(state,2,code).tacticalStyle,'Counter Attack');
  assert.equal(clubSquadSnapshot(state,2,state.members.get(2).clubCode).tacticalStyle,'Balanced');
  const opener = state.tournament.history[0].matches.find(match=>match.aCode===code || match.bCode===code);
  assert.equal(opener.tactical[opener.aCode===code?'A':'B'].key,'counter');
  assert.equal(play(1),1); assert.equal(state.tournament.matchday,18);
  const match = state.tournament.history[17].matches.find(match=>match.aCode===code || match.bCode===code);
  assert.deepEqual(match.lineups[match.aCode===code?'A':'B'].map(player=>player.slotCode),getSlots('5-4-1').map(slot=>slot.code));
  assert.throws(()=>planTacticChange(state.tournament,2,'keep'),/not open/);
});
test('formation changes coexist with transfers without vacancies, duplicate players or damaged saved reports', () => {
  const state = season({midseasonFormations:true,transferEnabled:true});
  for(let day=0;day<17;day++) simulateLeagueStep(state,()=>{});
  const before = JSON.stringify(state.tournament.history);
  const squad = transferSnapshot(state.tournament,1,17).squad;
  state.tournament = planTransfer(state.tournament,1,'release',{playerIds:[squad[0].id]});
  assert.equal(formationSnapshot(state.tournament,1,17).canChange,false);
  assert.throws(()=>planFormationChange(state.tournament,1,'change','4-2-4'),/Complete your transfers/);
  const signing = transferSnapshot(state.tournament,1,17);
  state.tournament = planTransfer(state.tournament,1,'sign',{picks:[{slotCode:signing.vacancies[0].code,playerId:signing.market[0].id}]});
  state.tournament = planFormationChange(state.tournament,1,'change','4-2-4');
  state.tournament = planTransfer(state.tournament,2,'skip');
  state.tournament = planFormationChange(state.tournament,2,'keep');
  assert.equal(JSON.stringify(state.tournament.history),before);
  simulateLeagueStep(state,()=>{});
  assert.throws(()=>planFormationChange(season().tournament,1,'keep'),/not open/);
  assert.throws(()=>planFormationChange({...state.tournament,midseasonFormations:false,formationWindow:null},1,'change','4-4-2'),/not open/);
});
