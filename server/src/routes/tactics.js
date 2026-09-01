const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const TACTIC_COLUMNS = [
  'attack', 'defense', 'possession', 'passAccuracy', 'foulBias', 'tempo', 'risk',
  'press', 'control', 'transition', 'setPiece', 'starMoment', 'midfieldBias',
  'finishingBias', 'widthBias', 'highlineBias', 'buildupBias', 'setPieceBias',
  'physicalityBias', 'description', 'longDescription', 'strengths', 'weaknesses'
];

const NUMERIC_DEFAULTS = {
  attack: 1, defense: 1, possession: 0, passAccuracy: 0, foulBias: 0, tempo: 1, risk: 1,
  press: 1, control: 1, transition: 1, setPiece: 1, starMoment: 1, midfieldBias: 1,
  finishingBias: 1, widthBias: 1, highlineBias: 1, buildupBias: 1, setPieceBias: 1,
  physicalityBias: 1
};

const NUMERIC_LIMITS = {
  attack: [.72, 1.28], defense: [.72, 1.28], tempo: [.76, 1.24], risk: [.72, 1.28],
  possession: [-8, 8], passAccuracy: [-5, 5], press: [.74, 1.26], control: [.74, 1.26],
  midfieldBias: [.76, 1.24], finishingBias: [.76, 1.24], transition: [.74, 1.26],
  starMoment: [.78, 1.22], widthBias: [.76, 1.24], highlineBias: [.76, 1.24],
  buildupBias: [.76, 1.24], setPiece: [.78, 1.22], setPieceBias: [.78, 1.22],
  physicalityBias: [.78, 1.22], foulBias: [-4, 4]
};

const TEXT_COLUMNS = new Set(['description', 'longDescription', 'strengths', 'weaknesses']);
const INTEGER_COLUMNS = new Set(['possession', 'passAccuracy', 'foulBias']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanNumber(key, value) {
  const fallback = NUMERIC_DEFAULTS[key];
  const raw = Number(value);
  const [min, max] = NUMERIC_LIMITS[key];
  const clamped = clamp(Number.isFinite(raw) ? raw : fallback, min, max);
  return INTEGER_COLUMNS.has(key) ? Math.round(clamped) : Math.round(clamped * 100) / 100;
}

function normalizeNumbers(payload) {
  const normalized = { ...payload };
  Object.keys(NUMERIC_DEFAULTS).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(normalized, key)) normalized[key] = NUMERIC_DEFAULTS[key];
    normalized[key] = cleanNumber(key, normalized[key]);
  });

  const heat = Object.keys(NUMERIC_DEFAULTS).reduce((sum, key) => {
    const scale = INTEGER_COLUMNS.has(key) ? 0.04 : 1;
    return sum + Math.abs(normalized[key] - NUMERIC_DEFAULTS[key]) * scale;
  }, 0);

  if (heat > 2.45) {
    const factor = 2.45 / heat;
    Object.keys(NUMERIC_DEFAULTS).forEach((key) => {
      normalized[key] = cleanNumber(key, NUMERIC_DEFAULTS[key] + (normalized[key] - NUMERIC_DEFAULTS[key]) * factor);
    });
  }

  return normalized;
}

function tacticPayload(body) {
  const raw = TACTIC_COLUMNS.reduce((payload, column) => {
    if (Object.prototype.hasOwnProperty.call(body, column)) payload[column] = TEXT_COLUMNS.has(column) ? String(body[column] || '').trim() : body[column];
    return payload;
  }, {});
  return { ...raw, ...normalizeNumbers(raw) };
}

function cleanName(value) {
  return String(value || '').trim().slice(0, 64);
}

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
  const name = cleanName(req.body.name);
  const tacticParams = tacticPayload(req.body);

  if (!name) {
    return res.status(400).json({ error: 'Tactic name is required' });
  }

  const columns = Object.keys(tacticParams);
  const values = Object.values(tacticParams);

  if (!columns.length) {
    return res.status(400).json({ error: 'Tactic parameters are required' });
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO custom_tactics (user_id, name, ${columns.join(', ')}) VALUES (?, ?, ${columns.map(() => '?').join(', ')})`
    );
    const result = stmt.run(req.user.id, name, ...values);
    res.status(201).json({ id: result.lastInsertRowid, name, ...tacticParams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create tactic' });
  }
});

// Update a custom tactic
router.put('/:id', auth, (req, res) => {
  const { id } = req.params;
  const name = cleanName(req.body.name);
  const tacticParams = tacticPayload(req.body);

  if (!name) {
    return res.status(400).json({ error: 'Tactic name is required' });
  }

  const columns = Object.keys(tacticParams);
  const values = Object.values(tacticParams);

  if (!columns.length) {
    const result = db.prepare('UPDATE custom_tactics SET name = ? WHERE id = ? AND user_id = ?').run(name, id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tactic not found or you do not have permission to edit it' });
    }
    return res.json({ id, name });
  }

  try {
    const stmt = db.prepare(
      `UPDATE custom_tactics SET name = ?, ${columns.map(col => `${col} = ?`).join(', ')} WHERE id = ? AND user_id = ?`
    );
    const result = stmt.run(name, ...values, id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Tactic not found or you do not have permission to edit it' });
    }

    res.json({ id, name, ...tacticParams });
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
