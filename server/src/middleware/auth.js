const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { touchUser } = require('../userActivity');

function signToken(user) {
  const version = db.prepare('SELECT auth_version FROM users WHERE id = ?').get(user.id)?.auth_version || 0;
  return jwt.sign({ id: user.id, username: user.username, version }, config.jwtSecret, { expiresIn: '30d' });
}

function sessionError(user, payload) {
  if (!user || user.deleted_at) return { code: 'ACCOUNT_DELETED', error: 'This account is no longer available.' };
  if (user.banned) return { code: 'ACCOUNT_BANNED', error: 'This account is banned.' + (user.ban_reason ? ' ' + user.ban_reason : '') };
  if ((payload?.version || 0) !== user.auth_version) return { code: 'SESSION_REVOKED', error: 'Your session has ended. Please sign in again.' };
  return null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  const user = db.prepare('SELECT id, username, role, auth_version, banned, ban_reason, deleted_at FROM users WHERE id = ?').get(payload.id);
  const denied = sessionError(user, payload);
  if (denied) return res.status(401).json(denied);
  req.user = user;
  touchUser(user.id);
  next();
}

function isAdmin(userId) {
  return db.prepare('SELECT role FROM users WHERE id = ?').get(userId)?.role === 'admin';
}

function requireAdmin(req, res, next) {
  if (!req.user) return requireAuth(req, res, () => requireAdmin(req, res, next));
  if (!isAdmin(req.user.id)) return res.status(403).json({ error: 'admin access required' });
  next();
}

function requirePlayer(req, res, next) {
  if (!req.user) return requireAuth(req, res, () => requirePlayer(req, res, next));
  if (req.user.role === 'admin') return res.status(403).json({ error: 'Administrator accounts can only use the admin panel' });
  next();
}

module.exports = { signToken, verifyToken, sessionError, requireAuth, requireAdmin, requirePlayer, isAdmin };
