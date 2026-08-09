const TournamentView = {
  async render(container, code) {
    container.innerHTML = `<div class="card center muted">Loading the World Cup...</div>`;

    const socket = App.ensureSocket();
    socket.emit('room:join', { code });

    let viewedStep = 0;
    let historyLength = 0;
    let tournamentStage = 'group';
    let newResultsPing = false;
    let isCreator = false;
    let lineupRevealShown = false;
    let myCode = null;

    container.innerHTML = `
      <div id="championZone"></div>
      <div class="center"><span class="stage-pill" id="stagePill">...</span></div>
      <div class="card" id="liveZone" style="display:none;"></div>
      <div class="card" id="stepCard"></div>
      <div class="card center" id="continueZone">
        <button class="btn btn-primary" id="btnContinue">▶ Continue</button>
        <p class="muted" id="newPing" style="display:none;margin-top:8px;">🔔 New results are ready</p>
      </div>
    `;

    const stagePill = container.querySelector('#stagePill');
    const liveZone = container.querySelector('#liveZone');
    const stepCard = container.querySelector('#stepCard');
    const championZone = container.querySelector('#championZone');
    const continueZone = container.querySelector('#continueZone');
    const btnContinue = container.querySelector('#btnContinue');
    const newPing = container.querySelector('#newPing');

    function scoreText(m) {
      let s = `${m.goalsA} - ${m.goalsB}`;
      if (m.wentToPenalties) s += ` (pens: ${m.penalties.A}-${m.penalties.B})`;
      return s;
    }

    function nameTag(name, isHuman, username) {
      return `${name}${isHuman ? ` 👤 ${username}` : ''}`;
    }

    function eventLine(e) {
      const icon = e.type === 'goal' ? '⚽' : e.type === 'yellow' ? '🟨' : '🟥';
      const side = e.side === 'A' ? '←' : '→';
      let text = `${icon} ${e.minute}' ${e.player}`;
      if (e.type === 'goal' && e.assistBy) text += ` <span class="muted">(assist: ${e.assistBy})</span>`;
      return `<div class="report-line">${side} ${text}</div>`;
    }

    function renderButton() {
      newPing.style.display = newResultsPing ? 'block' : 'none';
      if (tournamentStage === 'done' && viewedStep >= historyLength) {
        continueZone.style.display = 'none';
        return;
      }
      continueZone.style.display = 'block';
      if (viewedStep === 0) {
        btnContinue.textContent = '▶ Start Matchday 1';
      } else if (historyLength > viewedStep) {
        btnContinue.textContent = '▶ See Next Results (Ready)';
      } else {
        btnContinue.textContent = '▶ Simulate Next Stage';
      }
    }

    // --- Live 90-minute report: only the viewer's own match plays out on a ticking
    // clock; every other match in the step is already decided, so it's offered as a
    // static "final report" the viewer can switch to via the picker, without spoiling
    // the live pacing of their own game. Skippable. Hands off to the normal, permanent
    // results view (renderStep) when done.
    function playLiveReport(step, forCode, onDone) {
      const myMatchIdx = step.matches.findIndex((m) => m.aCode === forCode || m.bCode === forCode);
      if (myMatchIdx === -1) { onDone(); return; } // no match of mine this round — nothing to watch live

      const myTimeline = (step.matches[myMatchIdx].events || []).slice().sort((a, b) => a.minute - b.minute);
      const myScore = { a: 0, b: 0 };
      let viewIdx = myMatchIdx;
      let clock = 0;
      let cursor = 0;
      let finished = false;

      stepCard.style.display = 'none';
      continueZone.style.display = 'none';
      liveZone.style.display = 'block';

      function finish() {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        liveZone.style.display = 'none';
        stepCard.style.display = 'block';
        continueZone.style.display = 'block';
        onDone();
      }

      function myMatchBody() {
        const m = step.matches[myMatchIdx];
        return `
          <div class="center"><span class="live-clock" id="liveClock">${Math.min(clock, 90)}'</span></div>
          <div class="live-final-score">${nameTag(m.aName, m.aHuman, m.aUsername)} <b id="liveMyScore">${myScore.a} - ${myScore.b}</b> ${nameTag(m.bName, m.bHuman, m.bUsername)}</div>
          <div class="live-feed" id="liveFeed"></div>
        `;
      }

      function otherMatchBody(idx) {
        const m = step.matches[idx];
        const evs = m.events || [];
        return `
          <div class="live-final-score">${nameTag(m.aName, m.aHuman, m.aUsername)} <b>${scoreText(m)}</b> ${nameTag(m.bName, m.bHuman, m.bUsername)}</div>
          <div class="live-feed">${evs.length ? evs.map(eventLine).join('') : '<p class="muted">No notable events.</p>'}</div>
        `;
      }

      function renderFeedUpToNow() {
        const feedEl = liveZone.querySelector('#liveFeed');
        if (!feedEl) return;
        feedEl.innerHTML = '';
        for (let i = cursor - 1; i >= 0; i--) {
          const e = myTimeline[i];
          const icon = e.type === 'goal' ? '⚽' : e.type === 'yellow' ? '🟨' : '🟥';
          const line = document.createElement('div');
          line.className = 'live-feed-line';
          line.innerHTML = `<b>${e.minute}'</b> ${icon} ${e.player}${e.assistBy ? ` <span class="muted">(assist: ${e.assistBy})</span>` : ''}`;
          feedEl.appendChild(line);
        }
      }

      function renderView() {
        const picker = `
          <div class="live-picker-row">
            <span class="muted">Watching:</span>
            <select id="liveMatchSelect">
              ${step.matches.map((m, idx) => `<option value="${idx}" ${idx === viewIdx ? 'selected' : ''}>${m.aName} vs ${m.bName}${idx === myMatchIdx ? ' — Your Match' : ''}</option>`).join('')}
            </select>
          </div>
        `;
        liveZone.innerHTML = `${picker}<div id="liveBody">${viewIdx === myMatchIdx ? myMatchBody() : otherMatchBody(viewIdx)}</div><button class="btn btn-block" id="btnSkipLive" style="margin-top:12px;">⏭ Skip to Full Results</button>`;
        liveZone.querySelector('#liveMatchSelect').addEventListener('change', (e) => {
          viewIdx = Number(e.target.value);
          renderView();
        });
        liveZone.querySelector('#btnSkipLive').addEventListener('click', finish);
        if (viewIdx === myMatchIdx) renderFeedUpToNow();
      }

      renderView();

      const timer = setInterval(() => {
        clock += 2;
        while (cursor < myTimeline.length && myTimeline[cursor].minute <= clock) {
          const e = myTimeline[cursor];
          if (e.type === 'goal') { if (e.side === 'A') myScore.a += 1; else myScore.b += 1; }
          cursor += 1;
        }
        if (viewIdx === myMatchIdx) {
          const clockEl = liveZone.querySelector('#liveClock');
          const scoreEl = liveZone.querySelector('#liveMyScore');
          if (clockEl) clockEl.textContent = Math.min(clock, 90) + "'";
          if (scoreEl) scoreEl.textContent = `${myScore.a} - ${myScore.b}`;
          renderFeedUpToNow();
        }
        if (clock >= 90) finish();
      }, 180);
    }

    // --- One-time reveal of the drafted XI, styled as a real lineup card, shown once
    // right when the tournament begins (before Matchday 1).
    function renderLineupReveal(lineup) {
      stagePill.textContent = 'Your Squad';
      championZone.innerHTML = '';
      continueZone.style.display = 'none';

      const slotDefs = getSlots(lineup.formation);
      const bySlot = {};
      for (const p of lineup.xi) bySlot[p.slotCode] = p;
      const avgOverall = Math.round(lineup.xi.reduce((s, p) => s + p.overall, 0) / lineup.xi.length);
      const chancePct = lineup.championshipChance * 100;
      const chanceText = chancePct >= 0.1 ? `${chancePct.toFixed(1)}%` : '<0.1%';

      stepCard.innerHTML = `
        <h3 class="center">You're representing ${lineup.countryName}!</h3>
        <p class="muted center">${lineup.formation} &middot; OVR ${avgOverall}</p>
        <div id="lineupPitch"></div>
        <div class="lineup-predictions">
          <div class="lineup-prediction-stat">
            <span class="lineup-prediction-value">${chanceText}</span>
            <span class="muted">predicted title chance</span>
          </div>
          ${lineup.predictedTopScorer ? `<div class="lineup-prediction-line">⚽ Predicted top scorer: <b>${lineup.predictedTopScorer}</b></div>` : ''}
          ${lineup.predictedTopAssist ? `<div class="lineup-prediction-line">🎯 Predicted top assists: <b>${lineup.predictedTopAssist}</b></div>` : ''}
        </div>
        <button class="btn btn-primary btn-block" id="btnEnterTournament" style="margin-top:16px;">Enter the World Cup</button>
      `;
      Pitch.render(stepCard.querySelector('#lineupPitch'), slotDefs, (slot) => {
        const p = bySlot[slot.code];
        if (!p) return { text: slot.short, title: slot.label };
        return {
          className: `${roleClass(slot.group)} ${p.isCaptain ? 'captain' : ''}`,
          text: p.isCaptain ? 'C' : slot.short,
          title: `${p.name} (${slot.label}) — OVR ${p.overall}`,
          badge: p.overall,
          nameLabel: p.name.split(' ').slice(-1)[0]
        };
      });
      stepCard.querySelector('#btnEnterTournament').addEventListener('click', () => {
        lineupRevealShown = true;
        renderStep(null);
      });
    }

    function myRecordCardHtml(record) {
      if (!record) return '';
      const half = Math.ceil(record.squad.length / 2);
      const left = record.squad.slice(0, half);
      const right = record.squad.slice(half);
      const playerRow = (p) => `<div class="myteam-player"><span class="myteam-pos ${roleClass(p.pos)}">${p.pos}</span> ${p.name}${p.isCaptain ? ' <b>(C)</b>' : ''}</div>`;
      const avgOvr = Math.round(record.squad.reduce((s, p) => s + p.overall, 0) / record.squad.length);
      return `
        <div class="myteam-card">
          <div class="myteam-header">
            <span>${record.countryName}</span>
            <span class="badge">${record.formation} &middot; OVR ${avgOvr}</span>
          </div>
          <div class="myteam-record">${record.w}-${record.d}-${record.l} W-D-L &middot; ${record.gf}-${record.ga} goals${record.topScorer ? ` &middot; Top scorer: ${record.topScorer} (${record.topGoals})` : ''}</div>
          <div class="myteam-players">
            <div class="myteam-col">${left.map(playerRow).join('')}</div>
            <div class="myteam-col">${right.map(playerRow).join('')}</div>
          </div>
        </div>
      `;
    }

    function renderStep(step) {
      stagePill.textContent = STAGE_LABEL[tournamentStage] || tournamentStage;
      newResultsPing = false;

      if (!step) {
        stepCard.innerHTML = `<p class="muted center">The World Cup draw is complete. Click below to kick off Matchday 1.</p>`;
        championZone.innerHTML = '';
        renderButton();
        return;
      }

      const matchesHtml = step.matches.map((m, idx) => `
        <div class="match-row match-row-clickable" data-idx="${idx}">
          <span class="${m.winnerCode && m.winnerCode === m.aCode ? 'winner' : ''}">${nameTag(m.aName, m.aHuman, m.aUsername)}</span>
          <span>${scoreText(m)} ${m.events && m.events.length ? '📋' : ''}</span>
          <span class="${m.winnerCode && m.winnerCode === m.bCode ? 'winner' : ''}">${nameTag(m.bName, m.bHuman, m.bUsername)}</span>
        </div>
        <div class="match-report hidden" id="report-${idx}">
          ${m.events && m.events.length ? m.events.map(eventLine).join('') : '<p class="muted" style="margin:6px 0;">No notable events.</p>'}
        </div>
      `).join('');

      let groupFinalHtml = '';
      if (step.groupFinal) {
        groupFinalHtml = `
          <h3 style="margin-top:18px;">📋 Final Group Standings</h3>
          <div class="group-grid">
            ${Object.entries(step.groupFinal.groups).map(([label, rows]) => `
              <div>
                <h4>Group ${label}</h4>
                <table class="group-table">
                  <thead><tr><th>Team</th><th>P</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
                  <tbody>
                    ${rows.map((r) => `
                      <tr class="${r.isHuman ? 'human' : ''} ${r.advanced ? '' : 'eliminated'}">
                        <td>${r.name}${r.isHuman ? ` (${r.username})` : ''}${r.advanced ? ' ✅' : ''}</td>
                        <td>${r.played}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `).join('')}
          </div>
        `;
      }

      stepCard.innerHTML = `
        <h3>${step.label}</h3>
        <p class="muted" style="margin-top:-8px;">Tap a match for the report (goals, assists, cards).</p>
        <div class="matchlog" style="max-height:none;">${matchesHtml}</div>
        ${groupFinalHtml}
      `;
      stepCard.querySelectorAll('.match-row-clickable').forEach((row) => {
        row.addEventListener('click', () => {
          const report = stepCard.querySelector(`#report-${row.dataset.idx}`);
          if (report) report.classList.toggle('hidden');
        });
      });

      if (step.champion) {
        championZone.innerHTML = `
          <div class="champion-banner">
            <div class="champion-label">World Cup Champion</div>
            <h2>${step.champion.name}</h2>
            <p class="muted">${step.champion.isHuman ? `Won by ${step.champion.username}` : 'Won by a bot-controlled nation'}</p>
            <div class="row" style="margin-top:16px;justify-content:center;">
              <button class="btn btn-ghost" id="btnBackHome">Back to Dashboard</button>
              ${isCreator ? '<button class="btn btn-ghost" id="btnNewRoom">Start New Room</button>' : ''}
              ${isCreator ? '<button class="btn btn-primary" id="btnRematch">Rematch — Same Players</button>' : ''}
            </div>
          </div>
          ${myRecordCardHtml(step.myRecord)}`;
        championZone.querySelector('#btnBackHome').addEventListener('click', () => App.goDashboard());
        const newRoomBtn = championZone.querySelector('#btnNewRoom');
        if (newRoomBtn) newRoomBtn.addEventListener('click', () => App.goDashboard('create'));
        const rematchBtn = championZone.querySelector('#btnRematch');
        if (rematchBtn) rematchBtn.addEventListener('click', () => {
          rematchBtn.disabled = true;
          rematchBtn.textContent = 'Setting up rematch...';
          socket.emit('room:rematch', { code });
        });
      } else {
        championZone.innerHTML = '';
      }

      renderButton();
    }

    App.onSocket('room:state', (s) => {
      if (s.stage !== 'tournament') return;
      viewedStep = s.viewedStep || 0;
      historyLength = s.historyLength || 0;
      tournamentStage = s.tournamentStage || 'group';
      isCreator = s.creatorId === App.state.user.id;
      if (s.myLineup) myCode = s.myLineup.code;
      if (viewedStep === 0 && s.myLineup && !lineupRevealShown) {
        renderLineupReveal(s.myLineup);
      } else {
        renderStep(s.myStep || null);
      }
    });

    App.onSocket('tournament:step', (payload) => {
      viewedStep = payload.viewedStep;
      historyLength = payload.historyLength;
      tournamentStage = payload.stage;
      if (payload.step && payload.step.matches && payload.step.matches.length && myCode) {
        playLiveReport(payload.step, myCode, () => renderStep(payload.step));
      } else {
        renderStep(payload.step);
      }
    });

    App.onSocket('tournament:newStepAvailable', (payload) => {
      historyLength = Math.max(historyLength, payload.historyLength);
      if (historyLength > viewedStep) {
        newResultsPing = true;
        renderButton();
      }
    });

    App.onSocket('tournament:started', () => {
      viewedStep = 0;
      historyLength = 0;
      tournamentStage = 'group';
      if (!lineupRevealShown) return; // room:state (personalized, with myLineup) will handle the reveal
      renderStep(null);
    });

    App.onSocket('room:rematchReady', ({ newCode }) => {
      App.toast('Rematch room ready — joining now');
      App.goLobby(newCode);
    });

    App.onSocket('error:message', (e) => App.toast(e.error, true));

    btnContinue.addEventListener('click', () => {
      btnContinue.disabled = true;
      socket.emit('tournament:advance', { code });
      setTimeout(() => { btnContinue.disabled = false; }, 400);
    });
  }
};
