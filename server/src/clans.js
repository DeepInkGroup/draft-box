const MAX_MEMBERS = 50;
function normalizeTag(value) {
  if (typeof value !== 'string' || !/^[A-Z0-9]{2,6}$/.test(value.trim().toUpperCase())) throw new Error('Use 2–6 letters or numbers for your clan tag.');
  const tag = value.trim().toUpperCase();
  if (tag === 'ADMIN') throw new Error('This tag is reserved.');
  return tag;
}
function validateDetails(input) {
  if (typeof input?.name !== 'string' || input.name.trim().length < 3 || input.name.trim().length > 40) throw new Error('Clan name must be 3–40 characters.');
  const description = input.description ?? '';
  if (typeof description !== 'string' || description.length > 240) throw new Error('Clan description must be at most 240 characters.');
  return { name: input.name.trim(), description: description.trim() };
}
function membership(userId) {
  return require('./db').prepare(`SELECT c.id, c.tag, c.name, c.owner_id AS ownerId FROM clan_members m JOIN clans c ON c.id = m.clan_id WHERE m.user_id = ?`).get(userId) || null;
}
function snapshot(id) {
  const db = require('./db');
  const clan = db.prepare('SELECT id, tag, name, description, owner_id AS ownerId, created_at AS createdAt FROM clans WHERE id = ?').get(id);
  if (!clan) return null;
  const members = db.prepare(`SELECT u.id AS userId, u.username, m.joined_at AS joinedAt FROM clan_members m JOIN users u ON u.id = m.user_id WHERE m.clan_id = ? ORDER BY m.joined_at, u.id`).all(id);
  return { ...clan, members: members.map(member => ({ ...member, leader: member.userId === clan.ownerId })), maxMembers: MAX_MEMBERS };
}
function transaction(work) {
  const db = require('./db'); db.exec('BEGIN');
  try { const result = work(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
}
module.exports = { MAX_MEMBERS, normalizeTag, validateDetails, membership, snapshot, transaction };
