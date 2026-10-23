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
  return league.teams.map(club => ratedClub(club, room));
}
function ratedPlayer(player, room) {
  if (!player || !room?.pglRatingBoost || room.leagueId !== 'pgl') return player;
  const base = LEAGUE_PLAYER_BY_ID.get(player.id);
  return base ? { ...player, baseOverall: base.overall, overall: base.overall + 10 } : player;
}
function ratedClub(club, room) {
  if (!club || !room?.pglRatingBoost || room.leagueId !== 'pgl') return club;
  const base = CLUB_BY_CODE.get(club.code);
  if (!base) return club;
  return { ...club, baseOverall: base.baseOverall + 10, players: club.players.map(player => ratedPlayer(player, room)) };
}
function getTeam(code, room) { return ratedClub(CLUB_BY_CODE.get(code) || worldCup.getTeam(code), room); }
function getPlayer(id) { return LEAGUE_PLAYER_BY_ID.get(id) || worldCup.getPlayer(id); }
function leagueCatalog() {
  return Array.from(LEAGUES.values()).map((league) => ({
    id: league.id, name: league.name, country: league.country, singlePlayerOnly: false,
    multiplayerAvailable: true, multiplayerVersion: 2, multiplayerMaxPlayers: league.teams.length,
    multiplayerOptions: { aiTransfers: false, midseasonTactics: true, endseasonTactics: true, midseasonFormations: true, resultsOnly: true, humanTransfers: true, continuousSeasons: true },
    knockoutCupAvailable: league.id === 'pgl', knockoutCupVersion: 2, knockoutCupOwnerStart: true, coachManagementVersion: 1, transferChemistry: { midseason: true, endseason: false, recoveryMatches: 4 },
    knockoutCupFormat: { qualifyingTeams: 16, rounds: ['r16', 'qf', 'sf', 'final'], singleElimination: true, randomDraw: true },
    careerOptions: { managerOffers: true, maxManagerOffers: 2, playerDepartures: true, maxDeparturesPerClub: 2, poorResultsBottomFraction: 1 / 3 },
    squadModes: ['draft', 'real'], pglRatingBoostAvailable: league.id === 'pgl', transferOptions: { min: 1, max: 3, default: 2, canDisable: true },
    resultsOnlyAvailable: true, resultsOnlyVersion: 2, standingsLayoutVersion: 3, squadBrowserVersion: 2, midseasonTacticsAvailable: true, endseasonTacticsAvailable: true, midseasonFormationsAvailable: true, aiTransfersAvailable: true, continuousSeasons: true, endSeasonTransfersAvailable: true, transferOfferCount: 2,
    transferWindowAfterMatchday: league.teams.length - (league.teams.length % 2 ? 0 : 1),
    teamCount: league.teams.length, matchdays: 2 * (league.teams.length - (league.teams.length % 2 ? 0 : 1)),
    freeAgentCoaches: league.freeAgentCoaches || [],
    teams: league.teams.map(({ code, name, players, baseOverall, headCoach, logo }) => ({ code, name, headCoach, logo, playerCount: players.length, baseOverall }))
  }));
}
module.exports = { getLeague, teamsForRoom, getTeam, getPlayer, leagueCatalog, ratedPlayer, ratedClub };
