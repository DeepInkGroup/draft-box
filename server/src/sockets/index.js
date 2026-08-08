const { verifyToken } = require('../middleware/auth');
const rm = require('../game/roomManager');
const draftEngine = require('../game/draftEngine');
const tournamentEngine = require('../game/tournamentEngine');
const { lobbySnapshot } = rm;

function channelName(code) {
  return `room:${code}`;
}

function maybeStartTournament(io, roomRow, roomState) {
  if (!rm.allMembersDraftComplete(roomState)) return false;
  tournamentEngine.startTournament(roomState);
  rm.setRoomStatus(roomRow.id, 'group_stage');
  rm.persistTournamentSnapshot(roomState);
  io.to(channelName(roomRow.code)).emit('tournament:started', tournamentEngine.getPublicState(roomState));
  return true;
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
          myDraft: member && {
            squad: member.squad,
            filled: member.filled,
            remaining: draftEngine.slotsRemaining(member),
            draftComplete: member.draftComplete
          },
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
      } catch (e) {
        socket.emit('error:message', { error: e.message });
      }
    });

    socket.on('draft:pick', ({ code, playerId }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow || roomRow.status !== 'drafting') return socket.emit('error:message', { error: 'draft is not active for this room' });
      const state = rm.loadRoomState(roomRow);
      try {
        const { player, draftComplete } = draftEngine.pickPlayer(state, socket.user.id, playerId);
        rm.persistPick(roomRow.id, socket.user.id, player, player.sourceTeam);
        if (draftComplete) rm.markMemberDraftComplete(roomRow.id, socket.user.id);

        const member = state.members.get(socket.user.id);
        socket.emit('draft:picked', {
          player,
          squad: member.squad,
          filled: member.filled,
          remaining: draftEngine.slotsRemaining(member),
          draftComplete
        });
        io.to(channelName(roomRow.code)).emit('draft:poolUpdate', { playerId: player.id, poolRemaining: state.pool.size });

        const started = maybeStartTournament(io, rm.getRoomRow(roomRow.id), state);
        if (!started) {
          io.to(channelName(roomRow.code)).emit('room:memberUpdate', lobbySnapshot(rm.getRoomRow(roomRow.id)));
        }
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
      // no server-side game-state changes on disconnect; state persists and can be resumed.
    });
  });
}

module.exports = { registerSocketHandlers };
