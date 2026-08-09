const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { computeTeamRecord, findMyCode } = require('../game/tournamentEngine');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

router.post('/register', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'username must be 3-20 chars: letters, numbers, underscore' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(409).json({ error: 'username or email already taken' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(username, email, hash);

  const user = { id: Number(info.lastInsertRowid), username };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const row = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const user = { id: row.id, username: row.username };
  const token = signToken(user);
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ user: row });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'new password must be at least 6 characters' });
  }

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    return res.status(401).json({ error: 'current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// Career stats: scans every finished tournament this user was a human participant in
// and aggregates titles/record/goals from the same matchLog + events used for the
// in-tournament "My Team" recap card — same source of truth, just summed across rooms.
router.get('/me/career', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.tournament_state FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ? AND r.status = 'finished' AND r.tournament_state IS NOT NULL
  `).all(req.user.id);

  let tournaments = 0;
  let titles = 0;
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;

  for (const row of rows) {
    let t;
    try { t = JSON.parse(row.tournament_state); } catch { continue; }
    if (!t || !t.slotByCode) continue;
    const myCode = findMyCode(t, req.user.id);
    if (!myCode) continue;

    tournaments += 1;
    if (t.champion === myCode) titles += 1;

    const record = computeTeamRecord(t, myCode);
    if (record) {
      w += record.w; d += record.d; l += record.l; gf += record.gf; ga += record.ga;
    }
  }

  res.json({ tournaments, titles, w, d, l, gf, ga });
});

module.exports = router;
