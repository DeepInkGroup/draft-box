const assert = require('node:assert/strict');
const { startLeague } = require('../server/src/game/leagueEngine');
const { simulateNextStep } = require('../server/src/game/tournamentEngine');
const { getLeague } = require('../server/src/data/competitions');
const { bestXI } = require('../server/src/game/botEngine');
const { simulateMatch } = require('../server/src/game/matchSim');

const seasons = Number(process.argv[2] || 12);
assert.ok(Number.isInteger(seasons) && seasons >= 1 && seasons <= 100, 'Choose 1 to 100 seasons');
let randomState = 4120;
const originalRandom = Math.random;
Math.random = () => { randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0; return randomState / 4294967296; };
try {
  const totals = { matches: 0, goals: 0, draws: 0, homeWins: 0, awayWins: 0 };
  for (let season = 0; season < seasons; season++) {
    const state = { mode: 'league', leagueId: 'pgl', transferEnabled: false, members: new Map() };
    startLeague(state);
    for (let day = 0; day < 34; day++) for (const match of simulateNextStep(state).matches) {
      totals.matches++; totals.goals += match.goalsA + match.goalsB;
      totals.draws += match.goalsA === match.goalsB;
      totals.homeWins += match.goalsA > match.goalsB; totals.awayWins += match.goalsA < match.goalsB;
    }
  }
  const club = getLeague('pgl').teams[0];
  const base = { xi: bestXI(club), formation: '4-3-3', tacticalStyle: 'balanced', isHuman: false };
  for (let seed = 1; seed <= 100; seed++) {
    randomState = seed; const ai = simulateMatch(base, base, { stage: 'league' });
    randomState = seed; const human = simulateMatch({ ...base, isHuman: true }, base, { stage: 'league' });
    assert.deepEqual([human.goalsA, human.goalsB, human.xgA, human.xgB], [ai.goalsA, ai.goalsB, ai.xgA, ai.xgB]);
  }
  const report = { seasons, matches: totals.matches, goalsPerMatch: +(totals.goals / totals.matches).toFixed(3),
    drawPercent: +(100 * totals.draws / totals.matches).toFixed(2), homeWinPercent: +(100 * totals.homeWins / totals.matches).toFixed(2),
    awayWinPercent: +(100 * totals.awayWins / totals.matches).toFixed(2), identicalSquadHumanAiChecks: 100 };
  assert.ok(report.goalsPerMatch > 1.7 && report.goalsPerMatch < 3.5, JSON.stringify(report));
  if (seasons >= 10) assert.ok(report.homeWinPercent > report.awayWinPercent && report.homeWinPercent - report.awayWinPercent < 15, JSON.stringify(report));
  console.log(JSON.stringify(report, null, 2));
} finally { Math.random = originalRandom; }
