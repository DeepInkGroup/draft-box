const db = require('../db');
const { ALL_TEAMS } = require('../data/teams');
const { getPlayer, getLeague, teamsForRoom } = require('../data/competitions');
const { isValidFormation, getSlots } = require('./formations');
const { bestXI } = require('./botEngine');
const { transferSettings } = require('./leagueSettings');
const { isAdmin } = require('../middleware/auth');
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

function createRoom({ name, creatorId, humanSlotsMax, singlePlayer, showOverall = true, pickTimeMs, captainEnabled = false, tournamentLength = 'full', allowedTeams = null, rerollsAllowed = 0, spoilerMode = false, sharedDraftMode = false, mode = 'worldcup', leagueId = null, squadMode = 'draft', transferEnabled = true, transferLimit = 2, midseasonTactics = false, endseasonTactics = false, midseasonFormations = false, aiTransfers = false, endTransferEnabled = false, endTransferLimit = 2, endAiTransfers = false, pglRatingBoost = false, resultsOnly = false, managerOffers = false, playerDepartures = false }) {
  if (!['worldcup', 'league'].includes(mode)) throw new Error('invalid game mode');
  const league = mode === 'league' ? getLeague(leagueId) : null;
  if (mode === 'league' && !league) throw new Error('league is not available');
  if (league && !singlePlayer) { aiTransfers = false; endAiTransfers = false; }
  if (!['draft', 'real'].includes(squadMode) || (mode !== 'league' && squadMode !== 'draft')) throw new Error('invalid squad mode');
  if (typeof pglRatingBoost !== 'boolean' || (pglRatingBoost && (mode !== 'league' || leagueId !== 'pgl'))) throw new Error('Overall boost is available only for the Persian Gulf League');
  if (typeof resultsOnly !== 'boolean' || (resultsOnly && mode !== 'league')) throw new Error('Results-only mode is available only in leagues');
  if (resultsOnly) spoilerMode = false;
  if (typeof managerOffers !== 'boolean' || typeof playerDepartures !== 'boolean') throw new Error('Career options must be enabled or disabled');
  if ((managerOffers || playerDepartures) && (mode !== 'league' || singlePlayer)) throw new Error('Career options are available only in online leagues');
  const transfers = transferSettings(transferEnabled, transferLimit);
  const endTransfers = transferSettings(endTransferEnabled, endTransferLimit);
  if ((midseasonTactics || endseasonTactics || midseasonFormations) && !league) throw new Error('Management windows are available only in leagues');
  if (midseasonFormations && singlePlayer) throw new Error('Mid-season formation changes are available only in online leagues');
  if (typeof endseasonTactics !== 'boolean' || typeof midseasonFormations !== 'boolean' || typeof midseasonTactics !== 'boolean' || typeof aiTransfers !== 'boolean' || typeof endAiTransfers !== 'boolean') throw new Error('League options must be enabled or disabled');
  const code = uniqueCode();
  const cappedSlots = singlePlayer ? 1 : Math.max(1, Math.min(league ? league.teams.length : 32, Math.floor(Number(humanSlotsMax) || 32)));
  const length = league ? 'full' : normalizeTournamentLength(tournamentLength);
  const teams = normalizeAllowedTeams(allowedTeams, league ? new Set(league.teams.map((team) => team.code)) : VALID_TEAM_CODES);
  const sharedDraft = sharedDraftMode && !singlePlayer && squadMode !== 'real';
  const rerolls = sharedDraft ? 0 : normalizeRerolls(rerollsAllowed);
  const info = db
    .prepare(
      `INSERT INTO rooms (code, name, creator_id, mode, human_slots_max, single_player, show_overall, pick_time_ms, captain_enabled, blitz_mode, tournament_length, allowed_teams, rerolls_allowed, spoiler_mode, shared_draft_mode, league_id, squad_mode, transfer_enabled, transfer_limit, midseason_tactics, ai_transfers, end_transfer_enabled, end_transfer_limit, end_ai_transfers, pgl_rating_boost, results_only, manager_offers, player_departures, endseason_tactics, midseason_formations, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lobby')`
    )
    .run(
      code, name || `Room ${code}`, creatorId, mode, cappedSlots, singlePlayer ? 1 : 0, showOverall ? 1 : 0,
      league && singlePlayer ? 0 : normalizePickTime(pickTimeMs), captainEnabled ? 1 : 0, length === 'blitz' ? 1 : 0, length,
      teams ? JSON.stringify(teams) : null, rerolls, spoilerMode ? 1 : 0, sharedDraft ? 1 : 0, league ? league.id : null, squadMode, transfers.enabled ? 1 : 0, transfers.maxChanges, midseasonTactics ? 1 : 0, transfers.enabled && aiTransfers ? 1 : 0, endTransfers.enabled ? 1 : 0, endTransfers.maxChanges, endTransfers.enabled && endAiTransfers ? 1 : 0, pglRatingBoost ? 1 : 0, resultsOnly ? 1 : 0, managerOffers ? 1 : 0, playerDepartures ? 1 : 0, endseasonTactics ? 1 : 0, midseasonFormations ? 1 : 0
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
  return db.prepare(`SELECT m.*, c.tag AS clan_tag FROM room_members m JOIN users u ON u.id = m.user_id LEFT JOIN clan_members cm ON cm.user_id = m.user_id LEFT JOIN clans c ON c.id = cm.clan_id WHERE m.room_id = ? AND u.banned = 0 AND u.deleted_at IS NULL ORDER BY m.joined_at ASC`).all(roomId);
}

function listUserLeagues(userId) {
  return db.prepare(`SELECT r.code, r.name, r.status, r.league_id, m.country_code, r.tournament_state
    FROM rooms r JOIN room_members m ON m.room_id = r.id
    WHERE m.user_id = ? AND r.mode = 'league'
      AND (r.status != 'finished' OR (r.next_season_id IS NULL AND (r.manager_offers = 1 OR r.player_departures = 1))) ORDER BY r.id DESC`).all(userId)
    .map((row) => ({ code: row.code, status: row.status, leagueName: getLeague(row.league_id)?.name || row.name,
      clubName: getLeague(row.league_id)?.teams.find((club) => club.code === row.country_code)?.name || '',
      betweenSeasons: row.status === 'finished', matchday: row.tournament_state ? JSON.parse(row.tournament_state).matchday || 0 : 0 }));
}

function joinRoom(roomRow, user, formation, clubCode = null) {
  if (roomRow.status !== 'lobby') throw new Error('this room has already started');
  const members = getMembers(roomRow.id);
  const already = members.find((m) => m.user_id === user.id);
  if (already) return already;
  if (members.length >= roomRow.human_slots_max) throw new Error('room is full');
  if (roomRow.mode === 'league' && !getLeague(roomRow.league_id)?.teams.some((team) => team.code === clubCode)) throw new Error('choose a club from the selected league');
  if (roomRow.mode === 'league' && members.some(member => member.country_code === clubCode)) throw new Error('this club is already taken; choose another club');
  const fm = isValidFormation(formation) ? formation : '4-3-3';
  db.prepare(
    `INSERT INTO room_members (room_id, user_id, username, formation, country_code) VALUES (?, ?, ?, ?, ?)`
  ).run(roomRow.id, user.id, user.username, fm, roomRow.mode === 'league' ? clubCode : null);
  return db.prepare('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?').get(roomRow.id, user.id);
}

function startRoomDraft(roomRow) {
  if (roomRow.status !== 'lobby') throw new Error('room already started');
  const members = getMembers(roomRow.id);
  if (!members.length) throw new Error('at least one player must join first');
  const squads = roomRow.squad_mode === 'real' ? members.map(member => {
    const club = teamsForRoom({ mode: roomRow.mode, leagueId: roomRow.league_id, pglRatingBoost: !!roomRow.pgl_rating_boost }).find(team => team.code === member.country_code);
    const xi = club && bestXI(club, member.formation);
    if (!xi || xi.length !== 11) throw new Error('a selected club cannot field an XI in that formation');
    return { member, xi };
  }) : [];
  runTransaction(() => {
    for (const { member, xi } of squads) {
      db.prepare('DELETE FROM drafted_players WHERE room_id = ? AND user_id = ?').run(roomRow.id, member.user_id);
      for (const player of xi) persistPick(roomRow.id, member.user_id, player, player.team, player.slotCode);
      markMemberDraftComplete(roomRow.id, member.user_id);
    }
    setRoomStatus(roomRow.id, 'drafting');
  });
  activeRooms.delete(roomRow.id);
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
    const storedStyle = normalizeStyle(row.tactical_style);
    const tacticalStyle = isCustomStyleKey(storedStyle) && !isAdmin(row.user_id) ? 'balanced' : storedStyle;
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
    squadMode: roomRow.squad_mode || 'draft', pglRatingBoost: !!roomRow.pgl_rating_boost, resultsOnly: !!roomRow.results_only,
    transferEnabled: roomRow.transfer_enabled !== 0,
    transferLimit: roomRow.transfer_limit ?? 2,
    midseasonTactics: !!roomRow.midseason_tactics, endseasonTactics: !!roomRow.endseason_tactics, midseasonFormations: !!roomRow.midseason_formations, aiTransfers: !!roomRow.ai_transfers,
    endTransferEnabled: !!roomRow.end_transfer_enabled, endTransferLimit: roomRow.end_transfer_limit ?? 2, endAiTransfers: !!roomRow.end_ai_transfers,
    managerOffers: !!roomRow.manager_offers, playerDepartures: !!roomRow.player_departures,
    seasonNumber: roomRow.season_number || 1,
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
  for (const slot of Object.values(state.tournament?.slotByCode || {})) {
    if (slot.isHuman && isCustomStyleKey(slot.tacticalStyle) && !isAdmin(slot.userId)) {
      slot.tacticalStyle = 'balanced';
      slot.customTactic = null;
    }
  }
  if (state.tournament?.kind === 'league') {
    const { ensureOffers } = require('./leagueTransfers');
    let changed = false;
    for (const window of [state.tournament.transferWindow, state.tournament.endTransferWindow])
      for (const progress of Object.values(window?.users || {})) changed = ensureOffers(state.tournament, progress) || changed;
    if (changed) persistTournamentSnapshot(state);
  }
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
  if (!isAdmin(userId)) return null;
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

function initializeRealSquad(roomRow, userId) {
  const member = getMembers(roomRow.id).find((entry) => entry.user_id === userId);
  const club = teamsForRoom({mode:roomRow.mode, leagueId:roomRow.league_id, pglRatingBoost:!!roomRow.pgl_rating_boost}).find((team) => team.code === member?.country_code);
  if (!club || roomRow.squad_mode !== 'real') throw new Error('real club squad is unavailable');
  const xi = bestXI(club, member.formation);
  if (xi.length !== 11) throw new Error('this club cannot field an XI in that formation');
  runTransaction(() => {
    for (const player of xi) persistPick(roomRow.id, userId, player, player.team, player.slotCode);
    markMemberDraftComplete(roomRow.id, userId);
  });
}

// Save roster and transfer progress together before changing the in-memory state.
function persistLeagueRoster(roomState, userId, tournament) {
  const slot = Object.values(tournament.slotByCode).find((team) => team.userId === userId && team.isHuman);
  if (!slot) throw new Error('not a member of this league');
  const captainSlot = slot.xi.find((player) => player.isCaptain)?.slotCode || null;
  runTransaction(() => {
    db.prepare('DELETE FROM drafted_players WHERE room_id = ? AND user_id = ?').run(roomState.roomId, userId);
    for (const player of slot.xi) persistPick(roomState.roomId, userId, player, player.team, player.slotCode);
    db.prepare('UPDATE room_members SET captain_slot = ?, formation = ? WHERE room_id = ? AND user_id = ?').run(captainSlot, slot.formation, roomState.roomId, userId);
    db.prepare('UPDATE rooms SET tournament_state = ? WHERE id = ?').run(JSON.stringify(tournament), roomState.roomId);
  });
  roomState.tournament = tournament;
  const member = roomState.members.get(userId);
  member.formation = slot.formation;
  member.squad = slot.xi.map((player) => ({ ...player }));
  member.slots = Object.fromEntries(getSlots(member.formation).map((definition) => [definition.code, member.squad.find((player) => player.slotCode === definition.code) || null]));
  member.captainSlot = captainSlot;
}

function persistLeagueTactic(roomState, userId, tournament) {
  const slot = Object.values(tournament.slotByCode).find(team => team.isHuman && team.userId === userId);
  if (!slot) throw new Error('Not a member of this league');
  runTransaction(() => {
    db.prepare('UPDATE room_members SET tactical_style = ? WHERE room_id = ? AND user_id = ?').run(slot.tacticalStyle, roomState.roomId, userId);
    db.prepare('UPDATE rooms SET tournament_state = ? WHERE id = ?').run(JSON.stringify(tournament),roomState.roomId);
  });
  roomState.tournament = tournament;
  roomState.members.get(userId).tacticalStyle = slot.tacticalStyle;
  roomState.members.get(userId).customTactic = null;
}

function continueLeagueSeason(previous, userId) {
  if (previous.mode !== 'league' || previous.status !== 'finished') throw new Error('Finish your league season before continuing');
  if (previous.creator_id !== userId) throw new Error('Only the host can continue a finished league season');
  if (previous.next_season_id) return getRoomRow(previous.next_season_id);
  const priorState = loadRoomState(previous), prior = priorState.tournament;
  if (prior?.stage !== 'done') throw new Error('The season has not finished');
  const { prepareCareer, careerPending, applyDepartures, settleManagerSquads } = require('./leagueCareer');
  if (previous.manager_offers || previous.player_departures) {
    const newlyPrepared = !prior.careerTransition;
    prepareCareer(prior); persistTournamentSnapshot(priorState);
    if (newlyPrepared || careerPending(prior)) return null;
  }
  const carry = structuredClone(prior);
  applyDepartures(carry, prior.careerTransition?.departures || []);
  const selectedClubs = new Map([...priorState.members.keys()].map(id => [id, prior.careerTransition?.users[id]?.selectedClubCode || Object.values(prior.slotByCode).find(team => team.isHuman && team.userId === id)?.code]));
  const managerSquadChanges = settleManagerSquads(carry, [...selectedClubs.values()]);
  let next;
  try {
    runTransaction(() => {
      next = createRoom({ name: `${prior.leagueName} - Season ${(previous.season_number || 1) + 1}`, creatorId: userId, mode: 'league', leagueId: previous.league_id,
        managerOffers: !!previous.manager_offers, playerDepartures: !!previous.player_departures,
        squadMode: previous.squad_mode, singlePlayer: !!previous.single_player, humanSlotsMax: previous.human_slots_max, spoilerMode: !!previous.spoiler_mode, showOverall: !!previous.show_overall, pickTimeMs: previous.pick_time_ms,
        captainEnabled: !!previous.captain_enabled, transferEnabled: previous.transfer_enabled !== 0, transferLimit: previous.transfer_limit ?? 2,
        midseasonTactics: !!previous.midseason_tactics, endseasonTactics: !!previous.endseason_tactics, midseasonFormations: !!previous.midseason_formations, aiTransfers: !!previous.ai_transfers, endTransferEnabled: !!previous.end_transfer_enabled, endTransferLimit: previous.end_transfer_limit ?? 2, endAiTransfers: !!previous.end_ai_transfers, pglRatingBoost: !!previous.pgl_rating_boost, resultsOnly: !!previous.results_only, rerollsAllowed: previous.rerolls_allowed });
      db.prepare('UPDATE rooms SET season_number = ?, previous_season_id = ? WHERE id = ?').run((previous.season_number || 1) + 1,previous.id,next.id);
      for (const member of priorState.members.values()) {
        const team = carry.slotByCode[selectedClubs.get(member.userId)];
        if (!team || team.xi.length !== 11) throw new Error('A complete XI is required');
        if (previous.captain_enabled && !team.xi.some(player => player.isCaptain)) {
          team.xi.reduce((best, player) => player.overall > best.overall ? player : best).isCaptain = true;
        }
        joinRoom(next,{ id: member.userId, username: member.username },team.formation,team.code);
        for (const player of team.xi) persistPick(next.id,member.userId,player,player.team,player.slotCode);
        markMemberDraftComplete(next.id,member.userId);
        persistCaptain(next.id,member.userId,team.xi.find(player => player.isCaptain)?.slotCode || null);
        persistTacticalStyle(next.id,member.userId,team.tacticalStyle);
      }
      next = getRoomRow(next.id);
      const state = loadRoomState(next);
      const { startLeague, rankTable } = require('./leagueEngine');
      const { teamStrength } = require('./botEngine');
      startLeague(state);
      for (const [code,team] of Object.entries(carry.slotByCode)) {
        Object.assign(state.tournament.slotByCode[code],{ xi: structuredClone(team.xi), formation: team.formation, tacticalStyle: team.tacticalStyle, strength: teamStrength(team.xi), rosterCohesion: structuredClone(team.rosterCohesion || null) });
      }
      const t = state.tournament;
      t.clubRosters = structuredClone(carry.clubRosters || t.clubRosters);
      t.freeAgents = structuredClone(carry.freeAgents || []);
      t.seasonDepartures = structuredClone(carry.seasonDepartures || []);
      t.managerChanges = [...selectedClubs].filter(([id, club]) => prior.careerTransition?.users[id]?.clubCode !== club && prior.careerTransition?.users[id]).map(([id, club]) => ({ userId: id, username: priorState.members.get(id).username, from: prior.careerTransition.users[id].clubCode, to: club, fromName: prior.slotByCode[prior.careerTransition.users[id].clubCode].name, toName: prior.slotByCode[club].name, squadUpdates: managerSquadChanges.filter(change => change.clubCode === club) }));
      const { openEndSeasonTransfers } = require('./leagueTransfers');
      openEndSeasonTransfers(t);
      require('./leagueMidseason').openEndSeasonTactics(t);
      t.initialClubRosters = structuredClone(t.clubRosters);
      t.initialXIs = Object.fromEntries(Object.values(t.slotByCode).map(team => [team.code, structuredClone(team.xi)]));
      t.initialFormations = Object.fromEntries(Object.values(t.slotByCode).map(team => [team.code, team.formation]));
      t.initialTactics = Object.fromEntries(Object.values(t.slotByCode).map(team => [team.code, team.tacticalStyle]));
      const ownCode = Object.values(prior.slotByCode).find(team => team.userId === userId)?.code;
      t.previousSeasons = (prior.previousSeasons || []).concat({ seasonNumber: prior.seasonNumber || 1, roomCode: previous.code,
        champion: prior.slotByCode[prior.champion].name, position: rankTable(prior).find(team => team.code === ownCode)?.rank,
        userPositions: Object.fromEntries(Object.values(prior.slotByCode).filter(team => team.isHuman).map(team => [team.userId, rankTable(prior).find(row => row.code === team.code)?.rank])),
        positions: Object.fromEntries(rankTable(prior).map(team => [team.code, team.rank])) });
      state.status = 'league_stage';
      setRoomStatus(next.id,state.status); persistTournamentSnapshot(state);
      db.prepare('UPDATE rooms SET next_season_id = ? WHERE id = ?').run(next.id,previous.id);
    });
  } catch (error) { if (next) activeRooms.delete(next.id); throw error; }
  return getRoomRow(next.id);
}

function allMembersDraftComplete(roomState) {
  return Array.from(roomState.members.values()).every((m) => m.draftComplete);
}

function createRematch(previous, userId) {
  previous = getRoomRow(previous.id);
  if (previous.creator_id !== userId) throw new Error('only the room creator can start a rematch');
  if (previous.status !== 'finished') throw new Error('the tournament has not finished yet');
  if (previous.rematch_room_id) {
    const existing = getRoomRow(previous.rematch_room_id);
    if (existing && existing.status !== 'finished') return existing;
  }
  let next;
  runTransaction(() => {
    next = createRoom({ name: previous.name, creatorId: userId, mode: previous.mode, leagueId: previous.league_id,
      humanSlotsMax: previous.human_slots_max, singlePlayer: !!previous.single_player, squadMode: previous.squad_mode,
      showOverall: !!previous.show_overall, captainEnabled: !!previous.captain_enabled, pickTimeMs: previous.pick_time_ms,
      tournamentLength: previous.tournament_length, allowedTeams: previous.allowed_teams ? JSON.parse(previous.allowed_teams) : null,
      rerollsAllowed: previous.rerolls_allowed, spoilerMode: !!previous.spoiler_mode, sharedDraftMode: !!previous.shared_draft_mode,
      transferEnabled: previous.transfer_enabled !== 0, transferLimit: previous.transfer_limit,
      midseasonTactics: !!previous.midseason_tactics, endseasonTactics: !!previous.endseason_tactics, midseasonFormations: !!previous.midseason_formations, aiTransfers: !!previous.ai_transfers,
      endTransferEnabled: !!previous.end_transfer_enabled, endTransferLimit: previous.end_transfer_limit, endAiTransfers: !!previous.end_ai_transfers,
      pglRatingBoost: !!previous.pgl_rating_boost, resultsOnly: !!previous.results_only,
      managerOffers: !!previous.manager_offers, playerDepartures: !!previous.player_departures });
    for (const member of getMembers(previous.id)) {
      joinRoom(next, { id: member.user_id, username: member.username }, member.formation, member.country_code);
      if (next.squad_mode === 'real') {
        const club = teamsForRoom({ mode: next.mode, leagueId: next.league_id, pglRatingBoost: !!next.pgl_rating_boost }).find(team => team.code === member.country_code);
        const xi = bestXI(club, member.formation);
        if (xi.length !== 11) throw new Error('A complete club XI is required');
        for (const player of xi) persistPick(next.id, member.user_id, player, player.team, player.slotCode);
        markMemberDraftComplete(next.id, member.user_id);
      }
    }
    if (next.single_player) setRoomStatus(next.id, 'drafting');
    db.prepare('UPDATE rooms SET rematch_room_id = ? WHERE id = ?').run(next.id, previous.id);
  });
  return getRoomRow(next.id);
}

function lobbySnapshot(roomRow) {
  const members = getMembers(roomRow.id);
  const captainEnabled = !!roomRow.captain_enabled;
  const allReady = members.length > 0 && members.every((m) => !!m.draft_complete && !!m.tactical_style_locked && (!captainEnabled || !!m.captain_slot));
  return {
    code: roomRow.code,
    mode: roomRow.mode,
    leagueId: roomRow.league_id || null,
    squadMode: roomRow.squad_mode || 'draft', pglRatingBoost: !!roomRow.pgl_rating_boost, resultsOnly: !!roomRow.results_only,
    transferEnabled: roomRow.transfer_enabled !== 0,
    transferLimit: roomRow.transfer_limit ?? 2,
    midseasonTactics: !!roomRow.midseason_tactics, endseasonTactics: !!roomRow.endseason_tactics, midseasonFormations: !!roomRow.midseason_formations, aiTransfers: !!roomRow.ai_transfers,
    endTransferEnabled: !!roomRow.end_transfer_enabled, endTransferLimit: roomRow.end_transfer_limit ?? 2, endAiTransfers: !!roomRow.end_ai_transfers,
    managerOffers: !!roomRow.manager_offers, playerDepartures: !!roomRow.player_departures,
    seasonNumber: roomRow.season_number || 1,
    leagueName: getLeague(roomRow.league_id)?.name || null,
    leagueClubs: roomRow.mode === 'league' ? getLeague(roomRow.league_id).teams.map(({ code, name, headCoach, logo }) => ({ code, name, headCoach, logo })) : null,
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
      clanTag: m.clan_tag || null,
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
  createRematch,
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
  startRoomDraft,
  persistTournamentSnapshot,
  initializeRealSquad,
  persistLeagueRoster,
  persistLeagueTactic,
  continueLeagueSeason,
  allMembersDraftComplete,
  lobbySnapshot,
  ALLOWED_PICK_TIMES_MS,
  ALLOWED_TOURNAMENT_LENGTHS,
  ALLOWED_REROLLS
};
