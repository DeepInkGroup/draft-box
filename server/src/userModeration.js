const crypto = require('node:crypto');
const db = require('./db');
const rm = require('./game/roomManager');

function moderateUser(id, action, reason = '', io) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid user ID');
  if (!['kick', 'ban', 'unban', 'delete'].includes(action)) throw new Error('Invalid moderation action');
  if (typeof reason !== 'string' || reason.length > 240) throw new Error('Reason must be at most 240 characters');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user || user.deleted_at) throw new Error('User not found');
  if (user.role === 'admin') throw new Error('Administrator accounts cannot be kicked, banned or deleted');
  const affected = [];
  // Prepare snapshots before the transaction; loading a legacy save can run migrations.
  if (action === 'ban' || action === 'delete') {
    for (const room of db.prepare(`SELECT r.* FROM rooms r WHERE r.creator_id = ? OR EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.user_id = ?)
      OR EXISTS (SELECT 1 FROM json_tree(COALESCE(r.tournament_state, '{}')) WHERE key IN ('userId', 'formerUserId') AND value = ?)`).all(id, id, id)) {
      const state = rm.loadRoomState(room);
      const tournament = state.tournament ? structuredClone(state.tournament) : null;
      if (tournament) {
        if (action === 'delete') anonymize(tournament, id);
        for (const team of Object.values(tournament.slotByCode || {})) if (team.userId === id) {
          team.managerUnavailable = true;
          if (room.status !== 'finished') { team.formerUserId = id; team.isHuman = false; team.userId = null; team.username = null; }
        }
        for (const window of [tournament.transferWindow, tournament.endTransferWindow, tournament.tacticWindow, tournament.endTacticWindow, tournament.formationWindow, tournament.careerTransition]) {
          if (window?.users) delete window.users[id];
        }
        if (tournament.advanceReady) tournament.advanceReady.userIds = tournament.advanceReady.userIds.filter(userId => userId !== id);
      }
      affected.push({ room, state, tournament });
    }
  }
  db.exec('BEGIN');
  try {
    if (action === 'delete') {
      const clan = require('./clans').membership(id);
      db.prepare('DELETE FROM clan_members WHERE user_id = ?').run(id);
      if (clan) {
        const successor = db.prepare('SELECT user_id FROM clan_members WHERE clan_id = ? ORDER BY joined_at, user_id LIMIT 1').get(clan.id);
        if (!successor) db.prepare('DELETE FROM clans WHERE id = ?').run(clan.id);
        else if (clan.ownerId === id) db.prepare('UPDATE clans SET owner_id = ? WHERE id = ?').run(successor.user_id, clan.id);
      }
      db.prepare('DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ? OR requested_by = ?').run(id, id, id);
      db.prepare('DELETE FROM tactic_versions WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM custom_tactics WHERE user_id = ?').run(id);
      db.prepare("UPDATE users SET username = ?, email = ?, friend_code = NULL, password_hash = ?, deleted_at = datetime('now'), banned = 0, ban_reason = '', auth_version = auth_version + 1 WHERE id = ?")
        .run(`deleted_${id}`, `deleted-${id}@deleted.invalid`, crypto.randomBytes(48).toString('hex'), id);
      db.prepare("UPDATE room_members SET username = 'Deleted account' WHERE user_id = ?").run(id);
    } else {
      db.prepare('UPDATE users SET auth_version = auth_version + 1, banned = ?, ban_reason = ? WHERE id = ?')
        .run(action === 'ban' ? 1 : action === 'unban' ? 0 : user.banned, action === 'ban' ? reason.trim() : action === 'unban' ? '' : user.ban_reason, id);
    }
    for (const { room, tournament } of affected) {
      if (room.status !== 'finished') {
        db.prepare('DELETE FROM drafted_players WHERE room_id = ? AND user_id = ?').run(room.id, id);
        db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, id);
      }
      const successor = db.prepare('SELECT m.user_id FROM room_members m JOIN users u ON u.id = m.user_id WHERE m.room_id = ? AND m.user_id != ? AND u.banned = 0 AND u.deleted_at IS NULL ORDER BY m.joined_at, m.id LIMIT 1').get(room.id, id);
      if (room.creator_id === id && successor) db.prepare('UPDATE rooms SET creator_id = ? WHERE id = ?').run(successor.user_id, room.id);
      if (!successor && room.status !== 'finished') db.prepare("UPDATE rooms SET status = 'finished' WHERE id = ?").run(room.id);
      if (tournament) db.prepare('UPDATE rooms SET tournament_state = ? WHERE id = ?').run(JSON.stringify(tournament), room.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  for (const { room, state, tournament } of affected) {
    const member = state.members.get(id);
    if (member?.pickTimer) clearTimeout(member.pickTimer);
    state.members.delete(id);
    if (tournament) state.tournament = tournament;
    if (member && room.status === 'drafting') for (const player of member.squad) state.pool.add(player.id);
    state.status = rm.getRoomRow(room.id).status;
    const fresh = rm.getRoomRow(room.id);
    io?.to(`room:${room.code}`).emit('room:memberUpdate', rm.lobbySnapshot(fresh));
    if (state.sharedDraftMode) io?.to(`room:${room.code}`).emit('draft:sharedStateChanged', { sharedDraft: require('./game/draftEngine').sharedDraftSnapshot(state, null) });
    // Surviving players refresh their personalized transfer/waiting state.
    io?.to(`room:${room.code}`).emit('room:refresh', { code: room.code });
  }
  if (action !== 'unban' && io) for (const socket of io.sockets.sockets.values()) if (socket.user.id === id) {
    socket.emit('account:revoked', { code: action === 'delete' ? 'ACCOUNT_DELETED' : action === 'ban' ? 'ACCOUNT_BANNED' : 'SESSION_REVOKED',
      message: action === 'delete' ? 'Your account has been deleted.' : action === 'ban' ? 'Your account has been banned.' : 'An administrator signed you out. You can sign in again.' });
    socket.disconnect(true);
  }
  return { ok: true, action };
}

function anonymize(value, id) {
  if (!value || typeof value !== 'object') return;
  if ((value.userId === id || value.formerUserId === id) && Object.hasOwn(value, 'username')) value.username = 'Deleted account';
  const codes = new Set(Object.values(value.slotByCode || {}).filter(team => team.userId === id || team.formerUserId === id).map(team => team.code));
  if (codes.size) for (const step of value.history || []) {
    for (const row of step.leagueTable || []) if (codes.has(row.code)) row.username = 'Deleted account';
    for (const match of step.matches || []) { if (codes.has(match.aCode)) match.aUsername = 'Deleted account'; if (codes.has(match.bCode)) match.bUsername = 'Deleted account'; }
  }
  for (const row of value.initialTable || []) if (codes.has(row.code)) row.username = 'Deleted account';
  for (const child of Object.values(value)) if (child && typeof child === 'object') anonymize(child, id);
}

module.exports = { moderateUser };
