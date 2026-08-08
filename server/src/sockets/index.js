const { verifyToken } = require('../middleware/auth');
const rm = require('../game/roomManager');
const draftEngine = require('../game/draftEngine');
const tournamentEngine = require('../game/tournamentEngine');
const { lobbySnapshot } = rm;

function channelName(code) {
  return `room:${code}`;
}

function myDraftView(member) {
  return {
    squad: member.squad,
    slots: member.slots,
    openSlots: draftEngine.openSlots(member),
    draftComplete: member.draftComplete
  };
}

function clearPickTimer(member) {
  if (member.pickTimer) {
    clearTimeout(member.pickTimer);
    member.pickTimer = null;
  }
}

function maybeStartTournament(io, roomRow, roomState) {
  if (!rm.allMembersDraftComplete(roomState)) return false;
  tournamentEngine.startTournament(roomState);
  rm.setRoomStatus(roomRow.id, 'group_stage');
  rm.persistTournamentSnapshot(roomState);
  io.to(channelName(roomRow.code)).emit('tournament:started', tournamentEngine.getPublicState(roomState));
  return true;
}

// Shared by both the manual draft:pick handler and the auto-pick timeout, so a pick
// always has the exact same persistence + broadcast side effects regardless of source.
function applyPickSideEffects(io, code, roomState, userId, { player, slotCode, draftComplete }, auto) {
  rm.persistPick(roomState.roomId, userId, player, player.sourceTeam, slotCode);
  if (draftComplete) rm.markMemberDraftComplete(roomState.roomId, userId);

  const member = roomState.members.get(userId);
  io.to(channelName(code)).emit('draft:picked', { userId, player, slotCode, auto: !!auto, ...myDraftView(member) });
  io.to(channelName(code)).emit('draft:poolUpdate', { playerId: player.id, poolRemaining: roomState.pool.size });

  const freshRoomRow = rm.getRoomRow(roomState.roomId);
  const started = maybeStartTournament(io, freshRoomRow, roomState);
  if (!started) io.to(channelName(code)).emit('room:memberUpdate', lobbySnapshot(freshRoomRow));
}

function scheduleAutoPick(io, code, roomState, userId) {
  const member = roomState.members.get(userId);
  if (!member) return;
  clearPickTimer(member);
  // small grace buffer over the client-visible deadline to absorb network/render latency
  member.pickTimer = setTimeout(() => {
    member.pickTimer = null;
    const result = draftEngine.autoPickForMember(roomState, userId);
    if (result) applyPickSideEffects(io, code, roomState, userId, result, true);
  }, draftEngine.PICK_TIME_MS + 250);
}

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token && verifyToken(token);
    if (!payload) return next(new Error('unauthorized'));
    socket.user = payload;
    next();
  });

  io.on('connection', (socket) => {
    socket.on('room:join', ({ code }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow) return socket.emit('error:message', { error: 'room not found' });
      socket.join(channelName(roomRow.code));
      socket.data.roomCode = roomRow.code;

      if (roomRow.status === 'lobby') {
        socket.emit('room:state', { stage: 'lobby', ...lobbySnapshot(roomRow) });
      } else if (roomRow.status === 'drafting') {
        const state = rm.loadRoomState(roomRow);
        const member = state.members.get(socket.user.id);
        socket.emit('room:state', {
          stage: 'drafting',
          ...lobbySnapshot(roomRow),
          myDraft: member && myDraftView(member),
          poolRemaining: state.pool.size
        });
      } else {
        const state = rm.loadRoomState(roomRow);
        socket.emit('room:state', { stage: 'tournament', ...lobbySnapshot(roomRow), tournament: tournamentEngine.getPublicState(state) });
      }

      io.to(channelName(roomRow.code)).emit('room:memberUpdate', lobbySnapshot(roomRow));
    });

    socket.on('room:start', ({ code }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow) return socket.emit('error:message', { error: 'room not found' });
      if (roomRow.creator_id !== socket.user.id) return socket.emit('error:message', { error: 'only the room creator can start the draft' });
      if (roomRow.status !== 'lobby') return socket.emit('error:message', { error: 'room already started' });
      rm.setRoomStatus(roomRow.id, 'drafting');
      io.to(channelName(roomRow.code)).emit('room:started', {});
    });

    socket.on('draft:reveal', ({ code }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow || roomRow.status !== 'drafting') return socket.emit('error:message', { error: 'draft is not active for this room' });
      const state = rm.loadRoomState(roomRow);
      try {
        const payload = draftEngine.revealForMember(state, socket.user.id);
        socket.emit('draft:reveal', payload);
        if (!payload.done && !payload.exhausted) scheduleAutoPick(io, roomRow.code, state, socket.user.id);
      } catch (e) {
        socket.emit('error:message', { error: e.message });
      }
    });

    socket.on('draft:pick', ({ code, playerId, slotCode }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow || roomRow.status !== 'drafting') return socket.emit('error:message', { error: 'draft is not active for this room' });
      const state = rm.loadRoomState(roomRow);
      const member = state.members.get(socket.user.id);
      try {
        if (member) clearPickTimer(member);
        const result = draftEngine.pickPlayer(state, socket.user.id, playerId, slotCode);
        applyPickSideEffects(io, roomRow.code, state, socket.user.id, result, false);
      } catch (e) {
        socket.emit('error:message', { error: e.message });
      }
    });

    socket.on('tournament:simulateNext', ({ code }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow || !['group_stage', 'knockout'].includes(roomRow.status)) {
        return socket.emit('error:message', { error: 'tournament is not active for this room' });
      }
      const state = rm.loadRoomState(roomRow);
      try {
        const step = tournamentEngine.simulateNextStep(state);

        for (const member of state.members.values()) {
          if (member.eliminated) rm.markMemberEliminated(roomRow.id, member.userId);
        }

        if (state.tournament.stage !== 'group' && roomRow.status === 'group_stage') {
          rm.setRoomStatus(roomRow.id, 'knockout');
        }
        if (state.tournament.stage === 'done') {
          rm.setRoomStatus(roomRow.id, 'finished');
        }
        rm.persistTournamentSnapshot(state);

        io.to(channelName(roomRow.code)).emit('tournament:update', {
          step,
          tournament: tournamentEngine.getPublicState(state)
        });
      } catch (e) {
        socket.emit('error:message', { error: e.message });
      }
    });

    socket.on('disconnect', () => {
      // no server-side game-state changes on disconnect; state (and any running pick
      // timer) persists in memory and the draft can be resumed on reconnect.
    });
  });
}

module.exports = { registerSocketHandlers };
