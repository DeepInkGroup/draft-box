const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { computeTeamRecord, findMyCode } = require('../game/tournamentEngine');
const { analyzeMatch, resultOutcome } = require('../game/matchAnalysis');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function makeFriendCode() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${letter}${digits}`;
}

function uniqueFriendCode() {
  for (let i = 0; i < 100; i++) {
    const code = makeFriendCode();
    const existing = db.prepare('SELECT id FROM users WHERE friend_code = ?').get(code);
    if (!existing) return code;
  }
  throw new Error('could not generate a unique friend code');
}

function friendshipPair(a, b) {
  const one = Number(a);
  const two = Number(b);
  return one < two ? [one, two] : [two, one];
}

function mapFriendRow(row, myId) {
  const friendId = row.requester_id === myId ? row.addressee_id : row.requester_id;
  const friendUsername = row.requester_id === myId ? row.addressee_username : row.requester_username;
  const friendCode = row.requester_id === myId ? row.addressee_code : row.requester_code;
  return {
    id: row.id,
    status: row.status,
    direction: row.requested_by === myId ? 'outgoing' : 'incoming',
    friend: { id: friendId, username: friendUsername, friendCode },
    createdAt: row.created_at
  };
}

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
  const friendCode = uniqueFriendCode();
  const info = db
    .prepare('INSERT INTO users (username, email, friend_code, password_hash) VALUES (?, ?, ?, ?)')
    .run(username, email, friendCode, hash);

  const user = { id: Number(info.lastInsertRowid), username, friendCode };
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

  const user = { id: row.id, username: row.username, friendCode: row.friend_code };
  const token = signToken(user);
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, username, email, friend_code AS friendCode, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ user: row });
});

router.get('/friends', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT f.*, ru.username AS requester_username, ru.friend_code AS requester_code,
           au.username AS addressee_username, au.friend_code AS addressee_code
    FROM friendships f
    JOIN users ru ON ru.id = f.requester_id
    JOIN users au ON au.id = f.addressee_id
    WHERE f.requester_id = ? OR f.addressee_id = ?
    ORDER BY f.status = 'pending' DESC, f.updated_at DESC, f.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json({ friends: rows.map((row) => mapFriendRow(row, req.user.id)) });
});

router.post('/friends/request', requireAuth, (req, res) => {
  const friendCode = String((req.body && req.body.friendCode) || '').trim().toUpperCase();
  if (!/^[A-Z][0-9]{4}$/.test(friendCode)) return res.status(400).json({ error: 'friend id must look like E3202' });

  const target = db.prepare('SELECT id, username, friend_code FROM users WHERE friend_code = ?').get(friendCode);
  if (!target) return res.status(404).json({ error: 'friend id not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'you cannot add yourself' });

  const [requesterId, addresseeId] = friendshipPair(req.user.id, target.id);
  const existing = db.prepare('SELECT * FROM friendships WHERE requester_id = ? AND addressee_id = ?').get(requesterId, addresseeId);
  if (existing) {
    if (existing.status === 'accepted') return res.json({ ok: true, status: 'accepted' });
    return res.status(409).json({ error: 'friend request already pending' });
  }

  db.prepare('INSERT INTO friendships (requester_id, addressee_id, requested_by, status) VALUES (?, ?, ?, ?)').run(requesterId, addresseeId, req.user.id, 'pending');
  res.status(201).json({ ok: true, status: 'pending' });
});

router.post('/friends/respond', requireAuth, (req, res) => {
  const id = Number(req.body && req.body.id);
  const action = String((req.body && req.body.action) || '').toLowerCase();
  if (!id || !['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'id and action are required' });

  const row = db.prepare('SELECT * FROM friendships WHERE id = ?').get(id);
  if (!row || (row.requester_id !== req.user.id && row.addressee_id !== req.user.id)) return res.status(404).json({ error: 'friend request not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'request is not pending' });
  if (row.requested_by === req.user.id) return res.status(403).json({ error: 'wait for the other player to respond' });

  if (action === 'reject') db.prepare('DELETE FROM friendships WHERE id = ?').run(id);
  else db.prepare("UPDATE friendships SET status = 'accepted', updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true });
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

router.get('/users/:id/career', requireAuth, (req, res) => {
    const userId = Number(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'invalid user id' });

    const rows = db.prepare(`
      SELECT r.tournament_state FROM rooms r
      JOIN room_members rm ON rm.room_id = r.id
      WHERE rm.user_id = ? AND r.status = 'finished' AND r.tournament_state IS NOT NULL
    `).all(userId);
  
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
      const myCode = findMyCode(t, userId);
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

// Full match history: every match this user's team played in, across every finished
// tournament, most recent tournament first — each match carries a generated performance
// analysis (matchAnalysis.js) explaining why it went the way it did, so a player can look
// back at their whole record, not just the headline W-D-L from /me/career.
router.get('/me/matches', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.code, r.name, r.created_at, r.tournament_state FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ? AND r.status = 'finished' AND r.tournament_state IS NOT NULL
    ORDER BY r.created_at DESC
  `).all(req.user.id);

  const tournaments = [];
  for (const row of rows) {
    let t;
    try { t = JSON.parse(row.tournament_state); } catch { continue; }
    if (!t || !t.slotByCode) continue;
    const myCode = findMyCode(t, req.user.id);
    if (!myCode || !t.slotByCode[myCode]) continue;
    const myName = t.slotByCode[myCode].name;

    const matches = [];
    for (const m of t.matchLog) {
      if (m.aCode !== myCode && m.bCode !== myCode) continue;
      const mySide = m.aCode === myCode ? 'A' : 'B';
      const oppCode = mySide === 'A' ? m.bCode : m.aCode;
      const oppSlot = t.slotByCode[oppCode];
      const oppName = oppSlot ? oppSlot.name : 'Unknown';
      matches.push({
        stage: m.stage,
        group: m.group || null,
        opponent: oppName,
        opponentIsHuman: !!(oppSlot && oppSlot.isHuman),
        myGoals: mySide === 'A' ? m.goalsA : m.goalsB,
        oppGoals: mySide === 'A' ? m.goalsB : m.goalsA,
        wentToExtraTime: !!m.wentToExtraTime,
        wentToPenalties: !!m.wentToPenalties,
        penalties: m.penalties || null,
        outcome: resultOutcome(m, mySide),
        analysis: analyzeMatch(m, mySide, myName, oppName)
      });
    }
    if (!matches.length) continue;

    tournaments.push({
      roomCode: row.code,
      roomName: row.name,
      date: row.created_at,
      countryName: myName,
      champion: t.champion === myCode,
      matches
    });
  }

  res.json({ tournaments });
});

module.exports = router;
