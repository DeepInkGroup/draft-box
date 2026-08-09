const { ALL_TEAMS, getTeam } = require('../data/teams');
const { getSlots, POSITION_GROUPS } = require('./formations');

const MAX_REROLL_ATTEMPTS = 300;
const DEFAULT_PICK_TIME_MS = 20000;

function openSlots(member) {
  return getSlots(member.formation).filter((s) => !member.slots[s.code]);
}

function openSlotsForGroup(member, group) {
  return openSlots(member).filter((s) => s.group === group);
}

function slotsRemaining(member) {
  const rem = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const s of openSlots(member)) rem[s.group] += 1;
  return rem;
}

function isDraftComplete(member) {
  return openSlots(member).length === 0;
}

// Finds a random real team that still has at least one player this member can use
// (undrafted room-wide AND matching a position group the member still has an open slot for).
// A team is never revealed twice to the same member — member.seenTeams accumulates every
// team ever shown to them, whether they picked from it or rerolled away from it.
function revealForMember(roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member) throw new Error('not a member of this room');
  if (isDraftComplete(member)) return { done: true };

  const wantedPositions = new Set(openSlots(member).map((s) => s.group));
  const teamPool = roomState.allowedTeams
    ? ALL_TEAMS.filter((t) => roomState.allowedTeams.includes(t.code))
    : ALL_TEAMS;
  const candidates = teamPool.filter((t) => !member.seenTeams.has(t.code));
  const pool = roomState.pool;
  const hideOverall = !roomState.showOverall;
  // 0 is a valid, deliberate "No Limit" setting — must not fall through to the default
  // via a falsy-OR check, which would silently re-enable a 20s countdown.
  const pickTimeMs = roomState.pickTimeMs != null ? roomState.pickTimeMs : DEFAULT_PICK_TIME_MS;

  const reveal = (team) => {
    member.seenTeams.add(team.code);
    member.lastRevealedTeam = team.code;
    member.currentReveal = team.code;
    member.pickDeadline = pickTimeMs > 0 ? Date.now() + pickTimeMs : null;
    return buildRevealPayload(team, pool, wantedPositions, hideOverall, member, pickTimeMs, roomState);
  };

  const canSupply = (team) => team.players.some((p) => pool.has(p.id) && wantedPositions.has(p.pos));

  for (let i = 0; i < MAX_REROLL_ATTEMPTS && candidates.length; i++) {
    const team = candidates[Math.floor(Math.random() * candidates.length)];
    if (canSupply(team)) return reveal(team);
  }

  // Fallback: exhaustively scan every still-unseen eligible team once (covers small unlucky pools).
  for (const team of candidates) {
    if (canSupply(team)) return reveal(team);
  }

  // Last resort: repeating a team is better than stalling the draft — only reached when
  // no unseen team can supply the position (e.g. a heavily restricted team pool).
  for (const team of teamPool) {
    if (canSupply(team)) return reveal(team);
  }

  return { done: false, exhausted: true };
}

// Consumes one of the member's rerolls (if any remain) and immediately reveals a fresh
// team in place of the current one — the skipped team still counts as "seen" (it was
// already added to member.seenTeams by the reveal() that first showed it) so it can
// never come back around later in the draft.
function rerollForMember(roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member) throw new Error('not a member of this room');
  const rerollsAllowed = roomState.rerollsAllowed || 0;
  if (rerollsAllowed <= 0) throw new Error('rerolls are not enabled for this room');
  if (!member.currentReveal) throw new Error('nothing to reroll right now');
  if (member.rerollsUsed >= rerollsAllowed) throw new Error('no rerolls remaining');

  member.rerollsUsed += 1;
  return revealForMember(roomState, userId);
}

function buildRevealPayload(team, pool, wantedPositions, hideOverall, member, pickTimeMs, roomState) {
  let players = team.players.map((p) => ({
    id: p.id,
    name: p.name,
    pos: p.pos,
    overall: hideOverall ? null : p.overall,
    isStar: p.isStar,
    available: pool.has(p.id) && wantedPositions.has(p.pos)
  }));
  players = hideOverall
    ? players.slice().sort((a, b) => a.name.localeCompare(b.name))
    : players.slice().sort((a, b) => b.overall - a.overall);

  const rerollsAllowed = (roomState && roomState.rerollsAllowed) || 0;

  return {
    done: false,
    team: { code: team.code, name: team.name },
    players,
    openSlots: openSlots(member),
    deadline: member.pickDeadline,
    pickTimeMs,
    rerollsAllowed,
    rerollsRemaining: Math.max(0, rerollsAllowed - member.rerollsUsed)
  };
}

function pickPlayer(roomState, userId, playerId, slotCode) {
  const member = roomState.members.get(userId);
  if (!member) throw new Error('not a member of this room');
  if (!roomState.pool.has(playerId)) throw new Error('player already taken');

  const team = getTeam(member.currentReveal);
  const player = team && team.players.find((p) => p.id === playerId);
  if (!player) throw new Error('player is not part of the currently revealed team');

  const slotDef = getSlots(member.formation).find((s) => s.code === slotCode);
  if (!slotDef) throw new Error('invalid slot');
  if (slotDef.group !== player.pos) throw new Error(`this slot needs a ${slotDef.group}, not a ${player.pos}`);
  if (member.slots[slotCode]) throw new Error('that slot is already filled');

  roomState.pool.delete(playerId);
  const entry = { id: player.id, name: player.name, pos: player.pos, overall: player.overall, team: team.code, slotCode, isStar: !!player.isStar };
  member.slots[slotCode] = entry;
  member.squad.push(entry);
  member.currentReveal = null;
  member.pickDeadline = null;

  const draftComplete = isDraftComplete(member);
  member.draftComplete = draftComplete;

  return { player: { ...player, sourceTeam: team.code, slotCode }, slotCode, draftComplete };
}

// Used when a member's pick timer expires: auto-assign the highest-overall available
// player from the currently revealed team into the first open slot that fits.
function autoPickForMember(roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member || !member.currentReveal) return null;

  const team = getTeam(member.currentReveal);
  if (!team) return null;

  const wantedPositions = new Set(openSlots(member).map((s) => s.group));
  const candidates = team.players
    .filter((p) => roomState.pool.has(p.id) && wantedPositions.has(p.pos))
    .sort((a, b) => b.overall - a.overall);
  if (!candidates.length) return null;

  const chosen = candidates[0];
  const slot = openSlotsForGroup(member, chosen.pos)[0];
  if (!slot) return null;

  return pickPlayer(roomState, userId, chosen.id, slot.code);
}

module.exports = {
  revealForMember,
  rerollForMember,
  pickPlayer,
  autoPickForMember,
  slotsRemaining,
  openSlots,
  openSlotsForGroup,
  isDraftComplete,
  DEFAULT_PICK_TIME_MS
};
