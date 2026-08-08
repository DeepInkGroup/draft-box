const express = require('express');
const { requireAuth } = require('../middleware/auth');
const rm = require('../game/roomManager');
const { openSlots } = require('../game/draftEngine');

const router = express.Router();
router.use(requireAuth);

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
  const { name, humanSlotsMax, showOverall } = req.body || {};
  const room = rm.createRoom({ name, creatorId: req.user.id, humanSlotsMax, singlePlayer: false, showOverall: showOverall !== false });
  rm.joinRoom(room, req.user, req.body?.formation);
  res.status(201).json(serializeRoom(room));
});

router.post('/singleplayer', (req, res) => {
  const { showOverall } = req.body || {};
  const room = rm.createRoom({
    name: `${req.user.username}'s Solo Run`,
    creatorId: req.user.id,
    humanSlotsMax: 1,
    singlePlayer: true,
    showOverall: showOverall !== false
  });
  rm.joinRoom(room, req.user, req.body?.formation);
  rm.setRoomStatus(room.id, 'drafting');
  const updated = rm.getRoomRow(room.id);
  res.status(201).json(serializeRoom(updated));
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
