const { ALL_TEAMS, getTeam } = require('../data/teams');
const { getSlots, isValidFormation, POSITION_GROUPS, playerFitsSlot } = require('./formations');

const MAX_REROLL_ATTEMPTS = 300;
const DEFAULT_PICK_TIME_MS = 20000;

function openSlots(member) {
  normalizeMemberSlots(member);
  return getSlots(member.formation).filter((s) => !member.slots[s.code]);
}

function openSlotsForGroup(member, group) {
  return openSlots(member).filter((s) => s.group === group);
}

function openSlotsForPlayer(member, player) {
  return openSlots(member).filter((s) => playerFitsSlot(player, s));
}

function slotsRemaining(member) {
  const rem = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const s of openSlots(member)) rem[s.group] += 1;
  return rem;
}

function isDraftComplete(member) {
  return openSlots(member).length === 0;
}

function emptySlotsForFormation(formation) {
  const slots = {};
  for (const s of getSlots(formation)) slots[s.code] = null;
  return slots;
}

function normalizeMemberSlots(member) {
  if (!member) return;
  const validCodes = new Set(getSlots(member.formation).map((slot) => slot.code));
  const nextSlots = emptySlotsForFormation(member.formation);
  const byId = new Map((member.squad || []).filter(Boolean).map((player) => [player.id, player]));

  for (const [slotCode, occupant] of Object.entries(member.slots || {})) {
    if (!validCodes.has(slotCode) || !occupant) continue;
    const player = byId.get(occupant.id) || occupant;
    if (nextSlots[slotCode] && nextSlots[slotCode].id !== player.id) continue;
    player.slotCode = slotCode;
    nextSlots[slotCode] = player;
  }

  for (const player of member.squad || []) {
    if (!player || !validCodes.has(player.slotCode)) continue;
    if (nextSlots[player.slotCode] && nextSlots[player.slotCode].id !== player.id) continue;
    nextSlots[player.slotCode] = player;
  }

  member.slots = nextSlots;
  if (member.captainSlot && !member.slots[member.captainSlot]) member.captainSlot = null;
}

function groupCountsForFormation(formation) {
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const s of getSlots(formation)) counts[s.group] += 1;
  return counts;
}

function changeFormation(member, formation) {
  if (!member) throw new Error('not a member of this room');
  if (!isValidFormation(formation)) throw new Error('invalid formation');
  if (member.formation === formation) return { changed: false, moved: [] };

  const currentCounts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const p of member.squad) currentCounts[p.pos] += 1;
  const nextCounts = groupCountsForFormation(formation);
  for (const group of POSITION_GROUPS) {
    if (currentCounts[group] > nextCounts[group]) {
      throw new Error(`this formation has only ${nextCounts[group]} ${group} slot(s), but you already drafted ${currentCounts[group]}`);
    }
  }

  const oldCaptainPlayer = member.captainSlot ? member.slots[member.captainSlot] : null;
  const nextSlots = emptySlotsForFormation(formation);
  const buckets = { GK: [], DF: [], MF: [], FW: [] };
  for (const s of getSlots(formation)) buckets[s.group].push(s.code);

  const moved = [];
  for (const p of member.squad) {
    const nextCode = buckets[p.pos].shift();
    const oldCode = p.slotCode;
    p.slotCode = nextCode;
    nextSlots[nextCode] = p;
    moved.push({ playerId: p.id, fromSlotCode: oldCode, toSlotCode: nextCode });
  }

  member.formation = formation;
  member.slots = nextSlots;
  member.currentReveal = null;
  member.pickDeadline = null;
  member.draftComplete = isDraftComplete(member);
  member.tacticalStyleLocked = false;
  member.captainSlot = oldCaptainPlayer ? (member.squad.find((p) => p.id === oldCaptainPlayer.id) || {}).slotCode || null : null;
  return { changed: true, moved };
}

function movePlayerSlot(member, fromSlotCode, toSlotCode) {
  if (!member) throw new Error('not a member of this room');
  normalizeMemberSlots(member);
  if (!fromSlotCode || !toSlotCode || fromSlotCode === toSlotCode) return { moved: [] };
  const slotDefs = getSlots(member.formation);
  const fromDef = slotDefs.find((s) => s.code === fromSlotCode);
  const toDef = slotDefs.find((s) => s.code === toSlotCode);
  if (!fromDef || !toDef) throw new Error('invalid lineup slot');
  const source = member.slots[fromSlotCode];
  if (!source) throw new Error('source slot is empty');
  const target = member.slots[toSlotCode] || null;
  if (!playerFitsSlot(source, toDef)) throw new Error(`${source.name} cannot play ${toDef.short || toDef.code}`);
  if (target && !playerFitsSlot(target, fromDef)) throw new Error(`${target.name} cannot play ${fromDef.short || fromDef.code}`);

  member.slots[toSlotCode] = source;
  source.slotCode = toSlotCode;
  member.slots[fromSlotCode] = target;
  if (target) target.slotCode = fromSlotCode;

  for (const player of member.squad || []) {
    if (player.id === source.id) player.slotCode = toSlotCode;
    else if (target && player.id === target.id) player.slotCode = fromSlotCode;
  }

  if (member.captainSlot === fromSlotCode) member.captainSlot = toSlotCode;
  else if (member.captainSlot === toSlotCode && target) member.captainSlot = fromSlotCode;

  return {
    moved: [
      { playerId: source.id, fromSlotCode, toSlotCode },
      target ? { playerId: target.id, fromSlotCode: toSlotCode, toSlotCode: fromSlotCode } : null
    ].filter(Boolean)
  };
}

// Finds a random real team that still has at least one player this member can use
// (undrafted room-wide AND matching a position group the member still has an open slot for).
// A team is never revealed twice to the same member — member.seenTeams accumulates every
// team ever shown to them, whether they picked from it or rerolled away from it.
function revealForMember(roomState, userId) {
  if (roomState.sharedDraftMode) return revealSharedDraftForMember(roomState, userId);

  const member = roomState.members.get(userId);
  if (!member) throw new Error('not a member of this room');
  if (isDraftComplete(member)) return { done: true };

  const availableSlots = openSlots(member);
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
    return buildRevealPayload(team, pool, availableSlots, hideOverall, member, pickTimeMs, roomState);
  };

  const canSupply = (team) => team.players.some((p) => pool.has(p.id) && availableSlots.some((slot) => playerFitsSlot(p, slot)));

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

function sharedDraftMemberOrder(roomState) {
  const members = Array.from(roomState.members.values());
  return members.filter((m) => !isDraftComplete(m));
}

function randomItem(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function rotateAfter(members, userId) {
  if (!members.length) return [];
  const idx = members.findIndex((m) => Number(m.userId) === Number(userId));
  if (idx < 0) return members;
  return members.slice(idx + 1).concat(members.slice(0, idx + 1));
}

function sharedTeamCanSupplyMember(roomState, team, member) {
  if (!team || !member || isDraftComplete(member)) return false;
  const slots = openSlots(member);
  return team.players.some((p) => roomState.pool.has(p.id) && slots.some((slot) => playerFitsSlot(p, slot)));
}

function ensureSharedDraftState(roomState) {
  if (!roomState.sharedDraft) {
    roomState.sharedDraft = { currentTeam: null, seenTeams: [], turnUserId: null, round: 1, teamPickUserIds: [] };
  }
  const state = roomState.sharedDraft;
  if (!Array.isArray(state.teamPickUserIds)) state.teamPickUserIds = [];
  const active = sharedDraftMemberOrder(roomState);
  if (!active.length) {
    state.turnUserId = null;
    state.currentTeam = null;
    state.teamPickUserIds = [];
    return state;
  }
  if (!active.some((m) => m.userId === state.turnUserId)) state.turnUserId = active[0].userId;
  const turnMember = active.find((m) => m.userId === state.turnUserId) || active[0];
  const teamPool = roomState.allowedTeams
    ? ALL_TEAMS.filter((t) => roomState.allowedTeams.includes(t.code))
    : ALL_TEAMS;
  const current = state.currentTeam ? getTeam(state.currentTeam) : null;
  const alreadyPickedThisTeam = new Set(state.teamPickUserIds.map((id) => Number(id)));
  if (current && !alreadyPickedThisTeam.has(Number(turnMember.userId)) && sharedTeamCanSupplyMember(roomState, current, turnMember)) return state;

  const seen = new Set(state.seenTeams || []);
  const unseenPickable = teamPool.filter((t) => !seen.has(t.code) && sharedTeamCanSupplyMember(roomState, t, turnMember));
  const fallbackPickable = teamPool.filter((t) => sharedTeamCanSupplyMember(roomState, t, turnMember));
  const pickable = randomItem(unseenPickable) || randomItem(fallbackPickable);
  if (!pickable) return state;
  if (!seen.has(pickable.code)) state.seenTeams = [...(state.seenTeams || []), pickable.code];
  state.currentTeam = pickable.code;
  state.teamPickUserIds = [];
  state.round = Number(state.round || 1) + (current && current.code !== pickable.code ? 1 : 0);
  return state;
}

function advanceSharedDraftTurn(roomState, currentUserId) {
  if (!roomState.sharedDraftMode) return;
  const state = ensureSharedDraftState(roomState);
  if (!state.teamPickUserIds.some((id) => Number(id) === Number(currentUserId))) {
    state.teamPickUserIds.push(Number(currentUserId));
  }
  const active = sharedDraftMemberOrder(roomState);
  if (!active.length) {
    state.turnUserId = null;
    state.currentTeam = null;
    state.teamPickUserIds = [];
    return;
  }
  const team = state.currentTeam ? getTeam(state.currentTeam) : null;
  const picked = new Set(state.teamPickUserIds.map((id) => Number(id)));
  const remainingForTeam = rotateAfter(active, currentUserId)
    .filter((m) => !picked.has(Number(m.userId)) && sharedTeamCanSupplyMember(roomState, team, m));

  if (team && remainingForTeam.length) {
    state.turnUserId = remainingForTeam[0].userId;
    return;
  }

  state.currentTeam = null;
  state.teamPickUserIds = [];
  state.turnUserId = rotateAfter(active, currentUserId)[0].userId;
  ensureSharedDraftState(roomState);
}

function sharedDraftSnapshot(roomState, userId) {
  const state = ensureSharedDraftState(roomState);
  const active = sharedDraftMemberOrder(roomState);
  const turnMember = active.find((m) => m.userId === state.turnUserId) || null;
  return {
    enabled: !!roomState.sharedDraftMode,
    currentTeam: state.currentTeam ? { code: state.currentTeam, name: getTeam(state.currentTeam)?.name || state.currentTeam } : null,
    turnUserId: state.turnUserId,
    turnUsername: turnMember ? turnMember.username : null,
    isMyTurn: Number(state.turnUserId) === Number(userId),
    round: state.round || 1,
    teamPickCount: Array.isArray(state.teamPickUserIds) ? state.teamPickUserIds.length : 0,
    members: Array.from(roomState.members.values()).map((m) => ({
      userId: m.userId,
      username: m.username,
      draftComplete: isDraftComplete(m),
      picks: (m.squad || []).length,
      turn: Number(state.turnUserId) === Number(m.userId)
    }))
  };
}

function revealSharedDraftForMember(roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member) throw new Error('not a member of this room');
  if (isDraftComplete(member)) return { done: true, sharedDraft: sharedDraftSnapshot(roomState, userId) };

  const shared = ensureSharedDraftState(roomState);
  const team = shared.currentTeam ? getTeam(shared.currentTeam) : null;
  if (!team) return { done: false, exhausted: true, sharedDraft: sharedDraftSnapshot(roomState, userId) };
  const hideOverall = !roomState.showOverall;
  const pickTimeMs = roomState.pickTimeMs != null ? roomState.pickTimeMs : DEFAULT_PICK_TIME_MS;
  member.currentReveal = team.code;
  member.lastRevealedTeam = team.code;
  member.pickDeadline = Number(shared.turnUserId) === Number(userId) && pickTimeMs > 0 ? Date.now() + pickTimeMs : null;
  return {
    ...buildRevealPayload(team, roomState.pool, openSlots(member), hideOverall, member, pickTimeMs, roomState),
    sharedDraft: sharedDraftSnapshot(roomState, userId)
  };
}

function currentRevealForMember(roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member || !member.currentReveal || isDraftComplete(member)) return null;
  const team = getTeam(member.currentReveal);
  if (!team) return null;

  const hideOverall = !roomState.showOverall;
  const pickTimeMs = roomState.pickTimeMs != null ? roomState.pickTimeMs : DEFAULT_PICK_TIME_MS;
  const payload = buildRevealPayload(team, roomState.pool, openSlots(member), hideOverall, member, pickTimeMs, roomState);
  if (roomState.sharedDraftMode) payload.sharedDraft = sharedDraftSnapshot(roomState, userId);
  return payload;
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

function buildRevealPayload(team, pool, availableSlots, hideOverall, member, pickTimeMs, roomState) {
  let players = team.players.map((p) => ({
    id: p.id,
    name: p.name,
    pos: p.pos,
    rawPos: p.rawPos || p.pos,
    overall: hideOverall ? null : p.overall,
    isStar: p.isStar,
    poolAvailable: pool.has(p.id),
    available: pool.has(p.id) && availableSlots.some((slot) => playerFitsSlot(p, slot))
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
  if (roomState.sharedDraftMode) {
    ensureSharedDraftState(roomState);
    if (Number(roomState.sharedDraft.turnUserId) !== Number(userId)) throw new Error('wait for your turn to pick');
    member.currentReveal = roomState.sharedDraft.currentTeam;
  }
  if (!roomState.pool.has(playerId)) throw new Error('player already taken');

  const team = getTeam(member.currentReveal);
  const player = team && team.players.find((p) => p.id === playerId);
  if (!player) throw new Error('player is not part of the currently revealed team');

  const slotDef = getSlots(member.formation).find((s) => s.code === slotCode);
  if (!slotDef) throw new Error('invalid slot');
  if (!playerFitsSlot(player, slotDef)) throw new Error(`this player cannot play ${slotDef.short || slotDef.code}`);
  if (member.slots[slotCode]) throw new Error('that slot is already filled');

  roomState.pool.delete(playerId);
  const entry = { id: player.id, name: player.name, pos: player.pos, rawPos: player.rawPos || player.pos, overall: player.overall, team: team.code, slotCode, isStar: !!player.isStar };
  member.slots[slotCode] = entry;
  member.squad.push(entry);
  member.currentReveal = null;
  member.pickDeadline = null;

  const draftComplete = isDraftComplete(member);
  member.draftComplete = draftComplete;

  advanceSharedDraftTurn(roomState, userId);

  return { player: { ...player, sourceTeam: team.code, slotCode }, slotCode, draftComplete };
}

// Used when a member's pick timer expires: auto-assign the highest-overall available
// player from the currently revealed team into the first open slot that fits.
function autoPickForMember(roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member) return null;
  if (roomState.sharedDraftMode && !member.currentReveal) revealSharedDraftForMember(roomState, userId);
  if (!member.currentReveal) return null;

  const team = getTeam(member.currentReveal);
  if (!team) return null;

  const availableSlots = openSlots(member);
  const candidates = team.players
    .filter((p) => roomState.pool.has(p.id) && availableSlots.some((slot) => playerFitsSlot(p, slot)))
    .sort((a, b) => b.overall - a.overall);
  if (!candidates.length) return null;

  const chosen = candidates[0];
  const slot = openSlotsForPlayer(member, chosen)[0];
  if (!slot) return null;

  return pickPlayer(roomState, userId, chosen.id, slot.code);
}

function autoPickSharedTurn(roomState) {
  if (!roomState.sharedDraftMode) return null;
  const shared = ensureSharedDraftState(roomState);
  return shared.turnUserId ? autoPickForMember(roomState, shared.turnUserId) : null;
}

module.exports = {
  revealForMember,
  rerollForMember,
  pickPlayer,
  autoPickForMember,
  autoPickSharedTurn,
  currentRevealForMember,
  sharedDraftSnapshot,
  slotsRemaining,
  openSlots,
  openSlotsForGroup,
  openSlotsForPlayer,
  isDraftComplete,
  changeFormation,
  movePlayerSlot,
  DEFAULT_PICK_TIME_MS
};
