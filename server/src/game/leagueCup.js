const { simulateMatch } = require('./matchSim');
const { prepareBotForMatch } = require('./botEngine');
const { recoverCohesion } = require('./leagueCohesion');
const CUP_ROUNDS = [
  { stage: 'r16', label: 'Round of 16' }, { stage: 'qf', label: 'Quarterfinals' },
  { stage: 'sf', label: 'Semifinals' }, { stage: 'final', label: 'Final' }
];
function pairTeams(codes) {
  const fixtures = [];
  for (let index = 0; index < codes.length; index += 2) fixtures.push({ aCode: codes[index], bCode: codes[index + 1] });
  return fixtures;
}
function eliminate(state, code) {
  const team = state.tournament.slotByCode[code]; team.eliminated = true;
  const member = state.members.get(team.userId); if (member) member.eliminated = true;
}
function seedLeagueCup(state, table, random = Math.random) {
  const t = state.tournament;
  if (!t.knockoutCup || t.cup) return;
  if (t.matchday !== t.fixtures.length || table.length < 16) throw new Error('Finish the regular season before drawing the cup');
  const qualifiers = table.slice(0, 16).map(team => team.code), draw = qualifiers.slice();
  for (let index = draw.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1)); [draw[index], draw[other]] = [draw[other], draw[index]];
  }
  t.cup = { qualifiers, draw, rounds: [{ ...CUP_ROUNDS[0], fixtures: pairTeams(draw), played: false }], champion: null };
  for (const code of Object.keys(t.slotByCode)) if (!qualifiers.includes(code)) eliminate(state, code);
  t.stage = 'cup_r16';
}
function simulateCupStep(state, simulate = simulateMatch, updateMorale = () => {}) {
  const t = state.tournament, cup = t.cup;
  if (!cup || t.stage === 'done') return null;
  const roundIndex = cup.rounds.findIndex(round => !round.played);
  if (roundIndex < 0) throw new Error('The cup has no pending round');
  const round = cup.rounds[roundIndex], matches = [], winners = [];
  for (const fixture of round.fixtures) {
    const a = t.slotByCode[fixture.aCode], b = t.slotByCode[fixture.bCode];
    prepareBotForMatch(a, b); prepareBotForMatch(b, a);
    const moraleA = a.morale, moraleB = b.morale;
    const result = simulate(a, b, { knockout: true, stage: round.stage });
    if (result.goalsA === result.goalsB && (!result.wentToPenalties || !['A', 'B'].includes(result.penaltyWinner))) throw new Error('A knockout match must have a winner');
    const winnerCode = result.goalsA === result.goalsB ? result.penaltyWinner === 'A' ? a.code : b.code : result.goalsA > result.goalsB ? a.code : b.code;
    const match = { ...fixture, ...result, winnerCode, moraleA, moraleB, cup: true, stage: round.stage, matchday: t.fixtures.length + roundIndex + 1,
      lineups: { A: a.xi.map(player => ({ ...player })), B: b.xi.map(player => ({ ...player })) } };
    matches.push(match); winners.push(winnerCode); eliminate(state, winnerCode === a.code ? b.code : a.code);
    updateMorale(a, result.goalsA, result.goalsB, result.wentToPenalties ? result.penaltyWinner === 'A' : undefined);
    updateMorale(b, result.goalsB, result.goalsA, result.wentToPenalties ? result.penaltyWinner === 'B' : undefined);
    recoverCohesion(a); recoverCohesion(b);
  }
  round.fixtures = matches; round.played = true; t.matchLog.push(...matches);
  if (roundIndex === CUP_ROUNDS.length - 1) { cup.champion = winners[0]; t.stage = 'done'; }
  else { cup.rounds.push({ ...CUP_ROUNDS[roundIndex + 1], fixtures: pairTeams(winners), played: false }); t.stage = 'cup_' + CUP_ROUNDS[roundIndex + 1].stage; }
  const step = { index: t.history.length, type: 'knockout', cup: true, label: 'PGL Knockout Cup - ' + round.label,
    finishedStage: round.stage, matches, eliminatedCodes: matches.map(match => match.winnerCode === match.aCode ? match.bCode : match.aCode),
    champion: t.stage === 'done', competitionFinished: t.stage === 'done' };
  t.history.push(step); return step;
}
function leagueStageAtCursor(t, cursor) {
  if (cursor < t.fixtures.length) return 'league';
  if (!t.knockoutCup) return t.stage;
  const index = cursor - t.fixtures.length;
  return index >= CUP_ROUNDS.length ? 'done' : 'cup_' + CUP_ROUNDS[index].stage;
}
function cupSnapshot(t, cursor) {
  if (!t.knockoutCup) return null;
  const common = { enabled: true, name: 'PGL Knockout Cup', qualifyingTeams: 16, totalRounds: 4 };
  if (!t.cup || cursor < t.fixtures.length) return { ...common, phase: 'pending', rounds: [] };
  const visible = Math.max(0, Math.min(4, cursor - t.fixtures.length));
  const team = code => ({ code, name: t.slotByCode[code].name, isHuman: t.slotByCode[code].isHuman, username: t.slotByCode[code].username });
  const rounds = CUP_ROUNDS.map((info, index) => ({ ...info, played: index < visible,
    matches: index <= visible ? (t.cup.rounds[index]?.fixtures || []).map(match => ({ a: team(match.aCode), b: team(match.bCode),
      ...(index < visible ? { winnerCode: match.winnerCode, goalsA: match.goalsA, goalsB: match.goalsB, wentToExtraTime: match.wentToExtraTime, wentToPenalties: match.wentToPenalties, penalties: match.penalties } : {}) })) : [] }));
  return { ...common, phase: visible === 4 ? 'done' : 'active', completedRounds: visible, qualifiers: t.cup.qualifiers.map(team),
    leagueChampion: team(t.champion), champion: visible === 4 ? team(t.cup.champion) : null, rounds };
}
module.exports = { CUP_ROUNDS, seedLeagueCup, simulateCupStep, cupSnapshot, leagueStageAtCursor };
