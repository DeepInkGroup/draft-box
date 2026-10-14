const DEFAULT_ABOUT = Object.freeze({
  title: 'About Draft Box',
  subtitle: 'A football game built around your squad.',
  body: 'Build a squad, find your style and see how far you can go.\n\nDraft Box brings together football drafting, World Cup tournaments and Persian Gulf League seasons. Play solo or create a room with friends.',
  teamName: 'DeepInk Group',
  contactEmail: '', website: '',
  github: 'https://github.com/DeepInkGroup/draft-box',
  telegram: 'https://t.me/DeepInkGroup'
});
const LIMITS = { title: 100, subtitle: 200, body: 10000, teamName: 100, contactEmail: 254, website: 500, github: 500, telegram: 500 };
function validateAbout(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('About Us content is required.');
  const content = {};
  for (const [key, limit] of Object.entries(LIMITS)) {
    if (typeof input[key] !== 'string' || input[key].length > limit) throw new Error(`${key} must be text with at most ${limit} characters.`);
    content[key] = input[key].trim();
  }
  if (!content.title || !content.body) throw new Error('Title and description are required.');
  if (content.contactEmail && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(content.contactEmail)) throw new Error('Enter a valid contact email.');
  for (const key of ['website', 'github', 'telegram']) {
    if (!content[key]) continue;
    let url;
    try { url = new URL(content[key]); } catch { throw new Error(`${key} must be a complete HTTP or HTTPS address.`); }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password || /[\u0000-\u0020]/.test(content[key])) throw new Error(`${key} must be a complete HTTP or HTTPS address without credentials.`);
  }
  return content;
}
function getAbout() {
  const db = require('./db');
  db.prepare("INSERT OR IGNORE INTO site_content (key, content, revision, updated_at) VALUES ('about', ?, 1, CURRENT_TIMESTAMP)").run(JSON.stringify(DEFAULT_ABOUT));
  const row = db.prepare("SELECT content, revision, updated_at FROM site_content WHERE key = 'about'").get();
  return { content: JSON.parse(row.content), revision: row.revision, updatedAt: row.updated_at, formatVersion: 1 };
}
function saveAbout(content, revision) {
  const db = require('./db');
  const saved = db.prepare("UPDATE site_content SET content = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'about' AND revision = ?").run(JSON.stringify(content), revision);
  return saved.changes ? getAbout() : null;
}
module.exports = { DEFAULT_ABOUT, LIMITS, validateAbout, getAbout, saveAbout };
