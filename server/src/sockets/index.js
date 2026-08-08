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
    draftComplete: member.draftComplete,
    captainSlot: member.captainSlot
  };
}

// A member is fully ready to enter the tournament once their draft is complete AND,
// if the room has captains enabled, they've chosen one.
function memberReady(member, captainEnabled) {
  return member.draftComplete && (!captainEnabled || !!member.captainSlot);
}

function clearPickTimer(member) {
  if (member.pickTimer) {
    clearTimeout(member.pickTimer);
    member.pickTimer = null;
  }
}

function maybeStartTournament(io, roomRow, roomState) {
  const allReady = Array.from(roomState.members.values()).every((m) => memberReady(m, roomState.captainEnabled));
  if (!allReady) return false;
  tournamentEngine.startTournament(roomState);
  rm.setRoomStatus(roomRow.id, 'group_stage');
  rm.persistTournamentSnapshot(roomState);
  // Deliberately no results payload here: every member pulls the tournament's
  // steps at their own pace via tournament:advance once they land on the view.
  io.to(channelName(roomRow.code)).emit('tournament:started', {});
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
  }, (roomState.pickTimeMs || draftEngine.DEFAULT_PICK_TIME_MS) + 250);
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
        const member = state.members.get(socket.user.id);
        const viewedStep = member ? member.viewedStep : 0;
        socket.emit('room:state', {
          stage: 'tournament',
          ...lobbySnapshot(roomRow),
          myStep: viewedStep > 0 ? tournamentEngine.decorateStep(state, viewedStep - 1) : null,
          viewedStep,
          historyLength: tournamentEngine.historyLength(state),
          tournamentStage: state.tournament.stage
        });
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

    socket.on('draft:setCaptain', ({ code, slotCode }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow || roomRow.status !== 'drafting') return socket.emit('error:message', { error: 'draft is not active for this room' });
      if (!roomRow.captain_enabled) return socket.emit('error:message', { error: 'captains are not enabled for this room' });
      const state = rm.loadRoomState(roomRow);
      const member = state.members.get(socket.user.id);
      if (!member) return socket.emit('error:message', { error: 'not a member of this room' });
      if (!member.draftComplete) return socket.emit('error:message', { error: 'finish drafting your squad before choosing a captain' });
      if (!member.slots[slotCode]) return socket.emit('error:message', { error: 'that slot is not part of your squad' });

      member.captainSlot = slotCode;
      rm.persistCaptain(roomRow.id, socket.user.id, slotCode);
      socket.emit('draft:captainSet', { slotCode });

      const freshRoomRow = rm.getRoomRow(roomRow.id);
      const started = maybeStartTournament(io, freshRoomRow, state);
      if (!started) io.to(channelName(roomRow.code)).emit('room:memberUpdate', lobbySnapshot(freshRoomRow));
    });

    // Each member pulls the shared tournament forward at their own pace: if the room's
    // simulation is already ahead of what this member has seen, they just get caught up
    // by one step (no new simulation). Only the member who is fully caught up and asks
    // for more actually triggers the next matchday/round — which is why one person
    // clicking through does NOT jump everyone else's screen forward; others only see a
    // "new results available" ping until they click their own button.
    socket.on('tournament:advance', ({ code }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow || !['group_stage', 'knockout', 'finished'].includes(roomRow.status)) {
        return socket.emit('error:message', { error: 'tournament is not active for this room' });
      }
      const state = rm.loadRoomState(roomRow);
      const member = state.members.get(socket.user.id);
      if (!member) return socket.emit('error:message', { error: 'not a member of this room' });
      const t = state.tournament;

      try {
        if (member.viewedStep >= tournamentEngine.historyLength(state)) {
          if (t.stage === 'done') {
            return socket.emit('error:message', { error: 'the tournament has already finished' });
          }
          tournamentEngine.simulateNextStep(state);

          for (const m of state.members.values()) {
            if (m.eliminated) rm.markMemberEliminated(roomRow.id, m.userId);
          }
          if (t.stage !== 'group' && roomRow.status === 'group_stage') {
            rm.setRoomStatus(roomRow.id, 'knockout');
          }
          if (t.stage === 'done') {
            rm.setRoomStatus(roomRow.id, 'finished');
          }
          rm.persistTournamentSnapshot(state);

          socket.to(channelName(code)).emit('tournament:newStepAvailable', { historyLength: tournamentEngine.historyLength(state) });
        }

        member.viewedStep += 1;
        rm.persistViewedStep(roomRow.id, socket.user.id, member.viewedStep);

        socket.emit('tournament:step', {
          step: tournamentEngine.decorateStep(state, member.viewedStep - 1),
          viewedStep: member.viewedStep,
          historyLength: tournamentEngine.historyLength(state),
          stage: t.stage
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
