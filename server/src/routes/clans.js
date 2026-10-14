const router = require('express').Router();
const db = require('../db');
const { requireAuth, requirePlayer } = require('../middleware/auth');
const { MAX_MEMBERS, normalizeTag, validateDetails, membership, snapshot, transaction } = require('../clans');
router.use(requireAuth, requirePlayer);
router.get('/me', (req, res) => { const member = membership(req.user.id); res.set('Cache-Control', 'no-store').json({ clan: member ? snapshot(member.id) : null }); });
router.post('/', (req, res) => {
  if (membership(req.user.id)) return res.status(409).json({ error: 'Leave your current clan before creating another.' });
  let tag, details;
  try { tag = normalizeTag(req.body?.tag); details = validateDetails(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
  if (db.prepare('SELECT id FROM clans WHERE tag = ?').get(tag)) return res.status(409).json({ error: 'This clan tag is already taken.' });
  const id = transaction(() => {
    const info = db.prepare('INSERT INTO clans (tag, name, description, owner_id) VALUES (?, ?, ?, ?)').run(tag, details.name, details.description, req.user.id);
    const id = Number(info.lastInsertRowid); db.prepare('INSERT INTO clan_members (clan_id, user_id) VALUES (?, ?)').run(id, req.user.id); return id;
  });
  res.status(201).json({ clan: snapshot(id) });
});
router.post('/join', (req, res) => {
  let tag;
  try { tag = normalizeTag(req.body?.tag); } catch (error) { return res.status(400).json({ error: error.message }); }
  const current = membership(req.user.id);
  if (current) return res.status(409).json({ error: 'You already belong to a clan. Leave it before joining another.' });
  const clan = db.prepare('SELECT id FROM clans WHERE tag = ?').get(tag);
  if (!clan) return res.status(404).json({ error: 'No clan found with this tag.' });
  if (db.prepare('SELECT COUNT(*) AS total FROM clan_members WHERE clan_id = ?').get(clan.id).total >= MAX_MEMBERS) return res.status(409).json({ error: 'This clan is full.' });
  db.prepare('INSERT INTO clan_members (clan_id, user_id) VALUES (?, ?)').run(clan.id, req.user.id);
  res.json({ clan: snapshot(clan.id) });
});
router.put('/me', (req, res) => {
  const clan = membership(req.user.id);
  if (!clan) return res.status(404).json({ error: 'Join a clan first.' });
  if (clan.ownerId !== req.user.id) return res.status(403).json({ error: 'Only the clan leader can edit its details.' });
  let details;
  try { details = validateDetails(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
  db.prepare('UPDATE clans SET name = ?, description = ? WHERE id = ?').run(details.name, details.description, clan.id);
  res.json({ clan: snapshot(clan.id) });
});
router.post('/leave', (req, res) => {
  const clan = membership(req.user.id);
  if (!clan) return res.status(404).json({ error: 'You do not belong to a clan.' });
  transaction(() => {
    db.prepare('DELETE FROM clan_members WHERE user_id = ?').run(req.user.id);
    const successor = db.prepare('SELECT user_id FROM clan_members WHERE clan_id = ? ORDER BY joined_at, user_id LIMIT 1').get(clan.id);
    if (!successor) db.prepare('DELETE FROM clans WHERE id = ?').run(clan.id);
    else if (clan.ownerId === req.user.id) db.prepare('UPDATE clans SET owner_id = ? WHERE id = ?').run(successor.user_id, clan.id);
  });
  res.json({ clan: null });
});
module.exports = router;
