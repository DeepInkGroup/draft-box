const {test} = require('node:test');
const assert = require('node:assert/strict');
const {getLeague} = require('../src/data/competitions');
const {bestXI} = require('../src/game/botEngine');
const {startLeague,simulateLeagueStep,leagueSnapshot} = require('../src/game/leagueEngine');
const {playAutomaticLeague,leagueScoreResults,resultsOnlyStep} = require('../src/game/leagueAutoplay');
const {planTransfer,transferSnapshot,openEndSeasonTransfers} = require('../src/game/leagueTransfers');
const {planTacticChange} = require('../src/game/leagueMidseason');
function season(options={}) {
  const club=getLeague('pgl').teams[0];
  const member={userId:1,username:'coach',clubCode:club.code,squad:bestXI(club),formation:'4-3-3',tacticalStyle:'balanced',tacticalStyleLocked:true,viewedStep:0};
  const state={mode:'league',leagueId:'pgl',singlePlayer:true,resultsOnly:true,transferEnabled:false,...options,members:new Map([[1,member]])};
  startLeague(state);return state;
}
const play=(state,cursor)=>playAutomaticLeague(state,1,()=>simulateLeagueStep(state,()=>{}),cursor);
const playToPause=state=>{let rounds=0;while(play(state))rounds++;return rounds;};
test('automatic results finish a season without match decisions and never replay saved rounds',()=>{
  const state=season();assert.equal(play(state,0),1);assert.equal(state.tournament.matchday,1);
  assert.equal(play(state,0),0);assert.equal(state.tournament.matchday,1);
  const seen=[1];while(play(state))seen.push(state.tournament.matchday);
  assert.deepEqual(seen,Array.from({length:34},(_,i)=>i+1));
  const t=state.tournament;
  assert.equal(t.matchLog.length,306);assert.equal(state.members.get(1).viewedStep,34);
  const saved=JSON.stringify(t);assert.equal(play(state),0);assert.equal(JSON.stringify(t),saved);
  const scores=leagueScoreResults(t,17);assert.equal(scores.length,17);assert.equal(scores.flatMap(round=>round.matches).length,153);
  assert.ok(scores.flatMap(round=>round.matches).every(match=>!('events' in match)&&!('lineups' in match)&&Number.isInteger(match.goalsA)));
  const result=resultsOnlyStep(t,{matches:t.history[0].matches,myMatchAnalyses:[{commentary:true}]});
  assert.equal(result.myMatchAnalyses,undefined);assert.equal(result.matches.length,9);
  for(const options of [{resultsOnly:false},{mode:'worldcup'}]) assert.throws(()=>playAutomaticLeague({...state,...options},1,()=>{}),/only available/);
  assert.throws(()=>playAutomaticLeague(state,2,()=>{}),/Not a member/);
});
test('automatic fixtures respect each management window and resume after choices without losing reports',()=>{
  const state=season({transferEnabled:true,midseasonTactics:true,endTransferEnabled:true,endTransferLimit:3});
  openEndSeasonTransfers(state.tournament);assert.equal(play(state),0);
  state.tournament=planTransfer(state.tournament,1,'skip');assert.equal(playToPause(state),17);
  const firstHalf=JSON.stringify(state.tournament.matchLog);
  assert.equal(play(state),0);
  state.tournament=planTacticChange(state.tournament,1,'keep');assert.equal(play(state),0);
  const snapshot=transferSnapshot(state.tournament,1,17);
  state.tournament=planTransfer(state.tournament,1,'release',{playerIds:[snapshot.squad[0].id]});
  assert.equal(play(state),0);
  const signing=transferSnapshot(state.tournament,1,17);
  state.tournament=planTransfer(state.tournament,1,'sign',{picks:[{slotCode:signing.vacancies[0].code,playerId:signing.market[0].id}]});
  assert.equal(playToPause(state),17);assert.equal(state.tournament.stage,'done');
  assert.equal(JSON.stringify(state.tournament.matchLog.slice(0,153)),firstHalf);
  assert.equal(state.tournament.slotByCode[snapshot.squad[0].team]?.xi.length,11);
});

test('online automatic results replay each saved round per user and pause until all transfers finish',()=>{
  const state=season({singlePlayer:false,transferEnabled:true});
  const club=getLeague('pgl').teams[1];
  state.members.set(2,{...state.members.get(1),userId:2,username:'peer',clubCode:club.code,squad:bestXI(club),viewedStep:0});
  startLeague(state);
  const before = leagueSnapshot(state.tournament, 0);
  assert.deepEqual(before.table.filter(row => row.isHuman).map(row => row.username).sort(), ['coach','peer']);
  for (const fixture of before.nextFixtures) {
    for (const side of ['a','b']) {
      const club = state.tournament.slotByCode[fixture[side+'Code']];
      assert.equal(fixture[side+'Human'], club.isHuman);
      assert.equal(fixture[side+'Username'], club.username);
    }
  }
  assert.equal(playToPause(state),17);
  assert.equal(state.members.get(2).viewedStep,0);
  for(let day=1;day<=17;day++) {
    assert.equal(playAutomaticLeague(state,2,()=>{throw Error('must replay saved round');},day-1),0);
    assert.equal(state.members.get(2).viewedStep,day);
  }
  state.tournament=planTransfer(state.tournament,1,'skip');assert.equal(play(state,17),0);
  state.tournament=planTransfer(state.tournament,2,'skip');assert.equal(playToPause(state),17);
  const snapshot=JSON.stringify(state.tournament);
  for(let day=18;day<=34;day++) {
    playAutomaticLeague(state,2,()=>{throw Error('finished season must not simulate again');},day-1);
    assert.equal(state.members.get(2).viewedStep,day);
  }
  assert.equal(JSON.stringify(state.tournament),snapshot);
  playAutomaticLeague(state,2,()=>{throw Error('stale request');},0);
  assert.equal(state.members.get(2).viewedStep,34);
});
