const db = require('../db');
const { allPlayerIds, getPlayer } = require('../data/teams');
const { isValidFormation, getSlots } = require('./formations');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

function genCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function uniqueCode() {
  for (let i = 0; i < 50; i++) {
    const code = genCode();
    const existing = db.prepare('SELECT id FROM rooms WHERE code = ?').get(code);
    if (!existing) return code;
  }
  throw new Error('could not generate a unique room code');
}

// active in-memory runtime state, keyed by room id. Rebuilt from DB on first access after a restart.
const activeRooms = new Map();

const ALLOWED_PICK_TIMES_MS = [10000, 20000, 30000, 60000];

function normalizePickTime(ms) {
  const n = Number(ms);
  return ALLOWED_PICK_TIMES_MS.includes(n) ? n : 20000;
}

function createRoom({ name, creatorId, humanSlotsMax, singlePlayer, showOverall = true, pickTimeMs, captainEnabled = false }) {
  const code = uniqueCode();
  const cappedSlots = Math.max(1, Math.min(32, Number(humanSlotsMax) || 32));
  const info = db
    .prepare(
      `INSERT INTO rooms (code, name, creator_id, mode, human_slots_max, single_player, show_overall, pick_time_ms, captain_enabled, status)
       VALUES (?, ?, ?, 'worldcup', ?, ?, ?, ?, ?, 'lobby')`
    )
    .run(
      code, name || `Room ${code}`, creatorId, cappedSlots, singlePlayer ? 1 : 0, showOverall ? 1 : 0,
      normalizePickTime(pickTimeMs), captainEnabled ? 1 : 0
    );
  return getRoomRow(Number(info.lastInsertRowid));
}

function getRoomRow(id) {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}

function getRoomByCode(code) {
  return db.prepare('SELECT * FROM rooms WHERE code = ?').get(String(code).toUpperCase());
}

function getMembers(roomId) {
  return db.prepare('SELECT * FROM room_members WHERE room_id = ? ORDER BY joined_at ASC').all(roomId);
}

function joinRoom(roomRow, user, formation) {
  if (roomRow.status !== 'lobby') throw new Error('this room has already started');
  const members = getMembers(roomRow.id);
  const already = members.find((m) => m.user_id === user.id);
  if (already) return already;
  if (members.length >= roomRow.human_slots_max) throw new Error('room is full');
  const fm = isValidFormation(formation) ? formation : '4-3-3';
  db.prepare(
    `INSERT INTO room_members (room_id, user_id, username, formation) VALUES (?, ?, ?, ?)`
  ).run(roomRow.id, user.id, user.username, fm);
  return db.prepare('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?').get(roomRow.id, user.id);
}

function setFormation(roomRow, userId, formation) {
  if (roomRow.status !== 'lobby') throw new Error('formation can only be changed before the draft starts');
  if (!isValidFormation(formation)) throw new Error('invalid formation');
  db.prepare('UPDATE room_members SET formation = ? WHERE room_id = ? AND user_id = ?').run(
    formation, roomRow.id, userId
  );
}

// Hydrates (or returns cached) in-memory runtime state for an active room: draft pool + per-member progress.
function loadRoomState(roomRow) {
  if (activeRooms.has(roomRow.id)) return activeRooms.get(roomRow.id);

  const members = new Map();
  for (const row of getMembers(roomRow.id)) {
    const drafted = db.prepare('SELECT * FROM drafted_players WHERE room_id = ? AND user_id = ?').all(roomRow.id, row.user_id);
    const slots = {};
    for (const s of getSlots(row.formation)) slots[s.code] = null;
    const squad = [];
    for (const d of drafted) {
      const src = getPlayer(d.player_id);
      const entry = { id: d.player_id, name: d.player_name, pos: d.pos, overall: d.overall, team: d.source_team, slotCode: d.slot_code, isStar: !!(src && src.isStar) };
      if (d.slot_code) slots[d.slot_code] = entry;
      squad.push(entry);
    }
    members.set(row.user_id, {
      userId: row.user_id,
      username: row.username,
      formation: row.formation,
      slots,
      squad,
      draftComplete: !!row.draft_complete,
      eliminated: !!row.eliminated,
      viewedStep: row.viewed_step || 0,
      captainSlot: row.captain_slot || null,
      currentReveal: null,
      lastRevealedTeam: null,
      pickDeadline: null,
      pickTimer: null
    });
  }

  const allDraftedGlobally = db.prepare('SELECT player_id FROM drafted_players WHERE room_id = ?').all(roomRow.id);
  const drafted = new Set(allDraftedGlobally.map((r) => r.player_id));
  const pool = new Set(allPlayerIds().filter((id) => !drafted.has(id)));

  const state = {
    roomId: roomRow.id,
    code: roomRow.code,
    status: roomRow.status,
    humanSlotsMax: roomRow.human_slots_max,
    singlePlayer: !!roomRow.single_player,
    showOverall: !!roomRow.show_overall,
    pickTimeMs: roomRow.pick_time_ms,
    captainEnabled: !!roomRow.captain_enabled,
    members,
    pool,
    tournament: roomRow.tournament_state ? JSON.parse(roomRow.tournament_state) : null
  };
  activeRooms.set(roomRow.id, state);
  return state;
}

function persistPick(roomId, userId, player, sourceTeam, slotCode) {
  db.prepare(
    `INSERT INTO drafted_players (room_id, user_id, player_id, player_name, source_team, pos, overall, slot_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(roomId, userId, player.id, player.name, sourceTeam, player.pos, player.overall, slotCode);
}

function markMemberDraftComplete(roomId, userId) {
  db.prepare('UPDATE room_members SET draft_complete = 1 WHERE room_id = ? AND user_id = ?').run(roomId, userId);
}

function markMemberEliminated(roomId, userId) {
  db.prepare('UPDATE room_members SET eliminated = 1 WHERE room_id = ? AND user_id = ?').run(roomId, userId);
}

function persistViewedStep(roomId, userId, step) {
  db.prepare('UPDATE room_members SET viewed_step = ? WHERE room_id = ? AND user_id = ?').run(step, roomId, userId);
}

function persistCaptain(roomId, userId, slotCode) {
  db.prepare('UPDATE room_members SET captain_slot = ? WHERE room_id = ? AND user_id = ?').run(slotCode, roomId, userId);
}

function setRoomStatus(roomId, status) {
  db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(status, roomId);
}

function persistTournamentSnapshot(roomState) {
  db.prepare('UPDATE rooms SET tournament_state = ? WHERE id = ?').run(
    JSON.stringify(roomState.tournament), roomState.roomId
  );
}

function allMembersDraftComplete(roomState) {
  return Array.from(roomState.members.values()).every((m) => m.draftComplete);
}

function lobbySnapshot(roomRow) {
  return {
    code: roomRow.code,
    status: roomRow.status,
    humanSlotsMax: roomRow.human_slots_max,
    showOverall: !!roomRow.show_overall,
    pickTimeMs: roomRow.pick_time_ms,
    captainEnabled: !!roomRow.captain_enabled,
    members: getMembers(roomRow.id).map((m) => ({
      userId: m.user_id,
      username: m.username,
      formation: m.formation,
      draftComplete: !!m.draft_complete,
      eliminated: !!m.eliminated,
      captainSlot: m.captain_slot || null
    }))
  };
}

module.exports = {
  createRoom,
  getRoomRow,
  getRoomByCode,
  getMembers,
  joinRoom,
  setFormation,
  loadRoomState,
  persistPick,
  markMemberDraftComplete,
  markMemberEliminated,
  persistViewedStep,
  persistCaptain,
  setRoomStatus,
  persistTournamentSnapshot,
  allMembersDraftComplete,
  lobbySnapshot,
  ALLOWED_PICK_TIMES_MS
};
