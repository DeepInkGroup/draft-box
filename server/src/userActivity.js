const db = require('./db');
const connections = new Map();
function touchUser(id, force = false) {
  db.prepare(`UPDATE users SET last_seen_at = datetime('now') WHERE id = ?${force ? '' : " AND (last_seen_at IS NULL OR last_seen_at < datetime('now', '-1 minute'))"}`).run(id);
}
function connected(id, socketId) {
  if (!connections.has(id)) connections.set(id, new Set());
  connections.get(id).add(socketId);
  touchUser(id, true);
}
function disconnected(id, socketId) {
  const sessions = connections.get(id);
  if (sessions) { sessions.delete(socketId); if (!sessions.size) connections.delete(id); }
  touchUser(id, true);
}
function activityStatus(user) {
  if (connections.get(user.id)?.size) return 'online';
  if (!user.last_seen_at) return 'new';
  const seen = Date.parse(user.last_seen_at.replace(' ', 'T') + 'Z');
  return Date.now() - seen < 5 * 60 * 1000 ? 'recent' : 'offline';
}
module.exports = { touchUser, connected, disconnected, activityStatus };
