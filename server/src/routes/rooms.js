const express = require('express');
const { requireAuth, requirePlayer } = require('../middleware/auth');
const rm = require('../game/roomManager');
const { openSlots } = require('../game/draftEngine');
const { getLeague } = require('../data/competitions');
const { clubSquadSnapshot } = require('../game/leagueSquads');

const router = express.Router();
router.use(requireAuth, requirePlayer);
router.get('/', (req, res) => res.json({ leagues: rm.listUserLeagues(req.user.id) }));

function serializeRoom(roomRow) {
  const snap = rm.lobbySnapshot(roomRow);
  return {
    ...snap,
    name: roomRow.name,
    mode: roomRow.mode,
    singlePlayer: !!roomRow.single_player,
    creatorId: roomRow.creator_id
  };
}

router.post('/', (req, res) => {
  const { name, humanSlotsMax, showOverall, pickTimeMs, captainEnabled, tournamentLength, allowedTeams, rerollsAllowed, spoilerMode, sharedDraftMode } = req.body || {};
  try {
    const room = rm.createRoom({
      name, creatorId: req.user.id, humanSlotsMax, singlePlayer: false,
      mode: req.body?.mode || 'worldcup', leagueId: req.body?.leagueId,
      showOverall: showOverall !== false, pickTimeMs, captainEnabled: !!captainEnabled,
      tournamentLength, allowedTeams, rerollsAllowed, spoilerMode: !!spoilerMode,
      sharedDraftMode: !!sharedDraftMode
    });
    rm.joinRoom(room, req.user, req.body?.formation);
    res.status(201).json(serializeRoom(room));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/singleplayer', (req, res) => {
  const { showOverall, pickTimeMs, captainEnabled, tournamentLength, allowedTeams, rerollsAllowed } = req.body || {};
  try {
    const mode = req.body?.mode || 'worldcup';
    const leagueId = req.body?.leagueId;
    const clubCode = req.body?.clubCode;
    const squadMode = req.body?.squadMode || 'draft';
    const league = mode === 'league' ? getLeague(leagueId) : null;
    if (mode === 'league' && (!league || !league.teams.some((team) => team.code === clubCode))) throw new Error('choose an available league and club');
    const room = rm.createRoom({
      name: league ? `${league.name} — ${req.user.username}` : `${req.user.username}'s Solo Run`,
      mode, leagueId, squadMode, pglRatingBoost: req.body?.pglRatingBoost, resultsOnly: req.body?.resultsOnly,
      transferEnabled: req.body?.transferEnabled, transferLimit: req.body?.transferLimit,
      midseasonTactics: req.body?.midseasonTactics, aiTransfers: req.body?.aiTransfers,
      endTransferEnabled: req.body?.endTransferEnabled, endTransferLimit: req.body?.endTransferLimit, endAiTransfers: req.body?.endAiTransfers,
      creatorId: req.user.id,
      humanSlotsMax: 1,
      singlePlayer: true,
      showOverall: showOverall !== false,
      pickTimeMs,
      captainEnabled: !!captainEnabled,
      tournamentLength: mode === 'league' ? 'full' : tournamentLength,
      allowedTeams,
      rerollsAllowed,
      spoilerMode: false
    });
    rm.joinRoom(room, req.user, req.body?.formation, clubCode);
    if (squadMode === 'real') rm.initializeRealSquad(room, req.user.id);
    rm.setRoomStatus(room.id, 'drafting');
    const updated = rm.getRoomRow(room.id);
    res.status(201).json(serializeRoom(updated));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:code/join', (req, res) => {
  const room = rm.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  try {
    rm.joinRoom(room, req.user, req.body?.formation);
    const updated = rm.getRoomRow(room.id);
    req.app.get('io')?.to(`room:${updated.code}`).emit('room:memberUpdate', rm.lobbySnapshot(updated));
    res.json(serializeRoom(updated));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:code/formation', (req, res) => {
  const room = rm.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  try {
    rm.setFormation(room, req.user.id, req.body?.formation);
    const updated = rm.getRoomRow(room.id);
    req.app.get('io')?.to(`room:${updated.code}`).emit('room:memberUpdate', rm.lobbySnapshot(updated));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:code/start', (req, res) => {
  const room = rm.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  if (room.creator_id !== req.user.id) return res.status(403).json({ error: 'only the room creator can start the draft' });
  if (room.status !== 'lobby') return res.status(400).json({ error: 'room already started' });
  rm.setRoomStatus(room.id, 'drafting');
  const updated = rm.getRoomRow(room.id);
  req.app.get('io')?.to(`room:${updated.code}`).emit('room:started', {});
  res.json(serializeRoom(updated));
});

router.get('/:code', (req, res) => {
  const room = rm.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  res.json(serializeRoom(room));
});

router.get('/:code/clubs/:clubCode', (req, res) => {
  const room = rm.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  if (!rm.getMembers(room.id).some((member) => member.user_id === req.user.id)) return res.status(403).json({ error: 'not a member of this league' });
  try { res.json(clubSquadSnapshot(rm.loadRoomState(room), req.user.id, req.params.clubCode)); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

router.get('/:code/state', (req, res) => {
  const room = rm.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  const base = serializeRoom(room);

  if (room.status === 'drafting') {
    const state = rm.loadRoomState(room);
    const member = state.members.get(req.user.id);
    base.myDraft = member
      ? { squad: member.squad, slots: member.slots, openSlots: openSlots(member), draftComplete: member.draftComplete }
      : null;
    base.poolRemaining = state.pool.size;
  }
  // Tournament view is fully socket-driven (room:state / tournament:advance) — see sockets/index.js.

  res.json(base);
});

module.exports = router;
