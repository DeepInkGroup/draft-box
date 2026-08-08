const raw = require('./teams2026.json');

const ALL_TEAMS = raw.teams; // [{id, name, code, baseOverall, players:[{id,name,team,pos,overall,isStar}]}]

const TEAM_BY_CODE = new Map(ALL_TEAMS.map((t) => [t.code, t]));
const PLAYER_BY_ID = new Map();
for (const team of ALL_TEAMS) {
  for (const p of team.players) PLAYER_BY_ID.set(p.id, p);
}

function getTeam(code) {
  return TEAM_BY_CODE.get(code);
}

function getPlayer(playerId) {
  return PLAYER_BY_ID.get(playerId);
}

function allPlayerIds() {
  return Array.from(PLAYER_BY_ID.keys());
}

module.exports = { ALL_TEAMS, getTeam, getPlayer, allPlayerIds };
