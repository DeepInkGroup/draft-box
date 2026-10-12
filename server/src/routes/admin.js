const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { ALL_TEAMS } = require('../data/teams');
const { getLeague } = require('../data/competitions');
const rm = require('../game/roomManager');
const { leagueSnapshot } = require('../game/leagueEngine');
const { clubSquadSnapshot } = require('../game/leagueSquads');
const { seasonResults } = require('../game/leagueResults');
router.use(requireAuth, requireAdmin);
router.get('/overview', (req, res) => res.json({
  users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
  rooms: db.prepare('SELECT COUNT(*) AS count FROM rooms').get().count,
  finished: db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE status = 'finished'").get().count,
  tactics: db.prepare('SELECT COUNT(*) AS count FROM custom_tactics').get().count,
  players: ALL_TEAMS.concat(getLeague('pgl').teams).reduce((sum, team) => sum + team.players.length, 0)
}));
router.get('/players', (req, res) => {
  const teams = req.query.competition === 'worldcup' ? ALL_TEAMS : getLeague('pgl').teams;
  res.json({ clubs: teams.map(({ code, name }) => ({ code, name })), players: teams.flatMap((team) => team.players.map((player) => ({ ...player, clubCode: team.code, clubName: team.name }))) });
});
router.get('/leagues', (req, res) => res.json(db.prepare("SELECT r.code, r.name, r.status, u.username AS manager FROM rooms r JOIN users u ON u.id = r.creator_id WHERE r.mode = 'league' ORDER BY r.id DESC LIMIT 100").all()));
router.get('/leagues/:code', (req, res) => {
  const room = rm.getRoomByCode(req.params.code);
  if (!room || room.mode !== 'league') return res.status(404).json({ error: 'League not found' });
  const state = rm.loadRoomState(room);
  if (state.tournament?.kind !== 'league') return res.status(400).json({ error: 'This season has not started' });
  const t = state.tournament;
  // A separate viewer map gives admins complete analysis without changing anyone's progress.
  const analysisState = { ...state, members: new Map([[req.user.id, { viewedStep: t.matchday }]]) };
  res.json({ name: t.leagueName, league: leagueSnapshot(t, t.matchday), results: seasonResults(t),
    clubs: Object.keys(t.slotByCode).map((code) => clubSquadSnapshot(analysisState, req.user.id, code)) });
});
module.exports = router;
