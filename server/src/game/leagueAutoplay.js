const { transfersPending } = require('./leagueTransfers');
const { tacticsPending } = require('./leagueMidseason');
const { formationsPending } = require('./leagueFormation');

function managementPending(t) {
  return transfersPending(t) || tacticsPending(t) || formationsPending(t);
}
// Return one completed matchday at a time so the browser can present each result.
// An expected cursor prevents delayed or duplicate requests from skipping ahead.
function playAutomaticLeague(state, userId, saveRound, afterMatchday) {
  if (state.mode !== 'league' || !state.resultsOnly || state.tournament?.kind !== 'league') throw new Error('Automatic results are only available in results-only leagues');
  const member = state.members.get(userId);
  if (!member) throw new Error('Not a member of this league');
  const t = state.tournament;
  if (afterMatchday !== undefined && (!Number.isInteger(afterMatchday) || afterMatchday < 0)) throw new Error('Invalid matchday cursor');
  let rounds = 0;
  if (afterMatchday !== undefined && afterMatchday !== member.viewedStep) return 0;
  // Each user sees every saved round, even if another user's browser is ahead.
  if (member.viewedStep < t.matchday) { member.viewedStep++; return 0; }
  if (t.stage !== 'done' && !managementPending(t)) {
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
