const db = require('../db');
const { ALL_TEAMS } = require('../data/teams');
const { getPlayer, getLeague, teamsForRoom } = require('../data/competitions');
const { isValidFormation, getSlots } = require('./formations');
const { normalizeStyle, isCustomStyleKey } = require('./tacticalStyles');

const ALLOWED_TOURNAMENT_LENGTHS = ['full', 'blitz', 'quarter'];
const ALLOWED_REROLLS = [0, 1, 2, 3];
const VALID_TEAM_CODES = new Set(ALL_TEAMS.map((t) => t.code));

function normalizeTournamentLength(v) {
  return ALLOWED_TOURNAMENT_LENGTHS.includes(v) ? v : 'full';
}

function normalizeRerolls(n) {
  const v = Number(n);
  return ALLOWED_REROLLS.includes(v) ? v : 0;
}

// Optional creator-chosen restriction on which nations can appear in the draft reveal.
// null/empty means unrestricted (all 48 teams eligible) — the default. At least 4 valid
// team codes are required if the creator opts in, so every position group stays reachable.
function normalizeAllowedTeams(codes, validCodes = VALID_TEAM_CODES) {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  const valid = [...new Set(codes.filter((c) => validCodes.has(c)))];
  if (valid.length < 4) throw new Error('pick at least 4 teams to restrict the draft pool');
  return valid;
}

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

// 0 is a sentinel meaning "No Limit" — no auto-pick countdown at all.
const ALLOWED_PICK_TIMES_MS = [10000, 20000, 30000, 45000, 0];

function normalizePickTime(ms) {
  const n = Number(ms);
  return ALLOWED_PICK_TIMES_MS.includes(n) ? n : 20000;
}

function createRoom({ name, creatorId, humanSlotsMax, singlePlayer, showOverall = true, pickTimeMs, captainEnabled = false, tournamentLength = 'full', allowedTeams = null, rerollsAllowed = 0, spoilerMode = false, sharedDraftMode = false, mode = 'worldcup', leagueId = null }) {
  if (!['worldcup', 'league'].includes(mode)) throw new Error('invalid game mode');
  const league = mode === 'league' ? getLeague(leagueId) : null;
  if (mode === 'league' && !league) throw new Error('league is not available');
  if (mode === 'league' && !singlePlayer) throw new Error('League Games is currently single player only');
  const code = uniqueCode();
  const cappedSlots = singlePlayer ? 1 : Math.max(1, Math.min(32, Number(humanSlotsMax) || 32));
  const length = normalizeTournamentLength(tournamentLength);
  const teams = normalizeAllowedTeams(allowedTeams, league ? new Set(league.teams.map((team) => team.code)) : VALID_TEAM_CODES);
  const sharedDraft = sharedDraftMode && !singlePlayer;
  const rerolls = sharedDraft ? 0 : normalizeRerolls(rerollsAllowed);
  const info = db
    .prepare(
      `INSERT INTO rooms (code, name, creator_id, mode, human_slots_max, single_player, show_overall, pick_time_ms, captain_enabled, blitz_mode, tournament_length, allowed_teams, rerolls_allowed, spoiler_mode, shared_draft_mode, league_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lobby')`
    )
    .run(
      code, name || `Room ${code}`, creatorId, mode, cappedSlots, singlePlayer ? 1 : 0, showOverall ? 1 : 0,
      normalizePickTime(pickTimeMs), captainEnabled ? 1 : 0, length === 'blitz' ? 1 : 0, length,
      teams ? JSON.stringify(teams) : null, rerolls, spoilerMode ? 1 : 0, sharedDraft ? 1 : 0, league ? league.id : null
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

function listUserLeagues(userId) {
  return db.prepare(`SELECT r.code, r.name, r.status, r.league_id, m.country_code, r.tournament_state
    FROM rooms r JOIN room_members m ON m.room_id = r.id
    WHERE m.user_id = ? AND r.mode = 'league' AND r.status != 'finished' ORDER BY r.id DESC`).all(userId)
    .map((row) => ({ code: row.code, status: row.status, leagueName: getLeague(row.league_id)?.name || row.name,
      clubName: getLeague(row.league_id)?.teams.find((club) => club.code === row.country_code)?.name || '',
      matchday: row.tournament_state ? JSON.parse(row.tournament_state).matchday || 0 : 0 }));
}

function joinRoom(roomRow, user, formation, clubCode = null) {
  if (roomRow.status !== 'lobby') throw new Error('this room has already started');
  const members = getMembers(roomRow.id);
  const already = members.find((m) => m.user_id === user.id);
  if (already) return already;
  if (members.length >= roomRow.human_slots_max) throw new Error('room is full');
  if (roomRow.mode === 'league' && !getLeague(roomRow.league_id)?.teams.some((team) => team.code === clubCode)) throw new Error('choose a club from the selected league');
  const fm = isValidFormation(formation) ? formation : '4-3-3';
  db.prepare(
    `INSERT INTO room_members (room_id, user_id, username, formation, country_code) VALUES (?, ?, ?, ?, ?)`
  ).run(roomRow.id, user.id, user.username, fm, roomRow.mode === 'league' ? clubCode : null);
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
      const entry = { id: d.player_id, name: d.player_name, pos: d.pos, rawPos: src && src.rawPos ? src.rawPos : d.pos, overall: d.overall, team: d.source_team, slotCode: d.slot_code, isStar: !!(src && src.isStar) };
      if (d.slot_code) slots[d.slot_code] = entry;
      squad.push(entry);
    }
    const tacticalStyle = normalizeStyle(row.tactical_style);
    members.set(row.user_id, {
      userId: row.user_id,
      username: row.username,
      formation: row.formation,
      clubCode: roomRow.mode === 'league' ? row.country_code : null,
      slots,
      squad,
      draftComplete: !!row.draft_complete,
      eliminated: !!row.eliminated,
      viewedStep: row.viewed_step || 0,
      captainSlot: row.captain_slot || null,
      tacticalStyle,
      customTactic: customTacticForUser(row.user_id, tacticalStyle),
      tacticalStyleLocked: !!row.tactical_style_locked,
      currentReveal: null,
      lastRevealedTeam: null,
      pickDeadline: null,
      pickTimer: null,
      // Every team ever revealed to this member (picked from or rerolled away from) —
      // a team is never shown twice. Seeded from their already-drafted squad on rehydrate;
      // in-memory only for the lifetime of the room, same as currentReveal/pickTimer.
      seenTeams: new Set(squad.map((p) => p.team)),
      rerollsUsed: 0
    });
  }

  const allDraftedGlobally = db.prepare('SELECT player_id FROM drafted_players WHERE room_id = ?').all(roomRow.id);
  const drafted = new Set(allDraftedGlobally.map((r) => r.player_id));
  const pool = new Set(teamsForRoom({ mode: roomRow.mode, leagueId: roomRow.league_id }).flatMap((team) => team.players.map((player) => player.id)).filter((id) => !drafted.has(id)));

  const state = {
    roomId: roomRow.id,
    code: roomRow.code,
    mode: roomRow.mode,
    leagueId: roomRow.league_id || null,
    status: roomRow.status,
    humanSlotsMax: roomRow.human_slots_max,
    singlePlayer: !!roomRow.single_player,
    showOverall: !!roomRow.show_overall,
    pickTimeMs: roomRow.pick_time_ms,
    captainEnabled: !!roomRow.captain_enabled,
    tournamentLength: normalizeTournamentLength(roomRow.tournament_length),
    allowedTeams: roomRow.allowed_teams ? JSON.parse(roomRow.allowed_teams) : null,
    rerollsAllowed: normalizeRerolls(roomRow.rerolls_allowed),
    spoilerMode: !!roomRow.spoiler_mode,
    sharedDraftMode: !!roomRow.shared_draft_mode,
    sharedDraft: null,
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

function persistTacticalStyle(roomId, userId, tacticalStyle) {
  const style = normalizeStyle(tacticalStyle);
  if (isCustomStyleKey(style) && !customTacticForUser(userId, style)) throw new Error('custom tactic not found');
  db.prepare('UPDATE room_members SET tactical_style = ?, tactical_style_locked = 1 WHERE room_id = ? AND user_id = ?').run(style, roomId, userId);
}

function customTacticForUser(userId, tacticalStyle) {
  if (!isCustomStyleKey(tacticalStyle)) return null;
  const id = Number(String(tacticalStyle).slice('custom:'.length));
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.prepare('SELECT * FROM custom_tactics WHERE id = ? AND user_id = ?').get(id, userId) || null;
}

function runTransaction(work) {
  db.exec('BEGIN');
  try {
    work();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function persistDraftFormation(roomId, userId, member, moved) {
  runTransaction(() => {
    db.prepare('UPDATE room_members SET formation = ?, draft_complete = ?, captain_slot = ?, tactical_style_locked = 0 WHERE room_id = ? AND user_id = ?')
      .run(member.formation, member.draftComplete ? 1 : 0, member.captainSlot || null, roomId, userId);
    const stmt = db.prepare('UPDATE drafted_players SET slot_code = ? WHERE room_id = ? AND user_id = ? AND player_id = ?');
    for (const m of moved || []) stmt.run(m.toSlotCode, roomId, userId, m.playerId);
  });
}

function persistSlotMoves(roomId, userId, member, moved) {
  runTransaction(() => {
    const stmt = db.prepare('UPDATE drafted_players SET slot_code = ? WHERE room_id = ? AND user_id = ? AND player_id = ?');
    for (const m of moved || []) stmt.run(m.toSlotCode, roomId, userId, m.playerId);
    db.prepare('UPDATE room_members SET captain_slot = ? WHERE room_id = ? AND user_id = ?').run(member.captainSlot || null, roomId, userId);
  });
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
  const members = getMembers(roomRow.id);
  const captainEnabled = !!roomRow.captain_enabled;
  const allReady = members.length > 0 && members.every((m) => !!m.draft_complete && !!m.tactical_style_locked && (!captainEnabled || !!m.captain_slot));
  return {
    code: roomRow.code,
    mode: roomRow.mode,
    leagueId: roomRow.league_id || null,
    leagueName: getLeague(roomRow.league_id)?.name || null,
    spoilerMode: !!roomRow.spoiler_mode,
    name: roomRow.name,
    status: roomRow.status,
    creatorId: roomRow.creator_id,
    humanSlotsMax: roomRow.human_slots_max,
    singlePlayer: !!roomRow.single_player,
    showOverall: !!roomRow.show_overall,
    pickTimeMs: roomRow.pick_time_ms,
    captainEnabled,
    tournamentLength: normalizeTournamentLength(roomRow.tournament_length),
    allowedTeams: roomRow.allowed_teams ? JSON.parse(roomRow.allowed_teams) : null,
    rerollsAllowed: normalizeRerolls(roomRow.rerolls_allowed),
    sharedDraftMode: !!roomRow.shared_draft_mode,
    // All members finished drafting (+ captain if required) — the room creator can now
    // confirm the start of the tournament (multiplayer) or it auto-starts (singleplayer).
    allReady,
    members: members.map((m) => ({
      userId: m.user_id,
      username: m.username,
      formation: m.formation,
      clubCode: roomRow.mode === 'league' ? m.country_code : null,
      draftComplete: !!m.draft_complete,
      eliminated: !!m.eliminated,
      captainSlot: m.captain_slot || null,
      tacticalStyle: normalizeStyle(m.tactical_style),
      tacticalStyleLocked: !!m.tactical_style_locked
    }))
  };
}

module.exports = {
  createRoom,
  getRoomRow,
  getRoomByCode,
  getMembers,
  listUserLeagues,
  joinRoom,
  setFormation,
  loadRoomState,
  persistPick,
  markMemberDraftComplete,
  markMemberEliminated,
  persistViewedStep,
  persistCaptain,
  persistTacticalStyle,
  customTacticForUser,
  persistDraftFormation,
  persistSlotMoves,
  setRoomStatus,
  persistTournamentSnapshot,
  allMembersDraftComplete,
  lobbySnapshot,
  ALLOWED_PICK_TIMES_MS,
  ALLOWED_TOURNAMENT_LENGTHS,
  ALLOWED_REROLLS
};
