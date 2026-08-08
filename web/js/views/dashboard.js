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
        <div id="spFormation"></div>
        <div class="field"><label>Show Ratings</label></div>
        <div id="spRatings" style="margin-bottom:16px;"></div>
        <button id="btnSingleplayer" class="btn btn-primary btn-block">Start Single Player</button>
      </div>

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
        <div id="crFormation"></div>
        <div class="field"><label>Show Ratings</label></div>
        <div id="crRatings" style="margin-bottom:16px;"></div>
        <button id="btnCreateRoom" class="btn btn-primary btn-block">Create Room &amp; Get Code</button>
      </div>

      <div class="card">
        <h3>🔑 Join with a Code</h3>
        <div class="field">
          <label>Room code</label>
          <input type="text" id="joinCode" placeholder="e.g. AB12CD" style="text-transform:uppercase" />
        </div>
        <div id="joinFormation"></div>
        <button id="btnJoinRoom" class="btn btn-primary btn-block">Join</button>
      </div>
      <div class="error-text hidden" id="dashError"></div>
    `;

    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    const ratingsOptions = [
      { value: true, title: 'On', sub: 'Player overalls visible' },
      { value: false, title: 'Off', sub: 'Blind mode: trust your gut' }
    ];

    const spFormation = FormationPicker.render(container.querySelector('#spFormation'), { selected: '4-3-3' });
    const spRatings = ToggleGroup.render(container.querySelector('#spRatings'), { options: ratingsOptions, selected: true });

    const crFormation = FormationPicker.render(container.querySelector('#crFormation'), { selected: '4-3-3' });
    const crRatings = ToggleGroup.render(container.querySelector('#crRatings'), { options: ratingsOptions, selected: true });

    const joinFormation = FormationPicker.render(container.querySelector('#joinFormation'), { selected: '4-3-3' });

    container.querySelector('#btnSingleplayer').addEventListener('click', async () => {
      try {
        const room = await Api.createSingleplayer(spFormation.value, spRatings.value);
        App.goDraft(room.code);
      } catch (e) { showErr(e); }
    });

    container.querySelector('#btnCreateRoom').addEventListener('click', async () => {
      try {
        const name = container.querySelector('#crName').value.trim();
        const slots = Number(container.querySelector('#crSlots').value) || 8;
        const room = await Api.createRoom(name, slots, crFormation.value, crRatings.value);
        App.goLobby(room.code);
      } catch (e) { showErr(e); }
    });

    container.querySelector('#btnJoinRoom').addEventListener('click', async () => {
      try {
        const code = container.querySelector('#joinCode').value.trim().toUpperCase();
        if (!code) return showErr(new Error('Enter a room code'));
        await Api.joinRoom(code, joinFormation.value);
        App.goLobby(code);
      } catch (e) { showErr(e); }
    });
  }
};
