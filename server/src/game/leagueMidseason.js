const { STYLE_KEYS, tacticalCatalog } = require('./tacticalStyles');
function openEndSeasonTactics(t) {
  if (t.endseasonTactics && t.matchday === 0 && !t.endTacticWindow) {
    t.endTacticWindow = { users: Object.fromEntries(Object.values(t.slotByCode).filter(team => team.isHuman).map(team => [team.userId, { resolved: false }])) };
  }
}
function tacticWindowSettings(t) {
  const end = t.matchday === 0 && !!t.endTacticWindow;
  return { windowType: end ? 'endseason' : 'midseason', enabled: end ? !!t.endseasonTactics : !!t.midseasonTactics,
    opensAfter: end ? 0 : Math.floor(t.fixtures.length / 2) };
}
function ensureTacticWindow(t) {
  if (t.kind !== 'league') return null;
  if (t.matchday === 0 && t.endTacticWindow) return t.endTacticWindow;
  if (!t.midseasonTactics) return null;
  if (!t.tacticWindow && t.stage !== 'done' && t.matchday >= Math.floor(t.fixtures.length / 2)) {
    t.tacticWindow = { users: Object.fromEntries(Object.values(t.slotByCode).filter(team => team.isHuman).map(team => [team.userId, { resolved: false }])) };
  }
  return t.tacticWindow || null;
}
function tacticsPending(t) {
  return Object.values(ensureTacticWindow(t)?.users || {}).some(choice => !choice.resolved);
}
function tacticSnapshot(t, userId, viewedStep) {
  const team = Object.values(t.slotByCode).find(team => team.userId === userId && team.isHuman);
  const settings = tacticWindowSettings(t), window = ensureTacticWindow(t);
  const common = { ...settings, current: team?.tacticalStyle, waitingFor: viewedStep >= settings.opensAfter ? Object.entries(window?.users || {})
    .filter(([, choice]) => !choice.resolved).filter(([id]) => Number(id) !== Number(userId))
    .map(([id]) => { const manager = Object.values(t.slotByCode).find(team => team.isHuman && team.userId === Number(id)); return { userId: Number(id), username: manager?.username }; }) : [] };
  if (!settings.enabled) return { ...common, phase: 'disabled' };
  if (viewedStep < settings.opensAfter || !window) return { ...common, phase: 'closed' };
  const choice = window.users[userId];
  return { ...common, phase: choice && !choice.resolved ? 'choose' : 'complete', styles: tacticalCatalog() };
}
function planTacticChange(tournament, userId, action, style) {
  const t = structuredClone(tournament);
  const team = Object.values(t.slotByCode).find(team => team.userId === userId && team.isHuman);
  const choice = ensureTacticWindow(t)?.users[userId], settings = tacticWindowSettings(t);
  if (!team || !choice || choice.resolved || t.stage === 'done' || t.matchday !== settings.opensAfter) throw new Error(`The ${settings.windowType === 'endseason' ? 'end-of-season' : 'mid-season'} tactic window is not open`);
  if (!['change', 'keep'].includes(action)) throw new Error('Choose a new tactic or keep your current tactic');
  if (action === 'change' && !STYLE_KEYS.includes(style)) throw new Error('Choose a built-in tactical style');
  choice.resolved = true;
  choice.previous = team.tacticalStyle;
  if (action === 'change') { team.tacticalStyle = style; team.customTactic = null; }
  choice.current = team.tacticalStyle;
  if (t.matchday === 0) { t.initialTactics ||= {}; t.initialTactics[team.code] = team.tacticalStyle; }
  return t;
}
module.exports = { ensureTacticWindow, tacticsPending, tacticSnapshot, planTacticChange, openEndSeasonTactics };
