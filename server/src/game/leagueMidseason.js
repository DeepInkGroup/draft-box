const { STYLE_KEYS, tacticalCatalog } = require('./tacticalStyles');
function ensureTacticWindow(t) {
  if (t.kind !== 'league' || !t.midseasonTactics) return null;
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
  if (!t.midseasonTactics) return { phase: 'disabled', current: team?.tacticalStyle };
  if (viewedStep < Math.floor(t.fixtures.length / 2)) return { phase: 'closed', current: team?.tacticalStyle };
  const choice = ensureTacticWindow(t)?.users[userId];
  return { phase: choice?.resolved ? 'complete' : 'choose', current: team?.tacticalStyle, styles: tacticalCatalog() };
}
function planTacticChange(tournament, userId, action, style) {
  const t = structuredClone(tournament);
  const team = Object.values(t.slotByCode).find(team => team.userId === userId && team.isHuman);
  const choice = ensureTacticWindow(t)?.users[userId];
  if (!team || !choice || choice.resolved || t.stage === 'done' || t.matchday !== Math.floor(t.fixtures.length / 2)) throw new Error('The mid-season tactic window is not open');
  if (!['change', 'keep'].includes(action)) throw new Error('Choose a new tactic or keep your current tactic');
  if (action === 'change' && !STYLE_KEYS.includes(style)) throw new Error('Choose a built-in tactical style');
  choice.resolved = true;
  choice.previous = team.tacticalStyle;
  if (action === 'change') { team.tacticalStyle = style; team.customTactic = null; }
  choice.current = team.tacticalStyle;
  return t;
}
module.exports = { ensureTacticWindow, tacticsPending, tacticSnapshot, planTacticChange };
