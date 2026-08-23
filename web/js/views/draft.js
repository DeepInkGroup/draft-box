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
      const slotDefs = getSlots(myFormation);
      const filledCount = Object.values(slotsMap || {}).filter(Boolean).length;
      squadProgress.textContent = `${filledCount} / 11 positions filled`;
      Pitch.render(squadPitch, slotDefs, (slot) => {
        const occupant = slotsMap && slotsMap[slot.code];
        if (occupant) {
          return {
            className: `filled ${roleClass(slot.group)}`,
            text: slot.short,
            title: `${occupant.name} (${slot.label})`,
            nameLabel: occupant.name.split(' ').slice(-1)[0]
          };
        }
        return { text: slot.short, title: slot.label };
      });
    }

    function renderReveal(payload) {
      if (payload.done) {
        stopTimer();
        revealCard.innerHTML = '';
        waitingMsg.style.display = 'block';
        return;
      }
      if (payload.exhausted) {
        stopTimer();
        revealCard.innerHTML = '<p class="error-text center">No suitable player was found for the remaining positions. Please refresh the page.</p>';
        return;
      }

      lastRevealPayload = payload;
      lastOpenSlots = payload.openSlots;
      lastPlayers = payload.players;
      const ratingsVisible = payload.players.some((p) => p.overall !== null);
      if (sortMode === 'rating' && !ratingsVisible) sortMode = 'position';
      startTimer(payload.deadline, payload.pickTimeMs);

      const rerollsAllowed = payload.rerollsAllowed || 0;
      const rerollsRemaining = payload.rerollsRemaining || 0;

      revealCard.innerHTML = `
        <div class="reveal-team">${payload.team.name}</div>
        <div class="reveal-sub">${payload.deadline == null ? 'Pick one player from this team for your squad — no time limit, take your time' : 'Pick one player from this team for your squad — no skipping, the clock is running'}</div>
        <div class="sort-toolbar" id="sortToolbar">
          ${ratingsVisible ? `<button type="button" class="sort-btn" data-mode="rating" title="Sort by rating"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2"/></svg></button>` : ''}
          <button type="button" class="sort-btn" data-mode="position" title="Sort by position"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
          <button type="button" class="sort-btn" data-mode="random" title="Random order"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></button>
          ${rerollsAllowed > 0 ? `<button type="button" class="sort-btn reroll-btn" id="btnReroll" title="Skip this team (${rerollsRemaining} reroll${rerollsRemaining === 1 ? '' : 's'} left)" ${rerollsRemaining <= 0 ? 'disabled' : ''}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg><span class="reroll-count">${rerollsRemaining}</span></button>` : ''}
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
      grid.innerHTML = players.map((p) => `
        <div class="player-card ${p.available ? '' : 'unavailable'}" data-id="${p.id}" data-pos="${p.pos}" data-name="${p.name.replace(/"/g, '&quot;')}">
          <div class="pname">${p.isStar ? '<span class="star">★</span> ' : ''}${p.name}</div>
          <div class="pmeta"><span>${POS_LABEL[p.pos]}</span>${p.overall !== null ? `<span class="overall">${p.overall}</span>` : ''}</div>
        </div>
      `).join('');

      grid.querySelectorAll('.player-card').forEach((card) => {
        card.addEventListener('click', () => {
          if (card.classList.contains('unavailable')) return;
          const playerId = card.dataset.id;
          const pos = card.dataset.pos;
          const playerName = card.dataset.name;
          const candidateSlots = lastOpenSlots.filter((s) => s.group === pos);
          if (candidateSlots.length <= 1) {
            const slotCode = candidateSlots[0] ? candidateSlots[0].code : null;
            socket.emit('draft:pick', { code, playerId, slotCode });
          } else {
            showSlotChoice(playerId, playerName, candidateSlots);
          }
        });
      });
    }

    function handleDraftComplete(slotsMap, captainSlot, ratingsCard) {
      stopTimer();
      renderRatingsCard(ratingsCard);
      if (captainEnabled && !captainSlot) {
        iAmReady = false;
        renderCaptainPicker(slotsMap, captainSlot);
      } else {
        iAmReady = true;
        revealCard.innerHTML = '';
        renderWaitingZone();
      }
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
      captainEnabled = !!s.captainEnabled;
      isCreator = s.creatorId === App.state.user.id;
      singlePlayer = !!s.singlePlayer;
      allReady = !!s.allReady;
      if (s.myDraft) {
        renderSquadPitch(s.myDraft.slots);
        poolCount.textContent = s.poolRemaining ?? '-';
        if (!s.myDraft.draftComplete) socket.emit('draft:reveal', { code });
        else handleDraftComplete(s.myDraft.slots, s.myDraft.captainSlot, s.myDraft.ratingsCard);
      }
    });

    App.onSocket('room:memberUpdate', (snap) => {
      allReady = !!snap.allReady;
      renderWaitingZone();
    });

    App.onSocket('draft:reveal', renderReveal);

    App.onSocket('draft:picked', (payload) => {
      if (payload.userId !== App.state.user.id) return;
      renderSquadPitch(payload.slots);
      if (payload.auto) App.toast(`⏱ Time's up — auto-picked ${payload.player.name} (${POS_LABEL[payload.player.pos]})`, false);
      if (!payload.draftComplete) {
        socket.emit('draft:reveal', { code });
      } else {
        handleDraftComplete(payload.slots, payload.captainSlot, payload.ratingsCard);
      }
    });

    App.onSocket('draft:captainSet', (payload) => {
      renderRatingsCard(payload.ratingsCard);
      revealCard.innerHTML = '';
      iAmReady = true;
      renderWaitingZone();
    });

    App.onSocket('draft:poolUpdate', (u) => {
      poolCount.textContent = u.poolRemaining;
    });

    App.onSocket('tournament:started', () => { stopTimer(); App.goTournament(code); });

    App.onSocket('error:message', (e) => App.toast(e.error, true));
  }
};
