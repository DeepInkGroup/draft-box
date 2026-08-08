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

    container.innerHTML = `
      <div class="card" id="timerCard" style="display:none;">
        <div class="timer-wrap">
          <div class="timer-track"><div class="timer-fill" id="timerFill" style="width:100%;"></div></div>
          <div class="timer-label" id="timerLabel"></div>
        </div>
      </div>
      <div class="card" id="revealCard">
        <p class="muted center">Fetching the first random team...</p>
      </div>
      <div class="card">
        <div class="row" style="align-items:center;">
          <h3 style="margin:0;">👤 My Squad</h3>
          <span class="muted" style="text-align:right;">Players left in pool: <b id="poolCount">-</b></span>
        </div>
        <p class="muted center" id="squadProgress"></p>
        <div id="squadPitch"></div>
      </div>
      <p class="muted center" id="waitingMsg" style="display:none;">✅ Your draft is complete! Waiting for other players before the World Cup starts...</p>
    `;

    const timerCard = container.querySelector('#timerCard');
    const timerFill = container.querySelector('#timerFill');
    const timerLabel = container.querySelector('#timerLabel');
    const revealCard = container.querySelector('#revealCard');
    const squadProgress = container.querySelector('#squadProgress');
    const squadPitch = container.querySelector('#squadPitch');
    const poolCount = container.querySelector('#poolCount');
    const waitingMsg = container.querySelector('#waitingMsg');

    function stopTimer() {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      timerCard.style.display = 'none';
    }

    function startTimer(deadline, durationMs) {
      stopTimer();
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
          return { className: 'filled', text: slot.short, title: `${occupant.name} (${slot.label})`, nameLabel: occupant.name.split(' ').slice(-1)[0] };
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

      lastOpenSlots = payload.openSlots;
      startTimer(payload.deadline, payload.pickTimeMs);

      revealCard.innerHTML = `
        <div class="reveal-team">${payload.team.name}</div>
        <div class="reveal-sub">Pick one player from this team for your squad — no skipping, the clock is running</div>
        <div class="player-grid" id="playerGrid"></div>
      `;
      const grid = revealCard.querySelector('#playerGrid');
      grid.innerHTML = payload.players.map((p) => `
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

    function handleDraftComplete(slotsMap, captainSlot) {
      stopTimer();
      if (captainEnabled && !captainSlot) {
        renderCaptainPicker(slotsMap, captainSlot);
      } else {
        revealCard.innerHTML = '';
        waitingMsg.style.display = 'block';
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
          className: isCaptain ? 'filled' : 'clickable',
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
        socket.emit('draft:reveal', { code });
      });
    }

    App.onSocket('room:state', (s) => {
      const me = (s.members || []).find((m) => m.userId === App.state.user.id);
      if (me) myFormation = me.formation;
      captainEnabled = !!s.captainEnabled;
      if (s.myDraft) {
        renderSquadPitch(s.myDraft.slots);
        poolCount.textContent = s.poolRemaining ?? '-';
        if (!s.myDraft.draftComplete) socket.emit('draft:reveal', { code });
        else handleDraftComplete(s.myDraft.slots, s.myDraft.captainSlot);
      }
    });

    App.onSocket('draft:reveal', renderReveal);

    App.onSocket('draft:picked', (payload) => {
      if (payload.userId !== App.state.user.id) return;
      renderSquadPitch(payload.slots);
      if (payload.auto) App.toast(`⏱ Time's up — auto-picked ${payload.player.name} (${POS_LABEL[payload.player.pos]})`, false);
      if (!payload.draftComplete) {
        socket.emit('draft:reveal', { code });
      } else {
        handleDraftComplete(payload.slots, payload.captainSlot);
      }
    });

    App.onSocket('draft:captainSet', () => {
      revealCard.innerHTML = '';
      waitingMsg.style.display = 'block';
    });

    App.onSocket('draft:poolUpdate', (u) => {
      poolCount.textContent = u.poolRemaining;
    });

    App.onSocket('tournament:started', () => { stopTimer(); App.goTournament(code); });

    App.onSocket('error:message', (e) => App.toast(e.error, true));
  }
};
