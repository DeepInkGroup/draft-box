const worldCup = require('./teams');
const pgl = require('./pgl.json');

// A registry keeps competition data independent of rooms and player count.
const LEAGUES = new Map([[pgl.id, pgl]]);
const CLUB_BY_CODE = new Map(pgl.teams.map((club) => [club.code, club]));
const LEAGUE_PLAYER_BY_ID = new Map(pgl.teams.flatMap((club) => club.players.map((player) => [player.id, player])));
function getLeague(id) { return LEAGUES.get(id); }
function teamsForRoom(room) {
  if (room.mode !== 'league') return worldCup.ALL_TEAMS;
  const league = getLeague(room.leagueId);
  if (!league) throw new Error('league is not available');
  return league.teams;
}
function getTeam(code) { return CLUB_BY_CODE.get(code) || worldCup.getTeam(code); }
function getPlayer(id) { return LEAGUE_PLAYER_BY_ID.get(id) || worldCup.getPlayer(id); }
function leagueCatalog() {
  return Array.from(LEAGUES.values()).map((league) => ({
    id: league.id, name: league.name, country: league.country, singlePlayerOnly: true,
    squadModes: ['draft', 'real'], transferOptions: { min: 0, max: 3, default: 2, canDisable: true },
    transferWindowAfterMatchday: league.teams.length - (league.teams.length % 2 ? 0 : 1),
    teamCount: league.teams.length, matchdays: 2 * (league.teams.length - (league.teams.length % 2 ? 0 : 1)),
    teams: league.teams.map(({ code, name, players, baseOverall }) => ({ code, name, playerCount: players.length, baseOverall }))
  }));
}
module.exports = { getLeague, teamsForRoom, getTeam, getPlayer, leagueCatalog };
