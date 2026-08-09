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

  tournamentLengthOptions() {
    return [
      { value: 'full', title: 'Off', sub: 'Full 48-team group stage' },
      { value: 'blitz', title: 'Blitz', sub: 'Skip groups — start at Round of 32' },
      { value: 'quarter', title: 'Top 8', sub: 'Start at the Quarter-Finals (1/4)' }
    ];
  },

  rerollOptions() {
    return [
      { value: 0, title: 'Off', sub: 'No skipping a revealed team' },
      { value: 1, title: '1', sub: 'One reroll per drafter' },
      { value: 2, title: '2', sub: 'Two rerolls per drafter' },
      { value: 3, title: '3', sub: 'Three rerolls per drafter' }
    ];
  },

  // Renders an Off/On toggle for restricting which nations can be revealed during the
  // draft. The 48-team checkbox grid itself only loads and appears once the creator
  // opts in — in the default (Off) state nothing team-related is shown at all.
  renderTeamPicker(el) {
    let selected = new Set();
    let enabled = false;
    let teamsLoaded = false;

    el.innerHTML = `
      <div id="tpToggle" style="margin-bottom:8px;"></div>
      <div id="tpBody"></div>
    `;
    const bodyEl = el.querySelector('#tpBody');

    const toggle = ToggleGroup.render(el.querySelector('#tpToggle'), {
      options: [
        { value: false, title: 'Off', sub: 'All 48 teams eligible' },
        { value: true, title: 'Restrict', sub: 'Pick specific nations only' }
      ],
      selected: false,
      onChange: async (val) => {
        enabled = val;
        if (!enabled) {
          bodyEl.innerHTML = '';
          return;
        }
        if (!teamsLoaded) await loadTeamGrid();
        else bodyEl.style.display = 'block';
      }
    });

    async function loadTeamGrid() {
      bodyEl.innerHTML = '<p class="muted" style="font-size:.82rem;">Loading teams...</p>';
      let teams = [];
      try {
        ({ teams } = await Api.teams());
      } catch {
        bodyEl.innerHTML = '<p class="muted" style="font-size:.82rem;">Could not load team list — restriction unavailable.</p>';
        return;
      }
      teamsLoaded = true;
      bodyEl.innerHTML = `
        <div class="team-picker">
          <div class="team-picker-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="tpSelectAll">Select all</button>
            <button type="button" class="btn btn-ghost btn-sm" id="tpClear">Clear</button>
            <span class="muted team-picker-count" id="tpCount">0 selected — pick at least 4</span>
          </div>
          <div class="team-picker-grid">
            ${teams.map((t) => `
              <label class="team-picker-item">
                <input type="checkbox" data-code="${t.code}" />
                <span>${t.name}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
      const countEl = bodyEl.querySelector('#tpCount');
      const updateCount = () => {
        if (selected.size < 4) countEl.textContent = `${selected.size} selected — pick at least 4`;
        else countEl.textContent = `${selected.size} teams selected`;
      };
      const boxes = Array.from(bodyEl.querySelectorAll('input[type="checkbox"]'));
      boxes.forEach((b) => {
        b.checked = selected.has(b.dataset.code);
        b.addEventListener('change', () => {
          if (b.checked) selected.add(b.dataset.code); else selected.delete(b.dataset.code);
          updateCount();
        });
      });
      bodyEl.querySelector('#tpSelectAll').addEventListener('click', () => {
        boxes.forEach((b) => { b.checked = true; selected.add(b.dataset.code); });
        updateCount();
      });
      bodyEl.querySelector('#tpClear').addEventListener('click', () => {
        boxes.forEach((b) => { b.checked = false; });
        selected.clear();
        updateCount();
      });
      updateCount();
    }

    return {
      get value() { return enabled && selected.size >= 4 ? Array.from(selected) : null; },
      get count() { return enabled ? selected.size : 0; },
      get enabled() { return enabled; }
    };
  },

  timerOptions() {
    return [
      { value: 10000, title: '10s', sub: 'Fast' },
      { value: 20000, title: '20s', sub: 'Default' },
      { value: 30000, title: '30s', sub: 'Relaxed' },
      { value: 60000, title: '60s', sub: 'Chill' }
    ];
  },

  async renderSingleplayer(container) {
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
        <div id="spLength" style="margin-bottom:16px;"></div>
        <div class="field"><label>Restrict Draft Teams (optional)</label></div>
        <div id="spTeams" style="margin-bottom:16px;"></div>
        <div class="field"><label>Rerolls (skip a revealed team)</label></div>
        <div id="spRerolls" style="margin-bottom:16px;"></div>
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
    const spLength = ToggleGroup.render(container.querySelector('#spLength'), { options: this.tournamentLengthOptions(), selected: 'full' });
    const spTeams = await this.renderTeamPicker(container.querySelector('#spTeams'));
    const spRerolls = ToggleGroup.render(container.querySelector('#spRerolls'), { options: this.rerollOptions(), selected: 0 });

    container.querySelector('#btnSingleplayer').addEventListener('click', async () => {
      if (spTeams.count > 0 && spTeams.count < 4) return showErr(new Error('Pick at least 4 teams to restrict the draft pool, or clear the selection'));
      try {
        const room = await Api.createSingleplayer({
          formation: spFormation.value, showOverall: spRatings.value, pickTimeMs: spTimer.value,
          captainEnabled: spCaptain.value, tournamentLength: spLength.value, allowedTeams: spTeams.value,
          rerollsAllowed: spRerolls.value
        });
        App.goDraft(room.code);
      } catch (e) { showErr(e); }
    });
  },

  async renderCreateRoom(container) {
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
        <div id="crLength" style="margin-bottom:16px;"></div>
        <div class="field"><label>Restrict Draft Teams (optional)</label></div>
        <div id="crTeams" style="margin-bottom:16px;"></div>
        <div class="field"><label>Rerolls (skip a revealed team)</label></div>
        <div id="crRerolls" style="margin-bottom:16px;"></div>
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
    const crLength = ToggleGroup.render(container.querySelector('#crLength'), { options: this.tournamentLengthOptions(), selected: 'full' });
    const crTeams = await this.renderTeamPicker(container.querySelector('#crTeams'));
    const crRerolls = ToggleGroup.render(container.querySelector('#crRerolls'), { options: this.rerollOptions(), selected: 0 });

    container.querySelector('#btnCreateRoom').addEventListener('click', async () => {
      if (crTeams.count > 0 && crTeams.count < 4) return showErr(new Error('Pick at least 4 teams to restrict the draft pool, or clear the selection'));
      try {
        const name = container.querySelector('#crName').value.trim();
        const slots = Number(container.querySelector('#crSlots').value) || 8;
        const room = await Api.createRoom({
          name, humanSlotsMax: slots, formation: crFormation.value, showOverall: crRatings.value,
          pickTimeMs: crTimer.value, captainEnabled: crCaptain.value, tournamentLength: crLength.value,
          allowedTeams: crTeams.value, rerollsAllowed: crRerolls.value
        });
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
