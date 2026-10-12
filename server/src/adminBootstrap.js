const bcrypt = require('bcryptjs');

// The requested initial password is stored only as a bcrypt hash. An existing
// administrator's password is never reset by deploys or server restarts.
const INITIAL_PASSWORD_HASH = "$2a$12$eNymVtYvPsd.fmuc6yW0/uAG.WCIiF171gcDBePaXKkN3eZ5hV4Ra";
module.exports = function initializeAdmin(db, uniqueFriendCode) {
  const existing = db.prepare('SELECT id, role FROM users WHERE lower(username) = ?').get('admin');
  if (existing) return;
  const passwordHash = process.env.ADMIN_INITIAL_PASSWORD ? bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD, 12) : INITIAL_PASSWORD_HASH;
  db.prepare('INSERT INTO users (username, email, friend_code, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run('Admin', 'admin@draftbox.invalid', uniqueFriendCode(), passwordHash, 'admin');
};
