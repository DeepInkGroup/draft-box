const DashboardView = {
  render(container) {
    this.renderModeSelect(container);
  },

  renderModeSelect(container) {
    container.innerHTML = `
      <div class="card center">
        <h2>World Cup 2026</h2>
        <p class="muted">Currently the only active mode. Club league mode is coming soon.</p>
      </div>
      <div class="mode-grid">
        <div class="mode-card" id="modeSingle">
          <h3>Single Player</h3>
          <p class="muted">Draft alone, then take on 47 bot-controlled countries.</p>
        </div>
        <div class="mode-card" id="modeCreate">
          <h3>Create Room</h3>
          <p class="muted">Set up a room, get a code, invite friends.</p>
        </div>
        <div class="mode-card" id="modeJoin">
          <h3>Join Room</h3>
          <p class="muted">Already have a code? Jump into a friend's room.</p>
        </div>
      </div>
    `;
    container.querySelector('#modeSingle').addEventListener('click', () => this.renderSingleplayer(container));
    container.querySelector('#modeCreate').addEventListener('click', () => this.renderCreateRoom(container));
    container.querySelector('#modeJoin').addEventListener('click', () => this.renderJoinRoom(container));
  },

  backButton() {
    return `<button class="btn btn-ghost" id="btnBack">&larr; Back</button>`;
  },

  wireBack(container) {
    container.querySelector('#btnBack').addEventListener('click', () => this.renderModeSelect(container));
  },

  ratingsOptions() {
    return [
      { value: true, title: 'On', sub: 'Player overalls visible' },
      { value: false, title: 'Off', sub: 'Blind mode: trust your gut' }
    ];
  },

  captainOptions() {
    return [
      { value: false, title: 'Off', sub: 'No captain bonus' },
      { value: true, title: 'On', sub: 'Pick a captain for a rating boost' }
    ];
  },

  blitzOptions() {
    return [
      { value: false, title: 'Off', sub: 'Full 48-team group stage' },
      { value: true, title: 'Blitz', sub: 'Skip groups — start at Round of 32' }
    ];
  },

  timerOptions() {
    return [
      { value: 10000, title: '10s', sub: 'Fast' },
      { value: 20000, title: '20s', sub: 'Default' },
      { value: 30000, title: '30s', sub: 'Relaxed' },
      { value: 60000, title: '60s', sub: 'Chill' }
    ];
  },

  renderSingleplayer(container) {
    container.innerHTML = `
      ${this.backButton()}
      <div class="card">
        <h3>Single Player</h3>
        <p class="muted">Jump straight into the draft and compete in the World Cup against 47 bot teams.</p>
        <div id="spFormation"></div>
        <div class="field"><label>Pick Timer</label></div>
        <div id="spTimer" style="margin-bottom:16px;"></div>
        <div class="field"><label>Show Ratings</label></div>
        <div id="spRatings" style="margin-bottom:16px;"></div>
        <div class="field"><label>Team Captain</label></div>
        <div id="spCaptain" style="margin-bottom:16px;"></div>
        <div class="field"><label>Tournament Length</label></div>
        <div id="spBlitz" style="margin-bottom:16px;"></div>
        <button id="btnSingleplayer" class="btn btn-primary btn-block">Start Single Player</button>
        <div class="error-text hidden" id="dashError"></div>
      </div>
    `;
    this.wireBack(container);
    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    const spFormation = FormationPicker.render(container.querySelector('#spFormation'), { selected: '4-3-3' });
    const spTimer = ToggleGroup.render(container.querySelector('#spTimer'), { options: this.timerOptions(), selected: 20000 });
    const spRatings = ToggleGroup.render(container.querySelector('#spRatings'), { options: this.ratingsOptions(), selected: true });
    const spCaptain = ToggleGroup.render(container.querySelector('#spCaptain'), { options: this.captainOptions(), selected: false });
    const spBlitz = ToggleGroup.render(container.querySelector('#spBlitz'), { options: this.blitzOptions(), selected: false });

    container.querySelector('#btnSingleplayer').addEventListener('click', async () => {
      try {
        const room = await Api.createSingleplayer(spFormation.value, spRatings.value, spTimer.value, spCaptain.value, spBlitz.value);
        App.goDraft(room.code);
      } catch (e) { showErr(e); }
    });
  },

  renderCreateRoom(container) {
    container.innerHTML = `
      ${this.backButton()}
      <div class="card">
        <h3>Create a New Room</h3>
        <div class="field">
          <label>Room name</label>
          <input type="text" id="crName" placeholder="Friends Room" />
        </div>
        <div class="field">
          <label>Max human players (1 to 32)</label>
          <input type="number" id="crSlots" min="1" max="32" value="8" />
        </div>
        <div id="crFormation"></div>
        <div class="field"><label>Pick Timer</label></div>
        <div id="crTimer" style="margin-bottom:16px;"></div>
        <div class="field"><label>Show Ratings</label></div>
        <div id="crRatings" style="margin-bottom:16px;"></div>
        <div class="field"><label>Team Captain</label></div>
        <div id="crCaptain" style="margin-bottom:16px;"></div>
        <div class="field"><label>Tournament Length</label></div>
        <div id="crBlitz" style="margin-bottom:16px;"></div>
        <button id="btnCreateRoom" class="btn btn-primary btn-block">Create Room &amp; Get Code</button>
        <div class="error-text hidden" id="dashError"></div>
      </div>
    `;
    this.wireBack(container);
    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    const crFormation = FormationPicker.render(container.querySelector('#crFormation'), { selected: '4-3-3' });
    const crTimer = ToggleGroup.render(container.querySelector('#crTimer'), { options: this.timerOptions(), selected: 20000 });
    const crRatings = ToggleGroup.render(container.querySelector('#crRatings'), { options: this.ratingsOptions(), selected: true });
    const crCaptain = ToggleGroup.render(container.querySelector('#crCaptain'), { options: this.captainOptions(), selected: false });
    const crBlitz = ToggleGroup.render(container.querySelector('#crBlitz'), { options: this.blitzOptions(), selected: false });

    container.querySelector('#btnCreateRoom').addEventListener('click', async () => {
      try {
        const name = container.querySelector('#crName').value.trim();
        const slots = Number(container.querySelector('#crSlots').value) || 8;
        const room = await Api.createRoom(name, slots, crFormation.value, crRatings.value, crTimer.value, crCaptain.value, crBlitz.value);
        App.goLobby(room.code);
      } catch (e) { showErr(e); }
    });
  },

  renderJoinRoom(container) {
    container.innerHTML = `
      ${this.backButton()}
      <div class="card">
        <h3>Join with a Code</h3>
        <div class="field">
          <label>Room code</label>
          <input type="text" id="joinCode" placeholder="e.g. AB12CD" style="text-transform:uppercase" />
        </div>
        <div id="joinFormation" style="margin-bottom:24px;"></div>
        <button id="btnJoinRoom" class="btn btn-primary btn-block">Join</button>
        <div class="error-text hidden" id="dashError"></div>
      </div>
    `;
    this.wireBack(container);
    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    const joinFormation = FormationPicker.render(container.querySelector('#joinFormation'), { selected: '4-3-3' });

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
