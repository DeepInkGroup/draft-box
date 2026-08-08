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
      </div>
      <div class="card">
        <h3>👥 Members Present</h3>
        <ul class="member-list" id="memberList"></ul>
      </div>
      <div class="card">
        <h3>Your Formation</h3>
        <select id="myFormation">${FORMATIONS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select>
      </div>
      ${isCreator ? '<button id="btnStart" class="btn btn-primary btn-block">🚀 Start Draft</button>' : '<p class="muted center">Waiting for the room creator to start the game...</p>'}
      <div class="error-text hidden" id="lobbyError"></div>
    `;

    const memberList = container.querySelector('#memberList');
    const slotsEl = container.querySelector('#lobbySlots');

    function renderMembers(snap) {
      slotsEl.textContent = `${snap.members.length} / ${snap.humanSlotsMax}`;
      memberList.innerHTML = snap.members.map((m) => `
        <li>
          <span>${m.username}${m.userId === App.state.user.id ? ' (you)' : ''}</span>
          <span class="badge">${m.formation}</span>
        </li>
      `).join('');
    }
    renderMembers(room);

    const myFormationSelect = container.querySelector('#myFormation');
    const me = room.members.find((m) => m.userId === App.state.user.id);
    if (me) myFormationSelect.value = me.formation;
    myFormationSelect.addEventListener('change', async () => {
      try { await Api.setFormation(code, myFormationSelect.value); }
      catch (e) { App.toast(e.message, true); }
    });

    const socket = App.ensureSocket();
    socket.emit('room:join', { code });
    App.onSocket('room:memberUpdate', renderMembers);
    App.onSocket('room:started', () => App.goDraft(code));

    const startBtn = container.querySelector('#btnStart');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        socket.emit('room:start', { code });
      });
    }
  }
};
