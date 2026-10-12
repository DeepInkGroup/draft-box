const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { tacticPayload, cleanName } = require('../game/customTactics');
const { TACTICAL_STYLES, STYLE_KEYS } = require('../game/tacticalStyles');
const { analyseTactic } = require('../game/tacticsLab');
router.use(requireAuth, requireAdmin);

function owned(id, userId) {
  const row = db.prepare('SELECT * FROM custom_tactics WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  return { ...row, version: db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM tactic_versions WHERE tactic_id = ?').get(id).version };
}
function save(userId, id, body) {
  const payload = { name: cleanName(body.name), ...tacticPayload(body) };
  if (!payload.name) throw new Error('Tactic name is required');
  db.exec('BEGIN');
  try {
    const current = id ? owned(id, userId) : null;
    if (id && !current) throw Object.assign(new Error('Tactic not found'), { status: 404 });
    if (current && body.version !== undefined && Number(body.version) !== current.version) throw Object.assign(new Error('This tactic changed. Reload it before saving.'), { status: 409 });
    const columns = Object.keys(payload);
    if (id) db.prepare(`UPDATE custom_tactics SET ${columns.map((key) => `${key} = ?`).join(', ')} WHERE id = ? AND user_id = ?`).run(...Object.values(payload), id, userId);
    else id = Number(db.prepare(`INSERT INTO custom_tactics (user_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`).run(userId, ...Object.values(payload)).lastInsertRowid);
    const version = (current?.version || 0) + 1;
    db.prepare('INSERT INTO tactic_versions (tactic_id, user_id, version, payload) VALUES (?, ?, ?, ?)').run(id, userId, version, JSON.stringify(payload));
    db.exec('COMMIT');
    return owned(id, userId);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
router.get('/', (req, res) => res.json(db.prepare('SELECT id FROM custom_tactics WHERE user_id = ? ORDER BY id DESC').all(req.user.id).map((row) => owned(row.id, req.user.id))));
router.get('/templates', (req, res) => res.json(STYLE_KEYS.map((key) => ({ key, name: TACTICAL_STYLES[key].label, ...tacticPayload(TACTICAL_STYLES[key]) }))));
router.post('/preview', (req, res) => {
  try { res.json(analyseTactic(req.body)); } catch (error) { res.status(400).json({ error: error.message }); }
});
router.post('/', (req, res) => {
  try { res.status(201).json(save(req.user.id, null, req.body)); } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
});
router.put('/:id', (req, res) => {
  try { res.json(save(req.user.id, req.params.id, req.body)); } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
});
router.get('/:id/versions', (req, res) => {
  if (!owned(req.params.id, req.user.id)) return res.status(404).json({ error: 'Tactic not found' });
  res.json(db.prepare('SELECT version, created_at, payload FROM tactic_versions WHERE tactic_id = ? ORDER BY version DESC').all(req.params.id).map((row) => ({ ...row, payload: JSON.parse(row.payload) })));
});
router.post('/:id/restore', (req, res) => {
  const current = owned(req.params.id, req.user.id);
  if (!current) return res.status(404).json({ error: 'Tactic not found' });
  const row = db.prepare('SELECT payload FROM tactic_versions WHERE tactic_id = ? AND version = ?').get(req.params.id, Number(req.body.version));
  if (!row) return res.status(404).json({ error: 'Version not found' });
  try { res.json(save(req.user.id, req.params.id, { ...JSON.parse(row.payload), version: current.version })); } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
});
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM custom_tactics WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Tactic not found' });
  res.status(204).send();
});
module.exports = router;
