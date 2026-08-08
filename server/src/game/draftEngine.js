const { ALL_TEAMS, getTeam } = require('../data/teams');
const { slotsFor, POSITION_GROUPS } = require('./formations');

const MAX_REROLL_ATTEMPTS = 300;

function slotsRemaining(member) {
  const need = slotsFor(member.formation);
  const rem = {};
  for (const pos of POSITION_GROUPS) rem[pos] = need[pos] - (member.filled[pos] || 0);
  return rem;
}

function isDraftComplete(member) {
  const rem = slotsRemaining(member);
  return POSITION_GROUPS.every((pos) => rem[pos] <= 0);
}

// Finds a random real team that still has at least one player this member can use
// (undrafted room-wide AND matching a position the member still needs).
function revealForMember(roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member) throw new Error('not a member of this room');
  if (isDraftComplete(member)) return { done: true };

  const rem = slotsRemaining(member);
  const wantedPositions = new Set(POSITION_GROUPS.filter((p) => rem[p] > 0));

  const candidates = ALL_TEAMS.filter((t) => t.code !== member.lastRevealedTeam);
  const pool = roomState.pool;

  for (let i = 0; i < MAX_REROLL_ATTEMPTS; i++) {
    const team = candidates[Math.floor(Math.random() * candidates.length)];
    const available = team.players.some((p) => pool.has(p.id) && wantedPositions.has(p.pos));
    if (available) {
      member.lastRevealedTeam = team.code;
      member.currentReveal = team.code;
      return buildRevealPayload(team, pool, wantedPositions);
    }
  }

  // Fallback: exhaustively scan every team once (covers small unlucky pools).
  for (const team of ALL_TEAMS) {
    const available = team.players.some((p) => pool.has(p.id) && wantedPositions.has(p.pos));
    if (available) {
      member.lastRevealedTeam = team.code;
      member.currentReveal = team.code;
      return buildRevealPayload(team, pool, wantedPositions);
    }
  }

  return { done: false, exhausted: true };
}

function buildRevealPayload(team, pool, wantedPositions) {
  return {
    done: false,
    team: { code: team.code, name: team.name },
    players: team.players.map((p) => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      overall: p.overall,
      isStar: p.isStar,
      available: pool.has(p.id) && wantedPositions.has(p.pos)
    }))
  };
}

function pickPlayer(roomState, userId, playerId) {
  const member = roomState.members.get(userId);
  if (!member) throw new Error('not a member of this room');
  if (!roomState.pool.has(playerId)) throw new Error('player already taken');

  const team = getTeam(member.currentReveal);
  const player = team && team.players.find((p) => p.id === playerId);
  if (!player) throw new Error('player is not part of the currently revealed team');

  const rem = slotsRemaining(member);
  if (rem[player.pos] <= 0) throw new Error(`no remaining slots for position ${player.pos}`);

  roomState.pool.delete(playerId);
  member.filled[player.pos] = (member.filled[player.pos] || 0) + 1;
  member.squad.push({ id: player.id, name: player.name, pos: player.pos, overall: player.overall, team: team.code });
  member.currentReveal = null;

  const draftComplete = isDraftComplete(member);
  member.draftComplete = draftComplete;

  return { player: { ...player, sourceTeam: team.code }, draftComplete };
}

module.exports = { revealForMember, pickPlayer, slotsRemaining, isDraftComplete };
