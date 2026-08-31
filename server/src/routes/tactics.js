const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Get all custom tactics for the logged-in user
router.get('/', auth, (req, res) => {
  try {
    const tactics = db.prepare('SELECT * FROM custom_tactics WHERE user_id = ?').all(req.user.id);
    res.json(tactics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve tactics' });
  }
});

// Create a new custom tactic
router.post('/', auth, (req, res) => {
  const { name, ...tacticParams } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tactic name is required' });
  }

  const columns = Object.keys(tacticParams);
  const values = Object.values(tacticParams);

  try {
    const stmt = db.prepare(
      `INSERT INTO custom_tactics (user_id, name, ${columns.join(', ')}) VALUES (?, ?, ${columns.map(() => '?').join(', ')})`
    );
    const result = stmt.run(req.user.id, name, ...values);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create tactic' });
  }
});

// Update a custom tactic
router.put('/:id', auth, (req, res) => {
  const { id } = req.params;
  const { name, ...tacticParams } = req.body;

  const columns = Object.keys(tacticParams);
  const values = Object.values(tacticParams);

  try {
    const stmt = db.prepare(
      `UPDATE custom_tactics SET ${columns.map(col => `${col} = ?`).join(', ')} WHERE id = ? AND user_id = ?`
    );
    const result = stmt.run(...values, id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tactic not found or you do not have permission to edit it' });
    }

    res.json({ id, ...req.body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update tactic' });
  }
});

// Delete a custom tactic
router.delete('/:id', auth, (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM custom_tactics WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tactic not found or you do not have permission to delete it' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete tactic' });
  }
});

module.exports = router;
