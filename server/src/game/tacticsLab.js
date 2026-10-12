const { getLeague } = require('../data/competitions');
const { ALL_TEAMS } = require('../data/teams');
const { bestXI } = require('./botEngine');
const { FORMATIONS } = require('./formations');
const { simulateMatch } = require('./matchSim');
const { tacticPayload, cleanName } = require('./customTactics');

function analyseTactic(body) {
  const teams = body.competition === 'worldcup' ? ALL_TEAMS : getLeague('pgl').teams;
  const own = teams.find((team) => team.code === body.clubCode);
  const opponent = teams.find((team) => team.code === body.opponentCode);
  if (!own || !opponent || own.code === opponent.code) throw new Error('Choose two different teams from the same competition');
  const formation = body.formation || '4-3-3';
  if (!FORMATIONS[formation]) throw new Error('Unknown formation');
  const xi = bestXI(own, formation);
  const opponentXI = bestXI(opponent, '4-3-3');
  if (xi.length !== 11 || opponentXI.length !== 11) throw new Error('These teams cannot field a complete XI in this formation');
  const tactic = { id: 0, name: cleanName(body.tactic?.name) || 'Lab tactic', ...tacticPayload(body.tactic || {}) };
  const samples = Math.max(10, Math.min(100, Math.round(Number(body.samples) || 50)));
  const run = (custom) => {
    const totals = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, xg: 0, xgAgainst: 0, yellowCards: 0, redCards: 0 };
    for (let i = 0; i < samples; i++) {
      const a = { code: own.code, name: own.name, xi: structuredClone(xi), formation, tacticalStyle: custom ? 'custom:0' : 'balanced', customTactic: custom ? tactic : null, isHuman: true, morale: 0 };
      const b = { code: opponent.code, name: opponent.name, xi: structuredClone(opponentXI), formation: '4-3-3', tacticalStyle: 'balanced', isHuman: true, morale: 0 };
      const match = simulateMatch(a, b, { knockout: false, stage: 'league' });
      totals[match.goalsA > match.goalsB ? 'wins' : match.goalsA === match.goalsB ? 'draws' : 'losses']++;
      totals.goalsFor += match.goalsA; totals.goalsAgainst += match.goalsB;
      totals.xg += match.xgA; totals.xgAgainst += match.xgB;
      totals.yellowCards += match.events.filter((event) => event.side === 'A' && event.type === 'yellow').length;
      totals.redCards += match.events.filter((event) => event.side === 'A' && event.type === 'red').length;
    }
    return { ...totals, winRate: +(100 * totals.wins / samples).toFixed(1), xg: +(totals.xg / samples).toFixed(2), xgAgainst: +(totals.xgAgainst / samples).toFixed(2), goalsPerMatch: +(totals.goalsFor / samples).toFixed(2), concededPerMatch: +(totals.goalsAgainst / samples).toFixed(2) };
  };
  return { samples, team: own.name, opponent: opponent.name, formation, normalizedTactic: tactic, candidate: run(true), baseline: run(false) };
}
module.exports = { analyseTactic };
