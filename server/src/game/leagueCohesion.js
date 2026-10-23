const RECOVERY_MATCHES = 4;
const PENALTY_PER_PLAYER = 0.015;
function cohesionSnapshot(team) {
  const state = team?.rosterCohesion?.changedAfterMatchday === 0 ? null : team?.rosterCohesion;
  const changedPlayers = state?.changedPlayers || 0;
  const played = Math.min(RECOVERY_MATCHES, Math.max(0, state?.matchesPlayed || 0));
  const penalty = changedPlayers * PENALTY_PER_PLAYER * (1 - played / RECOVERY_MATCHES);
  return { changedPlayers, matchesPlayed: played, recoveryMatches: RECOVERY_MATCHES,
    matchesRemaining: changedPlayers ? RECOVERY_MATCHES - played : 0,
    penaltyPercent: +(penalty * 100).toFixed(3), multiplier: +(1 - penalty).toFixed(6) };
}
function startCohesionRecovery(team, changedPlayers, matchday) {
  if (matchday <= 0) { team.rosterCohesion = null; return; }
  team.rosterCohesion = { changedPlayers, matchesPlayed: 0, changedAfterMatchday: matchday };
}
function recoverCohesion(team) {
  if (team.rosterCohesion) team.rosterCohesion.matchesPlayed = Math.min(RECOVERY_MATCHES, team.rosterCohesion.matchesPlayed + 1);
}
function cohesionAtMatchday(team, matchday) {
  if (!team?.rosterCohesion) return cohesionSnapshot(team);
  const state = team.rosterCohesion;
  if (matchday < state.changedAfterMatchday) return cohesionSnapshot(null);
  return cohesionSnapshot({ rosterCohesion: { ...state, matchesPlayed: Math.min(state.matchesPlayed, Math.max(0, matchday - state.changedAfterMatchday)) } });
}
module.exports = { cohesionSnapshot, startCohesionRecovery, recoverCohesion, cohesionAtMatchday };
