const { transfersPending } = require('./leagueTransfers');
const { tacticsPending } = require('./leagueMidseason');

function managementPending(t) {
  return transfersPending(t) || tacticsPending(t);
}
// Run normal rounds, with the caller saving each one. Never choose a transfer or
// tactic on the user's behalf. A repeated request cannot replay saved matches.
function playAutomaticLeague(state, userId, saveRound) {
  if (state.mode !== 'league' || !state.singlePlayer || !state.resultsOnly || state.tournament?.kind !== 'league') throw new Error('Automatic results are only available in results-only single-player leagues');
  const member = state.members.get(userId);
  if (!member) throw new Error('Not a member of this league');
  const t = state.tournament;
  let rounds = 0;
  while (t.stage !== 'done' && !managementPending(t)) {
    saveRound();
    rounds++;
  }
  member.viewedStep = t.matchday;
  return rounds;
}
function scoreResult(t, match) {
  const a = t.slotByCode[match.aCode], b = t.slotByCode[match.bCode];
  return { aCode: a.code, bCode: b.code, aName: a.name, bName: b.name,
    aHuman: a.isHuman, bHuman: b.isHuman, aUsername: a.username, bUsername: b.username,
    goalsA: match.goalsA, goalsB: match.goalsB, winnerCode: match.winnerCode };
}
function leagueScoreResults(t, throughMatchday) {
  if (t?.kind !== 'league') return [];
  return t.history.slice(0, throughMatchday).map(round => ({ matchday: round.matchday, matches: round.matches.map(match => scoreResult(t,match)) }));
}
function resultsOnlyStep(t, step) {
  if (!step) return step;
  const { myMatchAnalyses, ...result } = step;
  return { ...result, matches: step.matches.map(match => scoreResult(t,match)) };
}
module.exports = { playAutomaticLeague, leagueScoreResults, resultsOnlyStep, managementPending };
