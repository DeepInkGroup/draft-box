const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbDir = path.dirname(config.dbPath);
if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  creator_id INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'worldcup',
  human_slots_max INTEGER NOT NULL DEFAULT 32,
  single_player INTEGER NOT NULL DEFAULT 0,
  show_overall INTEGER NOT NULL DEFAULT 1,
  pick_time_ms INTEGER NOT NULL DEFAULT 20000,
  captain_enabled INTEGER NOT NULL DEFAULT 0,
  blitz_mode INTEGER NOT NULL DEFAULT 0,
  tournament_length TEXT NOT NULL DEFAULT 'full',
  allowed_teams TEXT,
  rerolls_allowed INTEGER NOT NULL DEFAULT 0,
  spoiler_mode INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'lobby',
  tournament_state TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS room_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  formation TEXT NOT NULL DEFAULT '4-3-3',
  draft_complete INTEGER NOT NULL DEFAULT 0,
  country_code TEXT,
  eliminated INTEGER NOT NULL DEFAULT 0,
  viewed_step INTEGER NOT NULL DEFAULT 0,
  captain_slot TEXT,
  tactical_style TEXT NOT NULL DEFAULT 'balanced',
  tactical_style_locked INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS drafted_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  source_team TEXT NOT NULL,
  pos TEXT NOT NULL,
  overall INTEGER NOT NULL,
  slot_code TEXT NOT NULL DEFAULT '',
  drafted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(room_id, player_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

// Lightweight migration guards for pre-existing local dev databases created before
// show_overall / slot_code existed (CREATE TABLE IF NOT EXISTS won't add new columns).
function columnExists(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === column);
}
if (!columnExists('rooms', 'show_overall')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN show_overall INTEGER NOT NULL DEFAULT 1;`);
}
if (!columnExists('drafted_players', 'slot_code')) {
  db.exec(`ALTER TABLE drafted_players ADD COLUMN slot_code TEXT NOT NULL DEFAULT '';`);
}
if (!columnExists('room_members', 'viewed_step')) {
  db.exec(`ALTER TABLE room_members ADD COLUMN viewed_step INTEGER NOT NULL DEFAULT 0;`);
}
if (!columnExists('rooms', 'pick_time_ms')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN pick_time_ms INTEGER NOT NULL DEFAULT 20000;`);
}
if (!columnExists('rooms', 'captain_enabled')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN captain_enabled INTEGER NOT NULL DEFAULT 0;`);
}
if (!columnExists('room_members', 'captain_slot')) {
  db.exec(`ALTER TABLE room_members ADD COLUMN captain_slot TEXT;`);
}
if (!columnExists('room_members', 'tactical_style')) {
  db.exec(`ALTER TABLE room_members ADD COLUMN tactical_style TEXT NOT NULL DEFAULT 'balanced';`);
}
if (!columnExists('room_members', 'tactical_style_locked')) {
  db.exec(`ALTER TABLE room_members ADD COLUMN tactical_style_locked INTEGER NOT NULL DEFAULT 0;`);
}
if (!columnExists('rooms', 'blitz_mode')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN blitz_mode INTEGER NOT NULL DEFAULT 0;`);
}
if (!columnExists('rooms', 'tournament_length')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN tournament_length TEXT NOT NULL DEFAULT 'full';`);
}
if (!columnExists('rooms', 'allowed_teams')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN allowed_teams TEXT;`);
}
if (!columnExists('rooms', 'rerolls_allowed')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN rerolls_allowed INTEGER NOT NULL DEFAULT 0;`);
}
if (!columnExists('rooms', 'spoiler_mode')) {
  db.exec(`ALTER TABLE rooms ADD COLUMN spoiler_mode INTEGER NOT NULL DEFAULT 0;`);
}

module.exports = db;
