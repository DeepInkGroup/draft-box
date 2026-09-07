function memberReady(member, captainEnabled) {
  return !!member.draftComplete
    && !!member.tacticalStyleLocked
    && (!captainEnabled || !!member.captainSlot);
}

function allMembersReady(roomState) {
  const members = Array.from(roomState.members.values());
  return members.length > 0 && members.every((member) => memberReady(member, roomState.captainEnabled));
}

function shouldAutoStartTournament(roomState) {
  return !!(roomState.singlePlayer || roomState.spoilerMode) && allMembersReady(roomState);
}

function spoilerGateMembers(roomState) {
  return Array.from(roomState.members.values()).filter((member) => !member.eliminated);
}

function ensureAdvanceReady(roomState) {
  const tournament = roomState.tournament;
  const step = tournament && Array.isArray(tournament.history) ? tournament.history.length : 0;
  if (!tournament.advanceReady || tournament.advanceReady.step !== step || !Array.isArray(tournament.advanceReady.userIds)) {
    tournament.advanceReady = { step, userIds: [] };
  }
  tournament.advanceReady.userIds = [...new Set(
    tournament.advanceReady.userIds.map((id) => Number(id)).filter(Number.isFinite)
  )];
  return tournament.advanceReady;
}

function advanceReadySnapshot(roomState) {
  const ready = ensureAdvanceReady(roomState);
  const readyIds = new Set(ready.userIds);
  const allMembers = Array.from(roomState.members.values());
  const gateMembers = spoilerGateMembers(roomState);
  const allReady = gateMembers.every((member) => readyIds.has(Number(member.userId)));
  const showEliminationBadges = allReady || roomState.tournament.stage === 'done';

  return {
    spoilerMode: !!roomState.spoilerMode,
    step: ready.step,
    allReady,
    requiredMemberCount: gateMembers.length,
    showEliminationBadges,
    members: allMembers.map((member) => ({
      userId: member.userId,
      username: member.username,
      eliminated: showEliminationBadges ? !!member.eliminated : false,
      ready: !member.eliminated && readyIds.has(Number(member.userId)),
      required: !member.eliminated
    }))
  };
}

module.exports = {
  memberReady,
  allMembersReady,
  shouldAutoStartTournament,
  spoilerGateMembers,
  ensureAdvanceReady,
  advanceReadySnapshot
};
