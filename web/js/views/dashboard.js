const DashboardView = {
  render(container) {
    container.innerHTML = `
      <div class="card center">
        <h2>🌍 World Cup 2026</h2>
        <p class="muted">Currently the only active mode. Club league mode is coming soon.</p>
      </div>

      <div class="card">
        <h3>⚡ Single Player</h3>
        <p class="muted">Jump straight into the draft and compete in the World Cup against 47 bot teams.</p>
        <div class="field">
          <label>Formation</label>
          <select id="spFormation">${FORMATIONS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select>
        </div>
        <button id="btnSingleplayer" class="btn btn-primary btn-block">Start Single Player</button>
      </div>

      <div class="row">
        <div class="card">
          <h3>➕ Create a New Room</h3>
          <div class="field">
            <label>Room name</label>
            <input type="text" id="crName" placeholder="Friends Room" />
          </div>
          <div class="field">
            <label>Max human players (1 to 32)</label>
            <input type="number" id="crSlots" min="1" max="32" value="8" />
          </div>
          <div class="field">
            <label>Your formation</label>
            <select id="crFormation">${FORMATIONS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select>
          </div>
          <button id="btnCreateRoom" class="btn btn-primary btn-block">Create Room &amp; Get Code</button>
        </div>

        <div class="card">
          <h3>🔑 Join with a Code</h3>
          <div class="field">
            <label>Room code</label>
            <input type="text" id="joinCode" placeholder="e.g. AB12CD" style="text-transform:uppercase" />
          </div>
          <div class="field">
            <label>Your formation</label>
            <select id="joinFormation">${FORMATIONS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select>
          </div>
          <button id="btnJoinRoom" class="btn btn-primary btn-block">Join</button>
        </div>
      </div>
      <div class="error-text hidden" id="dashError"></div>
    `;

    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    container.querySelector('#btnSingleplayer').addEventListener('click', async () => {
      try {
        const room = await Api.createSingleplayer(container.querySelector('#spFormation').value);
        App.goDraft(room.code);
      } catch (e) { showErr(e); }
    });

    container.querySelector('#btnCreateRoom').addEventListener('click', async () => {
      try {
        const name = container.querySelector('#crName').value.trim();
        const slots = Number(container.querySelector('#crSlots').value) || 8;
        const formation = container.querySelector('#crFormation').value;
        const room = await Api.createRoom(name, slots, formation);
        App.goLobby(room.code);
      } catch (e) { showErr(e); }
    });

    container.querySelector('#btnJoinRoom').addEventListener('click', async () => {
      try {
        const code = container.querySelector('#joinCode').value.trim().toUpperCase();
        const formation = container.querySelector('#joinFormation').value;
        if (!code) return showErr(new Error('Enter a room code'));
        await Api.joinRoom(code, formation);
        App.goLobby(code);
      } catch (e) { showErr(e); }
    });
  }
};
