function transferSettings(enabled = true, limit = 2) {
  // Keep old zero-limit saves readable; new setup offers 1–3 and a Closed switch.
  if (typeof enabled !== 'boolean') throw new Error('Transfer window must be enabled or disabled');
  if (!Number.isInteger(limit) || limit < 0 || limit > 3) throw new Error('Transfer limit must be a whole number from 0 to 3');
  return { enabled: enabled && limit > 0, maxChanges: limit };
}
function settingsForSeason(t) {
  return transferSettings(t.transferSettings?.enabled, t.transferSettings?.maxChanges);
}
module.exports = { transferSettings, settingsForSeason };
