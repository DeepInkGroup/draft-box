const LobbyView = {
  async render(container, code) {
    container.innerHTML = `<div class="card center muted">Loading room...</div>`;

    let room;
    try {
      room = await Api.getRoom(code);
    } catch (e) {
      container.innerHTML = `<div class="card"><p class="error-text">${e.message}</p></div>`;
      return;
    }

    if (room.status !== 'lobby') {
      if (room.status === 'drafting') return App.goDraft(code);
      return App.goTournament(code);
    }

    const isCreator = room.creatorId === App.state.user.id;

    container.innerHTML = `
      <div class="card center">
        <p class="muted">Share this code with your friends so they can join the room</p>
        <div class="code-display">${room.code}</div>
        <p class="muted">Human player capacity: <b id="lobbySlots"></b></p>
${room.mode === 'league' ? `<div id="lobbyLeagueSettings"><h3>${room.leagueName}</h3><p class="muted">${room.squadMode === 'real' ? 'Real Club Squads' : 'Draft Style'} &middot; ${room.leagueClubs.length} clubs &middot; ${room.transferEnabled ? 'Mid-season transfers: up to ' + room.transferLimit + (room.transferLimit === 1 ? ' player' : ' players') : 'Mid-season transfers closed'}</p><p class="muted">Unclaimed clubs are managed by bots. During open transfer windows, every player completes or skips transfers before play resumes.</p></div>` : ''}
        <p class="muted">Spoiler mode: <b>${room.spoilerMode ? 'On' : 'Off'}</b></p>
      </div>
      <div class="card">
        <h3>👥 Members Present</h3>
        <ul class="member-list ${room.mode === 'league' ? 'league-lobby-members' : ''}" id="memberList"></ul>
      </div>
      <div class="card">
        <h3>Your Formation</h3>
        <p class="muted">Changing your formation resets which exact slots (e.g. LB vs RB) are open — pick it before the draft starts.</p>
        <div id="myFormation"></div>
      </div>
      ${isCreator ? `<button id="btnStart" class="btn btn-primary btn-block">${room.squadMode === 'real' ? 'Prepare Club Squads' : 'Start Draft'}</button>` : '<p class="muted center">Waiting for the room creator to start the game...</p>'}
      <div class="error-text hidden" id="lobbyError"></div>
    `;

    const memberList = container.querySelector('#memberList');
    const slotsEl = container.querySelector('#lobbySlots');

    function renderMembers(snap) {
      slotsEl.textContent = `${snap.members.length} / ${snap.humanSlotsMax}`;
      memberList.innerHTML = snap.members.map((m) => `
        <li class="${m.userId === snap.creatorId ? 'member-leader' : ''}">
          <span class="member-name">${m.userId === snap.creatorId ? '<span class="leader-star">*</span>' : ''}${m.username}${m.userId === App.state.user.id ? ' (you)' : ''}${m.userId === snap.creatorId ? '<span class="leader-badge">Leader</span>' : ''}</span>
          <span class="badge">${snap.mode === 'league' ? (snap.leagueClubs.find(club=>club.code===m.clubCode)?.name || m.clubCode) + ' &middot; ' : ''}${m.formation}</span>
        </li>
      `).join('');
    }
    renderMembers(room);

    const me = room.members.find((m) => m.userId === App.state.user.id);
    FormationPicker.render(container.querySelector('#myFormation'), {
      selected: me ? me.formation : '4-3-3',
      onChange: async (formation) => {
        try { await Api.setFormation(code, formation); }
        catch (e) { App.toast(e.message, true); }
      }
    });

    const socket = App.ensureSocket();
    App.onSocket('room:memberUpdate', renderMembers);
    App.onSocket('room:started', () => App.goDraft(code));
    App.onSocket('error:message', (e) => App.toast(e.error, true));

    const startBtn = container.querySelector('#btnStart');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        socket.emit('room:start', { code });
      });
    }

    socket.emit('room:join', { code });
  }
};
