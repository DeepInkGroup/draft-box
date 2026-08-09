const { verifyToken } = require('../middleware/auth');
const rm = require('../game/roomManager');
const draftEngine = require('../game/draftEngine');
const tournamentEngine = require('../game/tournamentEngine');
const { computeSquadCard, computeChampionshipOdds, predictKeyPlayers } = require('../game/ratings');
const { lobbySnapshot } = rm;

function channelName(code) {
  return `room:${code}`;
}

// showOverall respects the room's "Show Ratings" setting: in blind-mode rooms we don't
// send a ratings breakdown either, since that would leak exactly what the mode hides.
function myDraftView(member, showOverall) {
  let ratingsCard = null;
  if (member.draftComplete && showOverall) {
    const taggedSquad = member.squad.map((p) => ({ ...p, isCaptain: !!member.captainSlot && p.slotCode === member.captainSlot }));
    ratingsCard = computeSquadCard(taggedSquad, member.formation);
  }
  return {
    squad: member.squad,
    slots: member.slots,
    openSlots: draftEngine.openSlots(member),
    draftComplete: member.draftComplete,
    captainSlot: member.captainSlot,
    ratingsCard
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
  io.to(channelName(code)).emit('draft:picked', { userId, player, slotCode, auto: !!auto, ...myDraftView(member, roomState.showOverall) });
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
          myDraft: member && myDraftView(member, state.showOverall),
          poolRemaining: state.pool.size
        });
      } else {
        const state = rm.loadRoomState(roomRow);
        const member = state.members.get(socket.user.id);
        const viewedStep = member ? member.viewedStep : 0;
        const mySlot = Object.values(state.tournament.slotByCode).find((s) => s.isHuman && s.userId === socket.user.id);
        let myLineup = null;
        if (mySlot) {
          const odds = computeChampionshipOdds(state.tournament.slotByCode);
          const prediction = predictKeyPlayers(mySlot.xi, mySlot.formation);
          myLineup = {
            code: mySlot.code,
            formation: mySlot.formation,
            xi: mySlot.xi,
            countryName: mySlot.name,
            championshipChance: odds[mySlot.code],
            predictedTopScorer: prediction.topScorer,
            predictedTopAssist: prediction.topAssist
          };
        }
        socket.emit('room:state', {
          stage: 'tournament',
          ...lobbySnapshot(roomRow),
          myStep: viewedStep > 0 ? tournamentEngine.decorateStep(state, viewedStep - 1, socket.user.id) : null,
          myLineup,
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

    // Recreates a finished room with identical settings and auto-joins every previous
    // human member (carrying over their prior formation) so nobody needs to be manually
    // re-invited via a new code — every connected client in the old room's channel gets
    // redirected straight into the new lobby.
    socket.on('room:rematch', ({ code }) => {
      const roomRow = rm.getRoomByCode(code);
      if (!roomRow) return socket.emit('error:message', { error: 'room not found' });
      if (roomRow.creator_id !== socket.user.id) return socket.emit('error:message', { error: 'only the room creator can start a rematch' });
      if (roomRow.status !== 'finished') return socket.emit('error:message', { error: 'the tournament has not finished yet' });

      const members = rm.getMembers(roomRow.id);
      const allowedTeams = roomRow.allowed_teams ? JSON.parse(roomRow.allowed_teams) : null;
      const newRoom = rm.createRoom({
        name: roomRow.name,
        creatorId: roomRow.creator_id,
        humanSlotsMax: roomRow.human_slots_max,
        singlePlayer: !!roomRow.single_player,
        showOverall: !!roomRow.show_overall,
        pickTimeMs: roomRow.pick_time_ms,
        captainEnabled: !!roomRow.captain_enabled,
        tournamentLength: roomRow.tournament_length,
        allowedTeams
      });
      for (const m of members) {
        rm.joinRoom(newRoom, { id: m.user_id, username: m.username }, m.formation);
      }
      if (newRoom.single_player) rm.setRoomStatus(newRoom.id, 'drafting');
      io.to(channelName(roomRow.code)).emit('room:rematchReady', { newCode: newRoom.code });
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
      socket.emit('draft:captainSet', { slotCode, ...myDraftView(member, state.showOverall) });

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
          step: tournamentEngine.decorateStep(state, member.viewedStep - 1, socket.user.id),
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
