const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { ALL_TEAMS } = require('../data/teams');
const { getLeague } = require('../data/competitions');
const rm = require('../game/roomManager');
const { leagueSnapshot } = require('../game/leagueEngine');
const { clubSquadSnapshot } = require('../game/leagueSquads');
const { seasonResults } = require('../game/leagueResults');
const { activityStatus } = require('../userActivity');
router.use(requireAuth, requireAdmin);
const userFields = 'id, username, email, friend_code AS friendCode, role, created_at AS createdAt, last_login_at, last_seen_at';
function userSummary(user) {
  return { id: user.id, username: user.username, email: user.email, friendCode: user.friendCode, role: user.role,
    createdAt: user.createdAt, lastLogin: user.last_login_at, lastSeen: user.last_seen_at, status: activityStatus(user) };
}
function gameCounts(id) {
  return db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(r.status = 'finished'), 0) AS finished,
    COALESCE(SUM(r.status != 'finished'), 0) AS active FROM room_members m JOIN rooms r ON r.id = m.room_id WHERE m.user_id = ?`).get(id);
}
router.get('/users', (req, res) => {
  const query = String(req.query.search || '').trim().slice(0, 100);
  const role = ['admin', 'user'].includes(req.query.role) ? req.query.role : '';
  const status = ['online', 'recent', 'offline', 'new'].includes(req.query.status) ? req.query.status : '';
  const all = db.prepare(`SELECT ${userFields} FROM users ORDER BY created_at DESC, id DESC`).all().map(userSummary);
  const filtered = all.filter((user) => (!role || user.role === role) && (!status || user.status === status) &&
    (!query || `${user.username} ${user.email} ${user.friendCode}`.toLowerCase().includes(query.toLowerCase())));
  if (req.query.sort === 'name') filtered.sort((a, b) => a.username.localeCompare(b.username));
  if (req.query.sort === 'seen') filtered.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '') || b.id - a.id);
  const pageSize = 20, pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(req.query.page) || 1)));
  res.json({ users: filtered.slice((page - 1) * pageSize, page * pageSize).map((user) => ({ ...user, games: gameCounts(user.id) })),
    total: filtered.length, page, pageSize, pages,
    summary: { total: all.length, online: all.filter((user) => user.status === 'online').length, recent: all.filter((user) => user.status === 'recent').length, admins: all.filter((user) => user.role === 'admin').length } });
});
router.get('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid user ID' });
  const user = db.prepare(`SELECT ${userFields} FROM users WHERE id = ?`).get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const rooms = db.prepare(`SELECT r.code, r.name, r.mode, r.status, r.created_at AS createdAt FROM room_members m
    JOIN rooms r ON r.id = m.room_id WHERE m.user_id = ? ORDER BY r.id DESC LIMIT 10`).all(id);
  res.json({ user: userSummary(user), games: gameCounts(id), rooms });
});
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
