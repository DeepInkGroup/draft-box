const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, { expiresIn: '30d' });
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
  req.user = payload;
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

module.exports = { signToken, verifyToken, requireAuth, requireAdmin, isAdmin };
