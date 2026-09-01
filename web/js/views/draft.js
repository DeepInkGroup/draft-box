const DraftView = {
  async render(container, code) {
    container.innerHTML = `<div class="card center muted">Connecting to the draft...</div>`;

    const socket = App.ensureSocket();
    socket.emit('room:join', { code });

    let myFormation = '4-3-3';
    let timerInterval = null;
    let lastOpenSlots = [];
    let pickTimeMs = 20000;
    let captainEnabled = false;
    let sortMode = 'rating';
    let lastPlayers = [];
    let isCreator = false;
    let singlePlayer = false;
    let allReady = false;
    let iAmReady = false;
    let lastRevealPayload = null;
    let myTacticalStyle = 'balanced';
    let tacticalStyleLocked = false;
    let moveFromSlot = null;
    let currentSlotsMap = {};
    let myDraftComplete = false;
    let lastDraftCompleteState = null;
    let autoDraftRequested = false;
    let sharedDraftMode = false;
    let sharedDraft = null;
    let customTactics = [];
    let customTacticsLoaded = false;

    const TACTICAL_STYLES = [
      { key: 'defensive', label: 'Defensive', meta: 'Deep block', new: false, mods: { ATT: 0.94, DEF: 1.08, TMP: 0.88, CTR: 0.82, SET: 1.04 }, desc: 'Deep shape, solid lines, set-piece danger. Low shot volume but much harder to break down.', longDesc: 'Two banks of four/five sit deep and narrow the box. Midfield screens, goalkeeper sees lots of shots but few high-value ones. xG creation is intentionally sacrificed for resilience.', biases: { mid: 0.78, fin: 0.94 }, synergyBest: ['5-4-1','5-3-2','5-3-1-1','4-5-1'], synergyWorst: ['3-4-3','3-2-4-1','3-3-1-3','4-2-4'] },
      { key: 'balanced', label: 'Balanced', meta: 'Safe default', new: false, mods: { ATT: 1.00, DEF: 1.00, TMP: 1.00, CTR: 1.00, SET: 1.00 }, desc: 'No sharp weakness or upside. Steady baseline when your raw player quality wins out.', longDesc: 'Even commitment everywhere. The vanilla baseline — predictable, low-volatility, no tactical counter. Use it when you don\'t want any surprises.', biases: { mid: 1.00, fin: 1.00 }, synergyBest: [], synergyWorst: [] },
      { key: 'gegenpress', label: 'Gegenpress', meta: 'High press', new: false, mods: { ATT: 1.07, DEF: 0.97, TMP: 1.15, CTR: 0.92, SET: 0.98 }, desc: 'Win the ball high up. More turnovers, more chaos, more cards.', longDesc: 'Lose the ball → swarm the carrier within 3 seconds. Turnovers in the final third make xG cheap. But beat the press → huge spaces behind your midfield.', biases: { mid: 1.18, fin: 1.06 }, synergyBest: ['4-3-3','3-4-3','4-1-4-1','3-3-1-3'], synergyWorst: ['5-4-1','5-3-1-1','5-3-2'] },
      { key: 'possession', label: 'Possession', meta: 'Control', new: false, mods: { ATT: 1.01, DEF: 1.03, TMP: 0.94, CTR: 1.22, SET: 1.02 }, desc: 'Territory domination, low volatility. Midfield creates; strikers share the spoils.', longDesc: 'Circulate, draw the opponent out, play through the lines. Shot volume is high; individual chance quality slightly lower. You wear teams down rather than pouncing once.', biases: { mid: 1.22, fin: 0.92 }, synergyBest: ['4-2-3-1','3-5-2','4-1-4-1','4-2-2-2','2-5-2-1'], synergyWorst: ['4-2-4','5-4-1','5-3-1-1'] },
      { key: 'counter', label: 'Counter Attack', meta: 'Transitions', new: false, mods: { ATT: 1.06, DEF: 1.01, TMP: 1.08, CTR: 0.78, SET: 1.06 }, desc: 'Absorb then sprint forward on vertical passes. Few chances, but very high-value.', longDesc: 'You let the opponent have the ball in safe areas, then the moment you win it 3–4 players surge past the disorganised defensive line. Elite finishers feast.', biases: { mid: 0.82, fin: 1.16 }, synergyBest: ['4-5-1','5-2-3','5-3-2','5-4-1','5-2-2-1'], synergyWorst: ['2-5-2-1','4-3-2-1','3-5-2'] },
      { key: 'wingplay', label: 'Wing Play', meta: 'Width', new: false, mods: { ATT: 1.04, DEF: 0.99, TMP: 1.07, CTR: 0.94, SET: 1.14 }, desc: 'Fill the flanks, fire crosses, exploit set pieces. Centre gets slightly underloaded.', longDesc: 'Full-backs push high, wingers stay wide, the box fills with runners. Corners and second balls become your primary route. Just don\'t get trapped on the touchline.', biases: { mid: 0.96, fin: 1.08 }, synergyBest: ['4-3-3','3-4-3','4-4-2','5-2-3','3-3-1-3'], synergyWorst: ['4-1-2-1-2','4-3-1-2','3-3-2-2'] },
      { key: 'compact', label: 'Compact Midfield', meta: 'Narrow control', new: false, mods: { ATT: 0.98, DEF: 1.05, TMP: 0.90, CTR: 1.12, SET: 0.98 }, desc: 'Clog the middle, win second balls. Width beats you.', longDesc: 'The midfield block stays narrow horizontally. Through-balls almost never land; opponents get funnelled wide so cross-shots come from bad angles.', biases: { mid: 1.14, fin: 0.90 }, synergyBest: ['3-5-2','4-1-2-1-2','5-2-2-1','3-3-2-2','4-3-2-1'], synergyWorst: ['3-4-3','5-2-3','3-3-1-3'] },
      { key: 'direct', label: 'Direct Play', meta: 'Long balls', new: true, mods: { ATT: 1.05, DEF: 1.00, TMP: 1.10, CTR: 0.76, SET: 1.10 }, desc: 'Bypass midfield entirely. Target-men, flick-ons, through-runs. Striker quality = everything.', longDesc: 'Why build through the middle when you can go over it? GK/DCs ping long, wingers chase flick-ons. Elite finishers overperform xG heavily; bad midfield quality gets hidden.', biases: { mid: 0.72, fin: 1.24 }, synergyBest: ['4-4-2','5-3-2','4-2-4','5-3-1-1','4-4-1-1'], synergyWorst: ['2-5-2-1','4-3-2-1','4-2-2-2','3-5-2'] },
      { key: 'tiki-taka', label: 'Tiki-Taka', meta: 'Short triangles', new: true, mods: { ATT: 1.03, DEF: 1.02, TMP: 0.90, CTR: 1.30, SET: 0.96 }, desc: 'Patient short-passing attrition. Mountains of xG from sheer volume. Single-chance conversion suffers.', longDesc: 'Every outfield player comfortable on the ball. Triangles everywhere, 1-2 touches every pass. 500–600 completed passes per match. Midfield is EVERYTHING; one 75-rated striker tanks your finishing.', biases: { mid: 1.32, fin: 0.88 }, synergyBest: ['4-2-3-1','2-5-2-1','4-3-2-1','3-5-2','4-2-2-2','4-3-1-2'], synergyWorst: ['4-2-4','5-3-1-1','5-4-1','5-2-3','4-4-2'] }
    ];

    function getStyleSynergyForFormation(styleKey, formation) {
      if (!formation) return { match: 'neutral', label: '' };
      const style = TACTICAL_STYLES.find((s) => s.key === styleKey);
      if (!style) return { match: 'neutral', label: '' };
      if (style.synergyBest.length && style.synergyBest.includes(formation)) return { match: 'great', label: 'Great fit' };
      if (style.synergyWorst.length && style.synergyWorst.includes(formation)) return { match: 'poor', label: 'Poor fit' };
      return { match: 'neutral', label: 'Ok fit' };
    }

    const POS_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };
    function sortPlayers(players, mode) {
      const arr = players.slice();
      if (mode === 'position') {
        arr.sort((a, b) => (POS_ORDER[a.pos] - POS_ORDER[b.pos]) || (b.overall ?? 0) - (a.overall ?? 0));
      } else if (mode === 'random') {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
      } else {
        arr.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
      }
      return arr;
    }

    const layoutMode = localStorage.getItem('draftbox.draftLayout') || 'vertical';
    const isHorizontal = layoutMode === 'horizontal';
    const isPitchFirst = layoutMode === 'pitch-first';

    const topbar = `
      <div class="card" id="timerCard" style="display:none;">
        <div class="timer-wrap">
          <div class="timer-track"><div class="timer-fill" id="timerFill" style="width:100%;"></div></div>
          <div class="timer-label" id="timerLabel"></div>
        </div>
      </div>
    `;

    const squadCard = `
      <div class="card draft-squad-card" id="squadCard">
        <div class="row" style="align-items:center;">
          <h3 style="margin:0;">👤 My Squad</h3>
          <span class="muted" style="text-align:right;">Players left in pool: <b id="poolCount">-</b></span>
        </div>
        <p class="muted center" id="squadProgress"></p>
        <div class="draft-lineup-tools">
          <label>Locked Formation</label>
          <b class="draft-formation-badge" id="draftFormationBadge">${myFormation}</b>
          <span id="lineupMoveHint">Tap a filled slot to rearrange your XI.</span>
        </div>
        <div id="squadPitch"></div>
      </div>
    `;

    const revealWrap = `
      <div class="draft-main-col">
        ${topbar}
        <div class="card draft-reveal-card" id="revealCard">
          <p class="muted center">Fetching the first random team...</p>
        </div>
        <div id="ratingsCardZone" style="display:none;margin-bottom:16px;"></div>
        <div id="waitingZone"></div>
      </div>
    `;

    if (isHorizontal) {
      container.innerHTML = `
        <div class="draft-layout draft-layout-horizontal">
          <div class="draft-left-col">
            ${squadCard}
          </div>
          <div class="draft-right-col">
            ${revealWrap}
          </div>
        </div>
      `;
    } else if (isPitchFirst) {
      container.innerHTML = `
        <div class="draft-layout draft-layout-pitch-first">
          ${topbar}
          ${squadCard}
          <div class="card" id="revealCard">
            <p class="muted center">Fetching the first random team...</p>
          </div>
          <div id="ratingsCardZone" style="display:none;margin-bottom:16px;"></div>
          <div id="waitingZone"></div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="draft-layout draft-layout-vertical">
          ${topbar}
          <div class="card" id="revealCard">
            <p class="muted center">Fetching the first random team...</p>
          </div>
          ${squadCard}
          <div id="ratingsCardZone" style="display:none;margin-bottom:16px;"></div>
          <div id="waitingZone"></div>
        </div>
      `;
    }

    const timerCard = container.querySelector('#timerCard');
    const timerFill = container.querySelector('#timerFill');
    const timerLabel = container.querySelector('#timerLabel');
    const revealCard = container.querySelector('#revealCard');
    const squadProgress = container.querySelector('#squadProgress');
    const squadPitch = container.querySelector('#squadPitch');
    const poolCount = container.querySelector('#poolCount');
    const waitingZone = container.querySelector('#waitingZone');
    const ratingsCardZone = container.querySelector('#ratingsCardZone');
    const formationBadge = container.querySelector('#draftFormationBadge');
    const lineupMoveHint = container.querySelector('#lineupMoveHint');

    function slotGroup(slotCode) {
      const slot = getSlots(myFormation).find((s) => s.code === slotCode);
      return slot ? slot.group : null;
    }

    const SLOT_COMPATIBILITY = {
      GK: ['GK'], CB: ['CB'], LB: ['LB'], RB: ['RB'], LWB: ['LWB', 'LB', 'LM'], RWB: ['RWB', 'RB', 'RM'],
      CDM: ['CDM'], CM: ['CM'], CAM: ['CAM'], LAM: ['LAM', 'CAM', 'LM', 'LW'], RAM: ['RAM', 'CAM', 'RM', 'RW'],
      LM: ['LM', 'LW', 'LWB'], RM: ['RM', 'RW', 'RWB'], LW: ['LW', 'LM'], RW: ['RW', 'RM'], SS: ['SS', 'CF', 'ST', 'CAM'], ST: ['ST', 'CF']
    };
    const GROUP_POSITION_FALLBACKS = { GK: ['GK'], DF: ['CB', 'LB', 'RB', 'LWB', 'RWB'], MF: ['CDM', 'CM', 'CAM', 'LM', 'RM', 'LAM', 'RAM'], FW: ['ST', 'CF', 'SS', 'LW', 'RW'] };
    function positionCodes(rawPos, group) {
      return String(rawPos || group || '').split(/[,/|]/).map((v) => v.trim().toUpperCase().replace(/[^A-Z]/g, '')).filter(Boolean).flatMap((v) => GROUP_POSITION_FALLBACKS[v] || [v]);
    }
    function playerFitsSlot(player, slot) {
      const allowed = SLOT_COMPATIBILITY[(slot.short || slot.code || '').toUpperCase()] || [(slot.short || slot.code || '').toUpperCase()];
      return positionCodes(player.rawPos, player.pos).some((p) => allowed.includes(p));
    }

    function refreshOpenSlotsFromLineup(openSlots) {
      if (Array.isArray(openSlots)) {
        lastOpenSlots = openSlots;
      } else {
        lastOpenSlots = getSlots(myFormation).filter((slot) => !(currentSlotsMap && currentSlotsMap[slot.code]));
      }
      if (lastRevealPayload) lastRevealPayload.openSlots = lastOpenSlots;
    }

    function refreshRevealPlayersForOpenSlots() {
      if (!lastRevealPayload || !Array.isArray(lastPlayers) || !lastPlayers.length) return;
      lastPlayers = lastPlayers.map((player) => {
        const inPool = player.poolAvailable !== undefined ? player.poolAvailable : player.available;
        return {
          ...player,
          poolAvailable: inPool,
          available: !!inPool && lastOpenSlots.some((slot) => playerFitsSlot(player, slot))
        };
      });
      lastRevealPayload.players = lastPlayers;
      renderPlayerGrid();
    }

    function setFormationControl() {
      if (formationBadge) formationBadge.textContent = myFormation;
    }

    // Multiplayer rooms wait for the room creator's explicit confirmation once everyone
    // is ready, instead of yanking every player into the tournament the instant the last
    // person finishes drafting. Singleplayer auto-starts (nobody else to coordinate with).
    function renderWaitingZone() {
      if (!iAmReady) { waitingZone.innerHTML = ''; return; }
      if (singlePlayer) {
        waitingZone.innerHTML = `<p class="muted center">Your draft is complete! Starting the World Cup...</p>`;
        return;
      }
      if (!allReady) {
        waitingZone.innerHTML = `<p class="muted center">Your draft is complete! Waiting for other players to finish their drafts...</p>`;
        return;
      }
      if (isCreator) {
        waitingZone.innerHTML = `
          <div class="card center">
            <p class="muted">Everyone's ready!</p>
            <button class="btn btn-primary btn-block" id="btnStartTournament">Start Tournament</button>
          </div>
        `;
        waitingZone.querySelector('#btnStartTournament').addEventListener('click', (e) => {
          e.target.disabled = true;
          e.target.textContent = 'Starting...';
          socket.emit('room:startTournament', { code });
        });
      } else {
        waitingZone.innerHTML = `<p class="muted center">Everyone's ready! Waiting for the room creator to start the tournament...</p>`;
      }
    }

    function renderRatingsCard(data) {
      if (!data) { ratingsCardZone.style.display = 'none'; return; }
      ratingsCardZone.style.display = 'block';
      RatingsCard.render(ratingsCardZone, data);
    }

    function stopTimer() {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      timerCard.style.display = 'none';
    }

    function startTimer(deadline, durationMs) {
      stopTimer();
      if (deadline == null) return; // "No Limit" room — no countdown UI at all
      pickTimeMs = durationMs || pickTimeMs;
      timerCard.style.display = 'block';
      const tick = () => {
        const remaining = Math.max(0, deadline - Date.now());
        const pct = Math.max(0, Math.min(100, (remaining / pickTimeMs) * 100));
        timerFill.style.width = pct + '%';
        timerFill.classList.toggle('warn', pct <= 50 && pct > 20);
        timerFill.classList.toggle('danger', pct <= 20);
        timerLabel.textContent = `${Math.ceil(remaining / 1000)}s to pick — auto-pick kicks in if time runs out`;
        if (remaining <= 0) clearInterval(timerInterval);
      };
      tick();
      timerInterval = setInterval(tick, 250);
    }

    function renderSquadPitch(slotsMap) {
      currentSlotsMap = slotsMap || {};
      setFormationControl();
      const slotDefs = getSlots(myFormation);
      const filledCount = Object.values(slotsMap || {}).filter(Boolean).length;
      squadProgress.textContent = `${filledCount} / 11 positions filled`;
      if (lineupMoveHint) {
        lineupMoveHint.textContent = moveFromSlot
          ? `Move ${currentSlotsMap[moveFromSlot] ? currentSlotsMap[moveFromSlot].name : 'player'} to a valid natural slot.`
          : 'Tap a filled slot to rearrange your XI.';
      }
      Pitch.render(squadPitch, slotDefs, (slot) => {
        const occupant = slotsMap && slotsMap[slot.code];
        const moving = moveFromSlot === slot.code;
        const movingPlayer = moveFromSlot ? currentSlotsMap[moveFromSlot] : null;
        const swapTarget = occupant || null;
        const fromSlotDef = moveFromSlot ? slotDefs.find((s) => s.code === moveFromSlot) : null;
        const targetable = moveFromSlot && moveFromSlot !== slot.code && movingPlayer && playerFitsSlot(movingPlayer, slot) && (!swapTarget || playerFitsSlot(swapTarget, fromSlotDef));
        if (occupant) {
          return {
            className: `filled ${roleClass(slot.group)} clickable ${moving ? 'moving' : ''} ${targetable ? 'move-target' : ''}`,
            text: slot.short,
            title: `${occupant.name} (${slot.label})`,
            nameLabel: occupant.name.split(' ').slice(-1)[0],
            onClick: () => handleSlotMoveClick(slot.code)
          };
        }
        return {
          className: targetable ? 'clickable move-target empty-target' : '',
          text: slot.short,
          title: slot.label,
          onClick: targetable ? () => handleSlotMoveClick(slot.code) : null
        };
      });
    }

    function rememberDraftCompleteState(slotsMap, captainSlot, tacticalStyle, locked, ratingsCard) {
      myDraftComplete = true;
      lastDraftCompleteState = {
        slots: slotsMap || currentSlotsMap || {},
        captainSlot: captainSlot || null,
        tacticalStyle: tacticalStyle || myTacticalStyle,
        tacticalStyleLocked: !!locked,
        ratingsCard: ratingsCard || null
      };
    }

    function restoreDraftCompleteControls() {
      const state = lastDraftCompleteState || {
        slots: currentSlotsMap || {},
        captainSlot: null,
        tacticalStyle: myTacticalStyle,
        tacticalStyleLocked,
        ratingsCard: null
      };
      handleDraftComplete(state.slots, state.captainSlot, state.tacticalStyle, state.tacticalStyleLocked, state.ratingsCard);
    }

    function handleSlotMoveClick(slotCode) {
      if (!currentSlotsMap) return;
      if (!moveFromSlot) {
        if (!currentSlotsMap[slotCode]) return;
        moveFromSlot = slotCode;
        renderSquadPitch(currentSlotsMap);
        return;
      }
      if (moveFromSlot === slotCode) {
        moveFromSlot = null;
        renderSquadPitch(currentSlotsMap);
        return;
      }
      const slotDefs = getSlots(myFormation);
      const fromDef = slotDefs.find((s) => s.code === moveFromSlot);
      const toDef = slotDefs.find((s) => s.code === slotCode);
      const source = currentSlotsMap[moveFromSlot];
      const target = currentSlotsMap[slotCode];
      if (!source || !toDef || !playerFitsSlot(source, toDef) || (target && !playerFitsSlot(target, fromDef))) {
        App.toast('This swap does not fit the players natural positions', true);
        return;
      }
      const fromSlotCode = moveFromSlot;
      moveFromSlot = null;
      socket.emit('draft:moveSlot', { code, fromSlotCode, toSlotCode: slotCode });
    }

    function renderReveal(payload) {
      if (payload.done) {
        stopTimer();
        myDraftComplete = true;
        restoreDraftCompleteControls();
        return;
      }
      if (payload.exhausted) {
        stopTimer();
        revealCard.innerHTML = '<p class="error-text center">No suitable player was found for the remaining positions. Please refresh the page.</p>';
        return;
      }

      lastRevealPayload = payload;
      lastOpenSlots = payload.openSlots;
      lastPlayers = (payload.players || []).map((player) => ({
        ...player,
        poolAvailable: player.poolAvailable !== undefined ? player.poolAvailable : player.available
      }));
      lastRevealPayload.players = lastPlayers;
      sharedDraft = payload.sharedDraft || sharedDraft;
      const ratingsVisible = payload.players.some((p) => p.overall !== null);
      if (sortMode === 'rating' && !ratingsVisible) sortMode = 'position';
      startTimer(payload.deadline, payload.pickTimeMs);

      const rerollsAllowed = payload.rerollsAllowed || 0;
      const rerollsRemaining = payload.rerollsRemaining || 0;
      const isMySharedTurn = !sharedDraftMode || !sharedDraft || sharedDraft.isMyTurn;
      const sharedStatus = sharedDraftMode && sharedDraft ? `
        <div class="shared-draft-panel">
          <div><span>Shared Team Draft · pick ${Number(sharedDraft.teamPickCount || 0) + 1}</span><b>${sharedDraft.currentTeam ? sharedDraft.currentTeam.name : payload.team.name}</b></div>
          <p>${sharedDraft.isMyTurn ? 'Your turn: pick one player from this team.' : `Waiting for ${sharedDraft.turnUsername || 'the next player'} to pick from this team.`}</p>
          <div class="shared-draft-order">
            ${(sharedDraft.members || []).map((m) => `<span class="${m.turn ? 'active' : ''} ${m.draftComplete ? 'done' : ''}">${m.username} (${m.picks}/11)</span>`).join('')}
          </div>
        </div>
      ` : '';

      revealCard.innerHTML = `
        <div class="reveal-team">${payload.team.name}</div>
        <div class="reveal-sub">${sharedDraftMode ? (isMySharedTurn ? 'Pick one player, then the turn passes to the next player.' : 'Same team is visible for everyone; wait until your turn unlocks picks.') : (payload.deadline == null ? 'Pick one player from this team for your squad — no time limit, take your time' : 'Pick one player from this team for your squad — no skipping, the clock is running')}</div>
        ${sharedStatus}
        <div class="sort-toolbar" id="sortToolbar">
          ${ratingsVisible ? `<button type="button" class="sort-btn" data-mode="rating" title="Sort by rating"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2"/></svg></button>` : ''}
          <button type="button" class="sort-btn" data-mode="position" title="Sort by position"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
          <button type="button" class="sort-btn" data-mode="random" title="Random order"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></button>
          ${!sharedDraftMode && rerollsAllowed > 0 ? `<button type="button" class="sort-btn reroll-btn" id="btnReroll" title="Skip this team (${rerollsRemaining} reroll${rerollsRemaining === 1 ? '' : 's'} left)" ${rerollsRemaining <= 0 ? 'disabled' : ''}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg><span class="reroll-count">${rerollsRemaining}</span></button>` : ''}
        </div>
        <div class="player-grid" id="playerGrid"></div>
      `;

      const toolbar = revealCard.querySelector('#sortToolbar');
      toolbar.querySelectorAll('.sort-btn:not(.reroll-btn)').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.mode === sortMode);
        btn.addEventListener('click', () => {
          sortMode = btn.dataset.mode;
          toolbar.querySelectorAll('.sort-btn:not(.reroll-btn)').forEach((b) => b.classList.toggle('selected', b === btn));
          renderPlayerGrid();
        });
      });
      const rerollBtn = toolbar.querySelector('#btnReroll');
      if (rerollBtn) {
        rerollBtn.addEventListener('click', () => {
          rerollBtn.disabled = true;
          socket.emit('draft:reroll', { code });
        });
      }

      renderPlayerGrid();
    }

    function renderPlayerGrid() {
      const grid = revealCard.querySelector('#playerGrid');
      if (!grid) return;
      const players = sortPlayers(lastPlayers, sortMode);
      const lockedByTurn = sharedDraftMode && sharedDraft && !sharedDraft.isMyTurn;
      grid.innerHTML = players.map((p) => `
        <div class="player-card ${p.available && !lockedByTurn ? '' : 'unavailable'}" data-id="${p.id}" data-pos="${p.pos}" data-name="${p.name.replace(/"/g, '&quot;')}">
          <div class="pname">${p.isStar ? '<span class="star">★</span> ' : ''}${p.name}</div>
          <div class="pmeta"><span>${p.rawPos || POS_LABEL[p.pos]}</span>${p.overall !== null ? `<span class="overall">${p.overall}</span>` : ''}</div>
        </div>
      `).join('');

      grid.querySelectorAll('.player-card').forEach((card) => {
        card.addEventListener('click', () => {
          if (card.classList.contains('unavailable') || (sharedDraftMode && sharedDraft && !sharedDraft.isMyTurn)) return;
          const playerId = card.dataset.id;
          const player = lastPlayers.find((p) => p.id === playerId);
          const playerName = card.dataset.name;
          const candidateSlots = lastOpenSlots.filter((s) => playerFitsSlot(player || {}, s));
          if (candidateSlots.length <= 1) {
            const slotCode = candidateSlots[0] ? candidateSlots[0].code : null;
            socket.emit('draft:pick', { code, playerId, slotCode });
          } else {
            showSlotChoice(playerId, playerName, candidateSlots);
          }
        });
      });
    }

    function handleDraftComplete(slotsMap, captainSlot, tacticalStyle, locked, ratingsCard) {
      stopTimer();
      rememberDraftCompleteState(slotsMap, captainSlot, tacticalStyle, locked, ratingsCard);
      renderRatingsCard(ratingsCard);
      myTacticalStyle = tacticalStyle || myTacticalStyle;
      tacticalStyleLocked = !!locked;
      if (captainEnabled && !captainSlot) {
        iAmReady = false;
        renderCaptainPicker(slotsMap, captainSlot);
      } else if (!tacticalStyleLocked) {
        iAmReady = false;
        renderTacticalStylePicker();
      } else {
        iAmReady = true;
        revealCard.innerHTML = '';
        renderWaitingZone();
      }
    }

    function renderTacticalStylePicker() {
      if (!customTacticsLoaded) {
        customTacticsLoaded = true;
        Api.get('/api/tactics').then((rows) => {
          customTactics = Array.isArray(rows) ? rows : [];
          if (!tacticalStyleLocked && myDraftComplete) renderTacticalStylePicker();
        }).catch(() => { customTactics = []; });
      }
      const fmtMod = (v) => {
        const pct = Math.round((v - 1) * 100);
        if (pct === 0) return '0%';
        return pct > 0 ? `+${pct}%` : `${pct}%`;
      };
      const fmtBias = (v, label) => {
        const diff = Math.round((v - 1) * 100);
        if (Math.abs(diff) < 3) return `<span class='bias-pill'>${label} · Mid</span>`;
        const cls = diff > 0 ? 'good' : 'bad';
        const sign = diff > 0 ? '+' : '';
        return `<span class='bias-pill ${cls}'>${label} · ${sign}${diff}%</span>`;
      };
      const customCards = customTactics.map((t) => ({
        key: `custom:${t.id}`,
        label: t.name,
        meta: 'My custom tactic',
        custom: true,
        new: false,
        mods: { ATT: Number(t.attack) || 1, DEF: Number(t.defense) || 1, TMP: Number(t.tempo) || 1, CTR: Number(t.control) || 1, SET: Number(t.setPiece) || 1 },
        desc: t.description || 'Personal saved tactic from the Engine Lab.',
        longDesc: t.longDescription || 'Uses your saved Attack, Defense, Control, Creation, Finishing, Risk and Star Moment modifiers in the match engine.',
        biases: { mid: Number(t.midfieldBias) || 1, fin: Number(t.finishingBias) || 1 },
        synergyBest: [],
        synergyWorst: []
      }));
      const styles = TACTICAL_STYLES.concat(customCards);
      revealCard.innerHTML = `
        <div class='reveal-team'>Choose Tactical Style</div>
        <div class='reveal-sub'>Each style changes attack, defence, tempo, possession, fouls, star moments and matchup edge. Also has a <b>Midfield Creation Bias</b> and a <b>Finisher Conversion Bias</b> (see the "two-phase xG" explainer in Formations &amp; Tactics → Game Guide).</div>
        <div class='tactical-style-grid' id='tacticalStyleGrid'>
          ${styles.map((s) => {
            const syn = getStyleSynergyForFormation(s.key, myFormation);
            const synCls = `synergy-tag synergy-${syn.match}`;
            return `
            <button type='button' class='tactical-style-card ${s.custom ? 'custom-style-card' : ''} ${s.key === myTacticalStyle ? 'selected' : ''}' data-style='${s.key}'>
              <div style='display:flex; align-items:center; justify-content:space-between;'>
                <span>${s.meta}</span>
                ${s.custom ? `<span class='new-badge'>Saved</span>` : (s.new ? `<span class='new-badge'>New</span>` : '')}
              </div>
              <div>
                <b>${s.label}</b>
                ${s.custom ? `<span class='synergy-tag synergy-neutral'>Personal</span>` : `<span class='${synCls}'>${syn.label}</span>`}
              </div>
              <small>${s.desc}</small>
              <div class='mods'>
                <span>ATT <b>${fmtMod(s.mods.ATT)}</b></span>
                <span>DEF <b>${fmtMod(s.mods.DEF)}</b></span>
                <span>TMP <b>${fmtMod(s.mods.TMP)}</b></span>
                <span>CTR <b>${fmtMod(s.mods.CTR)}</b></span>
              </div>
              <div class='biases'>
                ${fmtBias(s.biases.mid, 'Creation')}
                ${fmtBias(s.biases.fin, 'Finishing')}
              </div>
              <div class='style-long'>${s.longDesc}</div>
            </button>`;
          }).join('')}
        </div>
        <button class='btn btn-primary btn-block' id='btnLockTacticalStyle'>Lock Tactical Style</button>
      `;
      revealCard.querySelectorAll('.tactical-style-card').forEach((btn) => {
        btn.addEventListener('click', () => {
          myTacticalStyle = btn.dataset.style;
          revealCard.querySelectorAll('.tactical-style-card').forEach((b) => b.classList.toggle('selected', b === btn));
        });
      });
      revealCard.querySelector('#btnLockTacticalStyle').addEventListener('click', (e) => {
        e.target.disabled = true;
        e.target.textContent = 'Locking...';
        socket.emit('draft:setTacticalStyle', { code, tacticalStyle: myTacticalStyle });
      });
    }

    function renderCaptainPicker(slotsMap, currentCaptainSlot) {
      revealCard.innerHTML = `
        <div class="reveal-team">Choose Your Captain</div>
        <div class="reveal-sub">Your captain gets a rating boost for the whole tournament. Tap a player to pick them.</div>
        <div id="captainPitch"></div>
      `;
      const pitchEl = revealCard.querySelector('#captainPitch');
      Pitch.render(pitchEl, getSlots(myFormation), (slot) => {
        const occupant = slotsMap[slot.code];
        if (!occupant) return { text: slot.short, title: slot.label };
        const isCaptain = slot.code === currentCaptainSlot;
        return {
          className: `${roleClass(slot.group)} clickable ${isCaptain ? 'captain' : ''}`,
          text: isCaptain ? 'C' : slot.short,
          title: `${occupant.name}${isCaptain ? ' — Captain' : ''}`,
          nameLabel: occupant.name.split(' ').slice(-1)[0],
          onClick: () => socket.emit('draft:setCaptain', { code, slotCode: slot.code })
        };
      });
    }

    function showSlotChoice(playerId, playerName, candidateSlots) {
      revealCard.innerHTML = `
        <div class="reveal-team">${playerName}</div>
        <div class="reveal-sub">Which position should they play?</div>
        <div class="slot-choice" id="slotChoice"></div>
        <button class="btn btn-block" id="btnCancelSlot">← Back to squad picks</button>
      `;
      const choiceZone = revealCard.querySelector('#slotChoice');
      choiceZone.innerHTML = candidateSlots.map((s) => `<div class="slot-choice-btn" data-code="${s.code}">${s.label}</div>`).join('');
      choiceZone.querySelectorAll('.slot-choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          socket.emit('draft:pick', { code, playerId, slotCode: btn.dataset.code });
        });
      });
      revealCard.querySelector('#btnCancelSlot').addEventListener('click', () => {
        if (lastRevealPayload) renderReveal(lastRevealPayload);
      });
    }

    App.onSocket('room:state', (s) => {
      const me = (s.members || []).find((m) => m.userId === App.state.user.id);
      if (me) myFormation = me.formation;
      if (me && me.tacticalStyle) myTacticalStyle = me.tacticalStyle;
      tacticalStyleLocked = !!(me && me.tacticalStyleLocked);
      captainEnabled = !!s.captainEnabled;
      isCreator = s.creatorId === App.state.user.id;
      singlePlayer = !!s.singlePlayer;
      sharedDraftMode = !!s.sharedDraftMode;
      allReady = !!s.allReady;
      if (s.myDraft) {
        myDraftComplete = !!s.myDraft.draftComplete;
        renderSquadPitch(s.myDraft.slots);
        poolCount.textContent = s.poolRemaining ?? '-';
        const autoKey = `draftbox.autoDraft.${code}`;
        if (singlePlayer && !s.myDraft.draftComplete && sessionStorage.getItem(autoKey) === '1' && !autoDraftRequested) {
          autoDraftRequested = true;
          revealCard.innerHTML = '<p class="muted center">Experimental auto draft is selecting your XI...</p>';
          socket.emit('draft:autoComplete', { code });
        } else if (!s.myDraft.draftComplete) socket.emit('draft:reveal', { code });
        else handleDraftComplete(s.myDraft.slots, s.myDraft.captainSlot, s.myDraft.tacticalStyle, s.myDraft.tacticalStyleLocked, s.myDraft.ratingsCard);
      }
    });

    App.onSocket('room:memberUpdate', (snap) => {
      allReady = !!snap.allReady;
      renderWaitingZone();
    });

    App.onSocket('draft:reveal', renderReveal);

    App.onSocket('draft:sharedStateChanged', () => {
      if (!iAmReady && !myDraftComplete) socket.emit('draft:reveal', { code });
    });


    App.onSocket('draft:lineupChanged', (payload) => {
      moveFromSlot = null;
      renderSquadPitch(payload.slots);
      refreshOpenSlotsFromLineup(payload.openSlots);
      refreshRevealPlayersForOpenSlots();
      renderRatingsCard(payload.ratingsCard);
      if (payload.draftComplete) handleDraftComplete(payload.slots, payload.captainSlot, payload.tacticalStyle, payload.tacticalStyleLocked, payload.ratingsCard);
    });

    App.onSocket('draft:picked', (payload) => {
      if (payload.userId !== App.state.user.id) return;
      myDraftComplete = !!payload.draftComplete;
      renderSquadPitch(payload.slots);
      refreshOpenSlotsFromLineup(payload.openSlots);
      if (payload.auto && !autoDraftRequested) App.toast(`Time is up - auto-picked ${payload.player.name} (${POS_LABEL[payload.player.pos]})`, false);
      if (!payload.draftComplete) {
        if (!autoDraftRequested) socket.emit('draft:reveal', { code });
      } else {
        handleDraftComplete(payload.slots, payload.captainSlot, payload.tacticalStyle, payload.tacticalStyleLocked, payload.ratingsCard);
      }
    });

    App.onSocket('draft:captainSet', (payload) => {
      renderRatingsCard(payload.ratingsCard);
      handleDraftComplete(payload.slots, payload.captainSlot, payload.tacticalStyle, payload.tacticalStyleLocked, payload.ratingsCard);
    });

    App.onSocket('draft:tacticalStyleSet', (payload) => {
      myTacticalStyle = payload.tacticalStyle || myTacticalStyle;
      tacticalStyleLocked = true;
      renderRatingsCard(payload.ratingsCard);
      rememberDraftCompleteState(payload.slots, payload.captainSlot, myTacticalStyle, true, payload.ratingsCard);
      revealCard.innerHTML = '';
      iAmReady = true;
      renderWaitingZone();
    });

    App.onSocket('draft:poolUpdate', (u) => {
      poolCount.textContent = u.poolRemaining;
    });

    App.onSocket('tournament:started', () => { sessionStorage.removeItem(`draftbox.autoDraft.${code}`); stopTimer(); App.goTournament(code); });

    App.onSocket('error:message', (e) => App.toast(e.error, true));
  }
};
