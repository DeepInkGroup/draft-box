// Real football confederations for the 48 qualified 2026 World Cup nations, used to
// group the draft team-restriction picker instead of one flat 48-item list.
const CONFEDERATIONS = [
  { name: 'UEFA (Europe)', codes: ['CZE', 'BIH', 'SCO', 'SUI', 'TUR', 'GER', 'NED', 'SWE', 'BEL', 'ESP', 'FRA', 'NOR', 'AUT', 'POR', 'ENG', 'CRO'] },
  { name: 'CONMEBOL (South America)', codes: ['BRA', 'PAR', 'ECU', 'URU', 'ARG', 'COL'] },
  { name: 'CONCACAF (North/Central America)', codes: ['MEX', 'CAN', 'HAI', 'USA', 'CUW', 'PAN'] },
  { name: 'AFC (Asia)', codes: ['KOR', 'QAT', 'AUS', 'JPN', 'IRN', 'KSA', 'IRQ', 'JOR', 'UZB'] },
  { name: 'CAF (Africa)', codes: ['RSA', 'MAR', 'CIV', 'TUN', 'EGY', 'CPV', 'SEN', 'ALG', 'COD', 'GHA'] },
  { name: 'OFC (Oceania)', codes: ['NZL'] }
];

const DashboardView = {
  render(container) {
    this.renderModeSelect(container);
  },

  renderModeSelect(container) {
    container.innerHTML = `
      <div class="card center">
        <h2>Draft Box</h2>
        <p class="muted">Draft your XI. Take on the World Cup or a club league season.</p>
      </div>
      <div class="mode-grid">
        <div class="mode-card" id="modeSingle">
          <h3>Single Player</h3>
          <p class="muted">Choose World Cup or League Games and compete against bots.</p>
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
      <div id="activeLeagueSeasons"></div>
    `;
    container.querySelector('#modeSingle').addEventListener('click', () => this.renderSingleplayerMenu(container));
    container.querySelector('#modeCreate').addEventListener('click', () => this.renderCreateRoom(container));
    container.querySelector('#modeJoin').addEventListener('click', () => this.renderJoinRoom(container));
    const resume = container.querySelector('#activeLeagueSeasons');
    Api.activeLeagues().then(({ leagues }) => {
      if (!container.contains(resume) || !leagues.length) return;
      resume.innerHTML = `<div class="card"><h3>Your League Seasons</h3>${leagues.map((season) => `<div class="league-resume-row"><div><b>${season.clubName}</b><p class="muted">${season.leagueName} · ${season.betweenSeasons ? 'Between seasons - decisions pending' : season.status === 'drafting' ? 'Draft in progress' : `Matchday ${season.matchday}`}</p></div><button class="btn btn-primary btn-sm" data-resume="${season.code}">Resume</button></div>`).join('')}</div>`;
      resume.querySelectorAll('[data-resume]').forEach((button) => button.addEventListener('click', () => {
        const season = leagues.find((entry) => entry.code === button.dataset.resume);
        season.status === 'drafting' ? App.goDraft(season.code) : App.goTournament(season.code);
      }));
    }).catch(() => { /* The main game choices remain available if resume loading fails. */ });
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

  autoDraftOptions() {
    return [
      { value: false, title: 'Off', sub: 'Draft manually' },
      { value: true, title: 'Auto', sub: 'Experimental instant XI' }
    ];
  },

  spoilerOptions() {
    return [
      { value: false, title: 'Off', sub: 'Spectators can keep watching' },
      { value: true, title: 'On', sub: 'Remaining players advance together' }
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
      const nameByCode = new Map(teams.map((t) => [t.code, t.name]));
      const grouped = CONFEDERATIONS.map((conf) => ({
        name: conf.name,
        teams: conf.codes.filter((c) => nameByCode.has(c)).map((c) => ({ code: c, name: nameByCode.get(c) }))
      })).filter((g) => g.teams.length);

      bodyEl.innerHTML = `
        <div class="team-picker">
          <div class="team-picker-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="tpSelectAll">Select all</button>
            <button type="button" class="btn btn-ghost btn-sm" id="tpClear">Clear</button>
            <span class="muted team-picker-count" id="tpCount">0 selected — pick at least 4</span>
          </div>
          <div class="team-picker-groups">
            ${grouped.map((g, gi) => `
              <div class="team-group">
                <div class="team-group-header">
                  <span class="team-group-title">${g.name}</span>
                  <button type="button" class="team-group-toggle" data-group="${gi}">select all</button>
                </div>
                <div class="team-chips">
                  ${g.teams.map((t) => `<button type="button" class="team-chip" data-code="${t.code}">${t.name}</button>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      const countEl = bodyEl.querySelector('#tpCount');
      const updateCount = () => {
        if (selected.size < 4) countEl.textContent = `${selected.size} selected — pick at least 4`;
        else countEl.textContent = `${selected.size} teams selected`;
      };
      const chips = Array.from(bodyEl.querySelectorAll('.team-chip'));
      const syncChip = (chip) => chip.classList.toggle('selected', selected.has(chip.dataset.code));
      chips.forEach((chip) => {
        syncChip(chip);
        chip.addEventListener('click', () => {
          if (selected.has(chip.dataset.code)) selected.delete(chip.dataset.code);
          else selected.add(chip.dataset.code);
          syncChip(chip);
          updateCount();
        });
      });
      bodyEl.querySelectorAll('.team-group-toggle').forEach((btn, gi) => {
        btn.addEventListener('click', () => {
          const groupChips = chips.filter((c) => c.closest('.team-group') === btn.closest('.team-group'));
          const allSelected = groupChips.every((c) => selected.has(c.dataset.code));
          groupChips.forEach((c) => {
            if (allSelected) selected.delete(c.dataset.code); else selected.add(c.dataset.code);
            syncChip(c);
          });
          btn.textContent = allSelected ? 'select all' : 'clear';
          updateCount();
        });
      });
      bodyEl.querySelector('#tpSelectAll').addEventListener('click', () => {
        chips.forEach((c) => { selected.add(c.dataset.code); syncChip(c); });
        bodyEl.querySelectorAll('.team-group-toggle').forEach((b) => { b.textContent = 'clear'; });
        updateCount();
      });
      bodyEl.querySelector('#tpClear').addEventListener('click', () => {
        chips.forEach((c) => { selected.delete(c.dataset.code); syncChip(c); });
        bodyEl.querySelectorAll('.team-group-toggle').forEach((b) => { b.textContent = 'select all'; });
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
      { value: 45000, title: '45s', sub: 'Leisurely' },
      { value: 0, title: 'No Limit', sub: 'Take your time' }
    ];
  },

  sharedDraftOptions() {
    return [
      { value: false, title: 'Solo Reveal', sub: 'Each player gets private random teams' },
      { value: true, title: 'Team Snake', sub: 'One shared team; first picker rotates every round' }
    ];
  },

  renderSingleplayerMenu(container) {
    container.innerHTML = `
      ${this.backButton()}
      <div class="card center"><h3>Single Player</h3><p class="muted">Choose your competition.</p></div>
      <div class="mode-grid single-player-modes">
        <button class="mode-card" id="singleWorldCup"><h3>World Cup</h3><p class="muted">Draft from national teams and take on the 48-team tournament.</p></button>
        <button class="mode-card" id="singleLeague"><h3>League Games</h3><p class="muted">Choose a league and club. Use the real club squad or draft your XI.</p></button>
      </div>`;
    this.wireBack(container);
    container.querySelector('#singleWorldCup').addEventListener('click', () => this.renderSingleplayer(container));
    container.querySelector('#singleLeague').addEventListener('click', () => this.renderLeagueSelect(container));
  },

  async renderLeagueSelect(container, multiplayer = false) {
    container.innerHTML = `${this.backButton()}<div class="card"><h3>League Games</h3><p class="muted">${multiplayer ? 'Choose a league to play with friends.' : 'Choose your league and club.'}</p><div id="leaguePicker">Loading leagues...</div></div>`;
    container.querySelector('#btnBack').addEventListener('click', () => multiplayer ? this.renderCreateRoom(container) : this.renderSingleplayerMenu(container));
    const picker = container.querySelector('#leaguePicker');
    try {
      const { leagues } = await Api.leagues();
      if (!leagues.length) { picker.textContent = 'No leagues are available yet.'; return; }
      picker.innerHTML = `<div class="field"><label for="leagueSelect">League</label><select id="leagueSelect">${leagues.map((league) => `<option value="${league.id}">${league.name} (${league.country})</option>`).join('')}</select></div>
        <p class="muted" id="leagueDetails"></p><div id="leagueCoaches"></div><button class="btn btn-primary btn-block" id="btnSelectLeague">Choose League</button>`;
      const select = picker.querySelector('#leagueSelect');
      const selected = () => leagues.find((league) => league.id === select.value);
      const describe = () => { const league = selected(); picker.querySelector('#leagueDetails').textContent = `${league.teamCount} clubs · ${league.matchdays} matchdays · home and away`; picker.querySelector('#leagueCoaches').innerHTML = ClubIdentity.freeAgents(league.freeAgentCoaches); };
      select.addEventListener('change', describe);
      describe();
      picker.querySelector('#btnSelectLeague').addEventListener('click', () => multiplayer ? this.renderCreateRoom(container, selected()) : this.renderSingleplayer(container, selected()));
    } catch (error) { picker.textContent = error.message; }
  },

  async renderSingleplayer(container, league = null) {
    container.innerHTML = `
      ${this.backButton()}
      <div class="card">
        <h3>${league ? 'League Games — ' + league.name : 'Single Player — World Cup'}</h3>
        <p class="muted">${league ? `Choose your club, draft from ${league.teamCount} league clubs, and play ${league.matchdays} matchdays against bots.` : 'Jump straight into the draft and compete in the World Cup against 47 bot teams.'}</p>
        ${league ? `<div class="field"><label for="spClub">Your club</label><select id="spClub">${league.teams.map((club) => `<option value="${club.code}">${club.name}</option>`).join('')}</select></div>` : ''}
        <div id="spFormation"></div>
${league ? '' : `<div class="field"><label>Pick Timer</label></div><div id="spTimer" style="margin-bottom:16px;"></div>`}
        <div class="field"><label>Show Ratings</label></div>
        <div id="spRatings" style="margin-bottom:16px;"></div>
        <div class="field"><label>Team Captain</label></div>
        <div id="spCaptain" style="margin-bottom:16px;"></div>
        ${league ? '' : `<div class="field"><label>Tournament Length</label></div>
        <div id="spLength" style="margin-bottom:16px;"></div>
        <div class="field"><label>Restrict Draft Teams (optional)</label></div>
        <div id="spTeams" style="margin-bottom:16px;"></div>`}
        <div class="field"><label>Rerolls (skip a revealed team)</label></div>
        <div id="spRerolls" style="margin-bottom:16px;"></div>
        <div class="field"><label>Experimental Auto Draft</label></div>
        <div id="spAutoDraft" style="margin-bottom:16px;"></div>
        ${league ? `<section class="league-transfer-options"><h3>Squad Mode</h3><div id="spSquadMode"></div></section><section class="league-transfer-options"><h3>Mid-season Transfers</h3><div class="field"><label>Transfer window</label></div><div id="spTransfers"></div><div class="field"><label>Maximum player changes</label></div><div id="spTransferLimit" class="transfer-limit-toggle"></div><div class="field"><label>AI team transfers</label></div><div id="spAiTransfers"></div><p id="spTransferNote" class="muted"></p></section><section class="league-transfer-options"><h3>Mid-season Tactics</h3><div id="spMidseasonTactics"></div></section><section class="league-transfer-options"><h3>End-of-season Transfers</h3><div class="field"><label>Transfer window</label></div><div id="spEndTransfers"></div><div class="field"><label>Maximum player changes</label></div><div id="spEndTransferLimit" class="transfer-limit-toggle"></div><div class="field"><label>AI team transfers</label></div><div id="spEndAiTransfers"></div><p id="spEndTransferNote" class="muted"></p></section>` : ''}
        ${league?.id === 'pgl' ? `<section class="league-transfer-options"><h3>PGL Overall Boost</h3><div id="spRatingBoost"></div><p class="muted">Give every league player +10 Overall, including your squad, AI clubs and transfer candidates. Team ratings and match calculations use the boosted values.</p></section>` : ''}
        ${league ? `<section class="league-transfer-options"><h3>Match Experience</h3><div id="spResultsOnly"></div><p class="muted">Results Only plays fixtures automatically without live commentary or match controls. It pauses only at transfer or tactic windows you enabled, then resumes automatically.</p></section>` : ''}
        <button id="btnSingleplayer" class="btn btn-primary btn-block">${league ? 'Start League Draft' : 'Start Single Player'}</button>
        <div class="error-text hidden" id="dashError"></div>
      </div>
    `;
    container.querySelector('#btnBack').addEventListener('click', () => league ? this.renderLeagueSelect(container) : this.renderSingleplayerMenu(container));
    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    const spFormation = FormationPicker.render(container.querySelector('#spFormation'), { selected: '4-3-3' });
    if (league) ClubIdentity.bindPreview(container.querySelector('#spClub'), league.teams);
    const spTimer = league ? { value: 0 } : ToggleGroup.render(container.querySelector('#spTimer'), { options: this.timerOptions(), selected: 20000 });
    const spRatings = ToggleGroup.render(container.querySelector('#spRatings'), { options: this.ratingsOptions(), selected: true });
    const spCaptain = ToggleGroup.render(container.querySelector('#spCaptain'), { options: this.captainOptions(), selected: false });
    const spLength = league ? { value: 'full' } : ToggleGroup.render(container.querySelector('#spLength'), { options: this.tournamentLengthOptions(), selected: 'full' });
    const spTeams = league ? { count: 0, value: null } : await this.renderTeamPicker(container.querySelector('#spTeams'));
    const spRerolls = ToggleGroup.render(container.querySelector('#spRerolls'), { options: this.rerollOptions(), selected: 0 });
    const spAutoDraft = ToggleGroup.render(container.querySelector('#spAutoDraft'), { options: this.autoDraftOptions(), selected: false });
    let squadMode = null, midTransfers = null, endTransfers = null, midTactics = null, ratingBoost = null, resultsOnly = null;
    if (league) {
      const transferControls = (prefix, end) => {
        const update = () => {
          limit.setDisabled(!window.value);
          ai.setDisabled(!window.value || limit.value === 0);
          container.querySelector('#' + prefix + 'TransferNote').textContent = !window.value || limit.value === 0 ? 'This transfer window is closed.' : (end ? 'Before the next season begins' : 'At mid-season') + ', release 1 to ' + limit.value + ' players, then choose from two random offers per position. Coordination recovers over four matches.';
        };
        const window = ToggleGroup.render(container.querySelector('#' + prefix + 'Transfers'), { options: [{ value: true, title: 'Open', sub: 'Allow player changes' }, { value: false, title: 'Closed', sub: 'Keep the squad together' }], selected: !end, onChange: update });
        const limit = ToggleGroup.render(container.querySelector('#' + prefix + 'TransferLimit'), { options: [1, 2, 3].map(value => ({ value, title: String(value), sub: value + (value === 1 ? ' player' : ' players') })), selected: 2, onChange: update });
        const ai = ToggleGroup.render(container.querySelector('#' + prefix + 'AiTransfers'), { options: [{value: false, title: 'Disabled', sub: 'AI squads stay together'}, {value: true, title: 'Enabled', sub: 'AI clubs can trade players'}], selected: false });
        update();
        return { window, limit, ai };
      };
      if (league.id === 'pgl') ratingBoost = ToggleGroup.render(container.querySelector('#spRatingBoost'), { options: [{value:false,title:'Original Ratings',sub:'Use supplied player ratings'}, {value:true,title:'+10 Overall',sub:'Boost all PGL players'}], selected:false });
      resultsOnly = ToggleGroup.render(container.querySelector('#spResultsOnly'), {options:[{value:false,title:'Live Match',sub:'Watch commentary and match updates'},{value:true,title:'Results Only',sub:'Play automatically and show final scores'}],selected:false});
      midTransfers = transferControls('sp', false);
      endTransfers = transferControls('spEnd', true);
      midTactics = ToggleGroup.render(container.querySelector('#spMidseasonTactics'), { options: [{ value: false, title: 'Disabled', sub: 'Keep your season tactic' }, { value: true, title: 'Enabled', sub: 'Choose or keep a tactic at halfway' }], selected: false });
      squadMode = ToggleGroup.render(container.querySelector('#spSquadMode'), { options: [{ value: 'draft', title: 'Draft Style', sub: 'Build an XI from league clubs' }, { value: 'real', title: 'Real Club Squad', sub: "Play with your club's players" }], selected: 'draft', onChange: value => {
        const real = value === 'real';
        for (const id of ['spRerolls', 'spAutoDraft']) {
          const option = container.querySelector('#' + id);
          option.classList.toggle('hidden', real);
          option.previousElementSibling.classList.toggle('hidden', real);
        }
        container.querySelector('#btnSingleplayer').textContent = real ? 'Use Real Club Squad' : 'Start League Draft';
      } });
    }

    container.querySelector('#btnSingleplayer').addEventListener('click', async () => {
      const startButton = container.querySelector('#btnSingleplayer');
      if (startButton.disabled) return;
      if (spTeams.count > 0 && spTeams.count < 4) return showErr(new Error('Pick at least 4 teams to restrict the draft pool, or clear the selection'));
      try {
        startButton.disabled = true;
        const room = await Api.createSingleplayer({
          mode: league ? 'league' : 'worldcup', leagueId: league?.id,
          squadMode: squadMode?.value || 'draft', pglRatingBoost: ratingBoost?.value, resultsOnly: resultsOnly?.value,
          transferEnabled: midTransfers?.window.value,
          transferLimit: midTransfers?.limit.value,
          midseasonTactics: midTactics?.value,
          aiTransfers: midTransfers?.ai.value,
          endTransferEnabled: endTransfers?.window.value, endTransferLimit: endTransfers?.limit.value, endAiTransfers: endTransfers?.ai.value,
          clubCode: league ? container.querySelector('#spClub').value : undefined,
          formation: spFormation.value, showOverall: spRatings.value, pickTimeMs: spTimer.value,
          captainEnabled: spCaptain.value, tournamentLength: spLength.value, allowedTeams: spTeams.value,
          rerollsAllowed: spRerolls.value
        });
        if (spAutoDraft.value && squadMode?.value !== 'real') sessionStorage.setItem(`draftbox.autoDraft.${room.code}`, '1');
        else sessionStorage.removeItem(`draftbox.autoDraft.${room.code}`);
        if (container.contains(startButton)) App.goDraft(room.code);
      } catch (e) { showErr(e); startButton.disabled = false; }
    });
  },

  async renderCreateRoom(container, league = null) {
    container.innerHTML = `
      ${this.backButton()}
      <div class="card">
        <h3>${league ? 'Create a Multiplayer League' : 'Create a New Room'}</h3><div class="field"><label>Competition</label></div><div id="crMode"></div>${league ? `<p class="muted">${league.name}: ${league.teamCount} clubs, ${league.matchdays} matchdays. Choose different clubs; bots fill unclaimed clubs. Everyone completes or skips transfers before the season continues.</p><div class="field"><label for="crClub">Your club</label><select id="crClub">${league.teams.map(club => `<option value="${club.code}">${club.name}</option>`).join('')}</select></div>` : ''}
        <div class="field">
          <label>Room name</label>
          <input type="text" id="crName" placeholder="Friends Room" />
        </div>
        <div class="field">
          <label for="crSlots">Max human players (1 to ${league ? league.teamCount : 32})</label>
          <input type="number" id="crSlots" min="1" max="${league ? league.teamCount : 32}" value="8" />
        </div>
        <div id="crFormation"></div>
        <div class="field"><label>Pick Timer</label></div>
        <div id="crTimer" style="margin-bottom:16px;"></div>
        <div class="field"><label>Show Ratings</label></div>
        <div id="crRatings" style="margin-bottom:16px;"></div>
        <div class="field"><label>Team Captain</label></div>
        <div id="crCaptain" style="margin-bottom:16px;"></div>
${league ? '' : `<div class="field"><label>Tournament Length</label></div><div id="crLength" style="margin-bottom:16px;"></div><div class="field"><label>Restrict Draft Teams (optional)</label></div><div id="crTeams" style="margin-bottom:16px;"></div>`}
        <div class="field"><label>Rerolls (skip a revealed team)</label></div>
        <div id="crRerolls" style="margin-bottom:16px;"></div>
        <div class="field"><label>Spoiler Mode</label></div>
        <div id="crSpoiler" style="margin-bottom:16px;"></div>
        <div class="field"><label>Shared Team Draft</label></div>
        <div id="crSharedDraft" style="margin-bottom:16px;"></div>
${league ? `<section class="league-transfer-options"><h3>Squad Mode</h3><div id="crSquadMode"></div></section><section class="league-transfer-options"><h3>Mid-season Transfers</h3><div id="crTransfers"></div><div class="field"><label>Maximum player changes</label></div><div id="crTransferLimit" class="transfer-limit-toggle"></div><p class="muted">Release 1 to your selected limit, then choose between two random replacements per slot. The league waits for every player to finish or skip this window.</p></section><section class="league-transfer-options"><h3>End-of-season Transfers</h3><div id="crEndTransfers"></div><div class="field"><label>Maximum player changes</label></div><div id="crEndTransferLimit" class="transfer-limit-toggle"></div><p class="muted">Opens before the first matchday when the host continues to the next season.</p></section>${league.id === 'pgl' ? `<section class="league-transfer-options"><h3>PGL Overall Boost</h3><div id="crRatingBoost"></div></section>` : ''}` : ''}
        ${league ? `<section class="league-transfer-options"><h3>Between Seasons</h3><label>AI Club Manager Offers</label><div id="crManagerOffers"></div><p class="muted">After a season, receive zero, one or two job offers from AI clubs. Accept an offer to manage that club and its squad, or stay. Human-managed clubs never make offers.</p><label>Player Departures After Poor Results</label><div id="crPlayerDepartures"></div><p class="muted">At season end, bottom-third clubs may lose 1 or 2 footballers. Applies to AI and human clubs. Eligible reserves step up automatically, keeping a complete XI even if transfer windows are closed.</p></section>` : ''}
        ${league ? `<section class="league-transfer-options"><h3>Match Experience</h3><div id="crResultsOnly"></div><p class="muted">Results Only automatically shows each matchday without live commentary or match decisions. Everyone completes or skips their transfers at mid-season before the second half continues.</p></section>` : ''}
        <button id="btnCreateRoom" class="btn btn-primary btn-block">Create Room &amp; Get Code</button>
        <div class="error-text hidden" id="dashError"></div>
      </div>
    `;
    this.wireBack(container);
    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    ToggleGroup.render(container.querySelector('#crMode'), { options: [{ value: 'worldcup', title: 'World Cup', sub: 'Tournament with friends' }, { value: 'league', title: 'League Games', sub: 'A full club season together' }], selected: league ? 'league' : 'worldcup', onChange: value => value === 'league' ? this.renderLeagueSelect(container, true) : this.renderCreateRoom(container) });
    const crFormation = FormationPicker.render(container.querySelector('#crFormation'), { selected: '4-3-3' });
    if (league) ClubIdentity.bindPreview(container.querySelector('#crClub'), league.teams);
    const crTimer = ToggleGroup.render(container.querySelector('#crTimer'), { options: this.timerOptions(), selected: 20000 });
    const crRatings = ToggleGroup.render(container.querySelector('#crRatings'), { options: this.ratingsOptions(), selected: true });
    const crCaptain = ToggleGroup.render(container.querySelector('#crCaptain'), { options: this.captainOptions(), selected: false });
    const crLength = league ? { value: 'full' } : ToggleGroup.render(container.querySelector('#crLength'), { options: this.tournamentLengthOptions(), selected: 'full' });
    const crTeams = league ? { count: 0, value: null } : await this.renderTeamPicker(container.querySelector('#crTeams'));
    const crRerolls = ToggleGroup.render(container.querySelector('#crRerolls'), { options: this.rerollOptions(), selected: 0 });
    const crSpoiler = ToggleGroup.render(container.querySelector('#crSpoiler'), { options: this.spoilerOptions(), selected: false });
    const crSharedDraft = ToggleGroup.render(container.querySelector('#crSharedDraft'), { options: this.sharedDraftOptions(), selected: false });

    let squadMode, midTransfers, endTransfers, ratingBoost, managerOffers, playerDepartures, resultsOnly;
    if (league) {
      const windowControls = (prefix, enabled) => {
        let limit;
        const window = ToggleGroup.render(container.querySelector('#'+prefix+'Transfers'), { options: [{value:true,title:'Open',sub:'Allow player changes'},{value:false,title:'Closed',sub:'Keep squads together'}], selected:enabled, onChange:()=>limit.setDisabled(!window.value) });
        limit = ToggleGroup.render(container.querySelector('#'+prefix+'TransferLimit'), { options:[1,2,3].map(value=>({value,title:String(value),sub:value===1?'1 player':value+' players'})),selected:2 });
        limit.setDisabled(!window.value); return {window,limit};
      };
      resultsOnly = ToggleGroup.render(container.querySelector('#crResultsOnly'), {options:[{value:false,title:'Live Match',sub:'Follow live match reports'},{value:true,title:'Results Only',sub:'Automatic matchday scores'}],selected:false,onChange:()=>{crSpoiler.setDisabled(resultsOnly.value);const spoiler=container.querySelector('#crSpoiler');spoiler.classList.toggle('hidden',resultsOnly.value);spoiler.previousElementSibling.classList.toggle('hidden',resultsOnly.value);}});
      managerOffers = ToggleGroup.render(container.querySelector('#crManagerOffers'), {options:[{value:false,title:'Off',sub:'Stay at your club'},{value:true,title:'On',sub:'Receive AI job offers'}],selected:false});
      playerDepartures = ToggleGroup.render(container.querySelector('#crPlayerDepartures'), {options:[{value:false,title:'Off',sub:'Keep all footballers'},{value:true,title:'On',sub:'Poor results may cause exits'}],selected:false});
      midTransfers = windowControls('cr',true); endTransfers = windowControls('crEnd',false);
      if (league.id==='pgl') ratingBoost = ToggleGroup.render(container.querySelector('#crRatingBoost'), {options:[{value:false,title:'Original Ratings',sub:'Use supplied ratings'},{value:true,title:'+10 Overall',sub:'Boost all PGL players'}],selected:false});
      squadMode = ToggleGroup.render(container.querySelector('#crSquadMode'), {options:[{value:'draft',title:'Draft Style',sub:'Build your own XI'},{value:'real',title:'Real Club Squad',sub:"Use your selected club's players"}],selected:'draft',onChange:value=>{
        for(const id of ['crTimer','crRerolls','crSharedDraft']) { const el=container.querySelector('#'+id);el.classList.toggle('hidden',value==='real');el.previousElementSibling.classList.toggle('hidden',value==='real'); }
      }});
    }
    container.querySelector('#btnCreateRoom').addEventListener('click', async () => {
      const button = container.querySelector('#btnCreateRoom'); if (button.disabled) return;
      if (crTeams.count > 0 && crTeams.count < 4) return showErr(new Error('Pick at least 4 teams to restrict the draft pool, or clear the selection'));
      try {
        button.disabled = true;
        const name = container.querySelector('#crName').value.trim();
        const slots = Number(container.querySelector('#crSlots').value) || 8;
        const room = await Api.createRoom({
          mode: league ? 'league' : 'worldcup', leagueId: league?.id, clubCode: league ? container.querySelector('#crClub').value : undefined,
          managerOffers: managerOffers?.value, playerDepartures: playerDepartures?.value, resultsOnly: resultsOnly?.value,
          squadMode: squadMode?.value || 'draft', pglRatingBoost: ratingBoost?.value,
          transferEnabled: midTransfers?.window.value, transferLimit: midTransfers?.limit.value, endTransferEnabled: endTransfers?.window.value, endTransferLimit: endTransfers?.limit.value,
          name, humanSlotsMax: slots, formation: crFormation.value, showOverall: crRatings.value,
          pickTimeMs: squadMode?.value === 'real' ? 0 : crTimer.value, captainEnabled: crCaptain.value, tournamentLength: crLength.value,
          allowedTeams: crTeams.value, rerollsAllowed: crSharedDraft.value ? 0 : crRerolls.value,
          spoilerMode: crSpoiler.value, sharedDraftMode: squadMode?.value !== 'real' && crSharedDraft.value
        });
        if (container.contains(button)) App.goLobby(room.code);
      } catch (e) { showErr(e); button.disabled = false; }
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
        <div id="joinRoomDetails"></div><div id="joinClubPicker"></div>
        <div id="joinFormation" style="margin-bottom:24px;"></div>
        <button id="btnJoinRoom" class="btn btn-primary btn-block">Join</button>
        <div class="error-text hidden" id="dashError"></div>
      </div>
    `;
    this.wireBack(container);
    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    const joinFormation = FormationPicker.render(container.querySelector('#joinFormation'), { selected: '4-3-3' });

    let selectedRoom = null, lobbyPoll = null;
    async function refreshAvailableClubs(code) {
      if (!selectedRoom || selectedRoom.code !== code || !container.contains(joinButton)) return;
      try {
        const room = await Api.getRoom(code);
        if (!selectedRoom || selectedRoom.code !== code || !container.contains(joinButton)) return;
        if (room.status !== 'lobby' || room.members.length >= room.humanSlotsMax) { selectedRoom=null;joinButton.disabled=true;return showErr(new Error(room.status !== 'lobby' ? 'This room has started.' : 'This room is full.')); }
        selectedRoom=room;
        const select=container.querySelector('#joinClub'), previous=select.value, occupied=new Set(room.members.map(member=>member.clubCode));
        const clubs=room.leagueClubs.filter(club=>!occupied.has(club.code));
        select.replaceChildren(...clubs.map(club=>{const option=document.createElement('option');option.value=club.code;option.textContent=club.name;return option;}));
        if(clubs.some(club=>club.code===previous))select.value=previous;
        else App.toast('That club was just chosen. Select another available club.');
        ClubIdentity.bindPreview(select, clubs);
      } catch(error) { selectedRoom=null;showErr(error); }
      if (selectedRoom && container.contains(joinButton)) lobbyPoll=setTimeout(()=>refreshAvailableClubs(code),3000);
    }
    const joinButton = container.querySelector('#btnJoinRoom'), codeInput = container.querySelector('#joinCode');
    codeInput.addEventListener('input',()=>{clearTimeout(lobbyPoll);selectedRoom=null;joinButton.disabled=false;container.querySelector('#joinRoomDetails').textContent='';container.querySelector('#joinClubPicker').innerHTML='';joinButton.textContent='Join';});
    joinButton.addEventListener('click', async () => {
      if (joinButton.disabled) return;
      const code = codeInput.value.trim().toUpperCase();
      if (!code) return showErr(new Error('Enter a room code'));
      joinButton.disabled = true; errorBox.classList.add('hidden');
      try {
        if (!selectedRoom || selectedRoom.code !== code) {
          const room = await Api.getRoom(code);
          if (codeInput.value.trim().toUpperCase() !== code || !container.contains(joinButton)) return;
          if (room.status !== 'lobby') throw new Error('This room has already started. Resume an existing league from your dashboard.');
          if (room.members.some(member=>member.userId===App.state.user.id)) return App.goLobby(code);
          if (room.members.length >= room.humanSlotsMax) throw new Error('This room is full.');
          selectedRoom=room;
          if (room.mode==='league') {
            const occupied=new Set(room.members.map(member=>member.clubCode));
            const clubs=room.leagueClubs.filter(club=>!occupied.has(club.code));
            if (!clubs.length) throw new Error('All clubs are already taken.');
            container.querySelector('#joinRoomDetails').textContent=room.leagueName+' - Choose an available club before joining.';
            const label=document.createElement('label');label.className='field';label.textContent='Your club';
            const select=document.createElement('select');select.id='joinClub';
            clubs.forEach(club=>{const option=document.createElement('option');option.value=club.code;option.textContent=club.name;select.append(option);});
            label.append(select);container.querySelector('#joinClubPicker').replaceChildren(label);
            ClubIdentity.bindPreview(select, clubs);
            joinButton.textContent='Choose Club & Join';clearTimeout(lobbyPoll);lobbyPoll=setTimeout(()=>refreshAvailableClubs(code),3000); return;
          }
        }
        await Api.joinRoom(code,joinFormation.value,container.querySelector('#joinClub')?.value);
        if (container.contains(joinButton)) App.goLobby(code);
      } catch(e) { showErr(e); selectedRoom=null; }
      finally { joinButton.disabled=false; }
    });
  }
};
