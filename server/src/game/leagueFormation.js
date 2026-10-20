const { FORMATIONS, getSlots, isValidFormation, playerFitsSlot } = require('./formations');
const { teamStrength } = require('./botEngine');

// Optimize all eleven slots, allowing outfield players to cover different roles
// when position counts change. Keep the keeper, players and captain intact.
function reassignXI(xi, previousFormation, formation) {
  if (!isValidFormation(formation)) throw new Error('Choose an available formation');
  if (xi.length !== 11 || new Set(xi.map(player => player.id)).size !== 11) throw new Error('Complete your transfers before changing formation');
  const slots = getSlots(formation), previous = new Map(getSlots(previousFormation).map(slot => [slot.code, slot]));
  const memo = new Map(), choices = new Map();
  function best(index, mask) {
    if (index === 11) return 0;
    if (memo.has(mask)) return memo.get(mask);
    let score = -Infinity;
    for (let playerIndex = 0; playerIndex < 11; playerIndex++) {
      if (mask & (1 << playerIndex)) continue;
      const player = xi[playerIndex], slot = slots[index], old = previous.get(player.slotCode);
      if ((player.pos === 'GK') !== (slot.group === 'GK')) continue;
      const fit = (playerFitsSlot(player, slot) ? 1000 : player.pos === slot.group ? 500 : 0)
        + (player.slotCode === slot.code ? 20 : 0) - (old ? Math.hypot(old.x - slot.x, old.y - slot.y) / 100 : 0);
      const candidate = fit + best(index + 1, mask | (1 << playerIndex));
      if (candidate > score) { score = candidate; choices.set(mask, playerIndex); }
    }
    memo.set(mask, score); return score;
  }
  if (!Number.isFinite(best(0, 0))) throw new Error('A complete XI with one goalkeeper is required');
  let mask = 0;
  return slots.map(slot => { const index = choices.get(mask); mask |= 1 << index; return { ...xi[index], slotCode: slot.code }; });
}
function ensureFormationWindow(t) {
  if (t.kind !== 'league' || !t.midseasonFormations) return null;
  if (!t.formationWindow && t.stage !== 'done' && t.matchday >= Math.floor(t.fixtures.length / 2)) {
    t.formationWindow = { users: Object.fromEntries(Object.values(t.slotByCode).filter(team => team.isHuman).map(team => [team.userId, { resolved: false }])) };
  }
  return t.formationWindow || null;
}
function formationsPending(t) { return Object.values(ensureFormationWindow(t)?.users || {}).some(choice => !choice.resolved); }
function formationSnapshot(t, userId, viewedStep) {
  const team = Object.values(t.slotByCode).find(team => team.isHuman && team.userId === userId);
  const opensAfter = Math.floor(t.fixtures.length / 2), window = ensureFormationWindow(t);
  const common = { current: team?.formation, opensAfter, waitingFor: viewedStep >= opensAfter ? Object.entries(window?.users || {})
    .filter(([id, choice]) => Number(id) !== Number(userId) && !choice.resolved)
    .map(([id]) => ({ userId: Number(id), username: Object.values(t.slotByCode).find(team => team.isHuman && team.userId === Number(id))?.username })) : [] };
  if (!t.midseasonFormations) return { ...common, phase: 'disabled' };
  if (viewedStep < opensAfter || !window) return { ...common, phase: 'closed' };
  const choice = window.users[userId];
  return { ...common, phase: choice && !choice.resolved ? 'choose' : 'complete', formations: Object.keys(FORMATIONS), canChange: team?.xi.length === 11 };
}
function planFormationChange(tournament, userId, action, formation) {
  const t = structuredClone(tournament), choice = ensureFormationWindow(t)?.users[userId];
  const team = Object.values(t.slotByCode).find(team => team.isHuman && team.userId === userId);
  if (!team || !choice || choice.resolved || t.stage === 'done' || t.matchday !== Math.floor(t.fixtures.length / 2)) throw new Error('The mid-season formation window is not open');
  if (!['change', 'keep'].includes(action)) throw new Error('Choose a formation or keep your current formation');
  if (action === 'change') {
    const previous = team.formation;
    team.xi = reassignXI(team.xi, previous, formation); team.formation = formation; team.strength = teamStrength(team.xi);
    (t.formationChanges ||= []).push({ clubCode: team.code, matchday: t.matchday, previous, formation });
  }
  choice.resolved = true; choice.current = team.formation;
  return t;
}
module.exports = { reassignXI, ensureFormationWindow, formationsPending, formationSnapshot, planFormationChange };
