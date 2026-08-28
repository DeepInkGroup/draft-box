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
    let advanceReady = null;

    container.innerHTML = `
      <div id="championZone"></div>
      <div class="center"><span class="stage-pill" id="stagePill">...</span></div>
      <div class="card" id="liveZone" style="display:none;"></div>
      <div class="card" id="stepCard"></div>
      <div class="card center" id="continueZone">
        <button class="btn btn-primary" id="btnContinue">▶ Continue</button>
        <p class="muted" id="newPing" style="display:none;margin-top:8px;">🔔 New results are ready</p>
        <div class="advance-ready-panel" id="advanceReadyPanel" style="display:none;"></div>
      </div>
    `;

    const stagePill = container.querySelector('#stagePill');
    const liveZone = container.querySelector('#liveZone');
    const stepCard = container.querySelector('#stepCard');
    const championZone = container.querySelector('#championZone');
    const continueZone = container.querySelector('#continueZone');
    const btnContinue = container.querySelector('#btnContinue');
    const newPing = container.querySelector('#newPing');
    const advanceReadyPanel = container.querySelector('#advanceReadyPanel');

    function scoreText(m) {
      let s = `${m.goalsA} - ${m.goalsB}`;
      if (m.wentToExtraTime) s += ' (AET)';
      if (m.wentToPenalties) s += ` (pens: ${m.penalties.A}-${m.penalties.B})`;
      return s;
    }

    function penaltyShootoutHtml(m) {
      if (!m.wentToPenalties || !m.penaltyKicks) return '';
      const rows = m.penaltyKicks.map((k) => `
        <div class="pen-kick-line ${k.scored ? 'scored' : 'missed'}">
          <span>${k.side === 'A' ? '←' : '→'} ${k.player}</span>
          <span class="pen-kick-result">${k.scored ? 'Scored' : 'Missed'}</span>
        </div>
      `).join('');
      return `
        <div class="pen-shootout">
          <div class="pen-shootout-title">Penalty Shootout — ${m.penalties.A}-${m.penalties.B}</div>
          ${rows}
        </div>
      `;
    }

    // A human-controlled slot is shown as just the player's username — the team name
    // underneath it doesn't add anything once a real person is playing it. Bot-controlled
    // slots still show the nation's name, since there's no username to fall back to.
    function nameTag(name, isHuman, username) {
      return isHuman ? username : name;
    }

    function eventIcon(e) {
      if (e.type === 'goal') return '<span class="event-symbol ball" title="Goal">&#9917;</span>';
      if (e.type === 'yellow') return '<span class="match-card-icon yellow" title="Yellow card"></span>';
      if (e.type === 'red') return '<span class="match-card-icon red" title="Red card"></span>';
      if (e.type === 'star') return '<span class="event-symbol star" title="Star moment">&#9733;</span>';
      if (e.type === 'chance') return '<span class="event-symbol chance" title="Big chance">!</span>';
      if (e.type === 'woodwork') return '<span class="event-symbol post" title="Woodwork">POST</span>';
      if (e.type === 'pressure') return '<span class="event-symbol pressure" title="Pressure">PRESS</span>';
      return '<span class="match-card-icon red" title="Red card"></span>';
    }

    function eventTone(e) {
      return ['star', 'chance', 'woodwork', 'pressure'].includes(e.type) ? e.type : '';
    }

    function eventLine(e) {
      const icon = eventIcon(e);
      let text = `${icon} ${e.minute}' ${e.player}`;
      if (e.type === 'goal' && e.assistBy) text += ` <span class="muted">(assist: ${e.assistBy})</span>`;
      if (e.type === 'star' && e.effect) text += ` <span class="muted">(${e.effect}, +${e.boost} xG)</span>`;
      if (['chance', 'woodwork', 'pressure'].includes(e.type) && e.effect) text += ` <span class="muted">(${e.effect})</span>`;
      if (e.type === 'red') text += e.reason === 'second-yellow' ? ` <span class="muted">(2nd yellow)</span>` : ` <span class="muted">(straight red)</span>`;
      return `<div class="report-line ${eventTone(e)}">${text}</div>`;
    }

    function teamEventsHtml(m) {
      const visibleEvents = (m.events || []).filter((e) => e.type !== 'save');
      const bySide = {
        A: visibleEvents.filter((e) => e.side === 'A'),
        B: visibleEvents.filter((e) => e.side === 'B')
      };
      const column = (side, teamName) => `
        <div class="team-event-col">
          <div class="team-event-title">${teamName}</div>
          <div class="team-event-list">
            ${bySide[side].length ? bySide[side].map(eventLine).join('') : '<p class="muted">No notable events.</p>'}
          </div>
        </div>
      `;
      if (!visibleEvents.length) return '<p class="muted" style="margin:6px 0;">No notable events.</p>';
      return `<div class="team-events-grid">${column('A', nameTag(m.aName, m.aHuman, m.aUsername))}${column('B', nameTag(m.bName, m.bHuman, m.bUsername))}</div>`;
    }

    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

    // Final, already-decided stats for a match — used for every static ("final report")
    // display, where there's no clock to animate against.
    function finalMatchStats(m) {
      if (!m.stats) return null;
      return { A: m.stats.A, B: m.stats.B, xgA: m.xgA, xgB: m.xgB };
    }

    function statProgressFraction(m, side, clock, matchLenMinutes, statKey) {
      const final = m.stats && m.stats[side] ? Number(m.stats[side][statKey] || 0) : 0;
      if (!final) return 0;
      const base = clamp(clock / matchLenMinutes, 0, 1);
      if (base >= 0.995) return 1;
      const sideBias = side === 'A' ? 0.31 : 0.57;
      const wave = Math.sin((base * Math.PI * 2.6) + sideBias) * 0.055 + Math.sin((base * Math.PI * 5.1) + sideBias * 2) * 0.025;
      const tacticalTempo = ((m.tactical && m.tactical[side] && m.tactical[side].mods && m.tactical[side].mods.tempo) || 1) - 1;
      const urgency = tacticalTempo * 0.075 * (1 - base);
      const curve = statKey === 'passes' ? Math.pow(base, 0.9) : Math.pow(base, 1.04) + wave + urgency;
      return clamp(curve, 0, 1);
    }

    function liveXgForSide(m, side, clock, matchLenMinutes, timeline) {
      const finalXg = side === 'A' ? Number(m.xgA || 0) : Number(m.xgB || 0);
      const baseFrac = clamp(clock / matchLenMinutes, 0, 1);
      if (baseFrac >= 0.995) return finalXg;
      const base = finalXg * Math.pow(baseFrac, 1.08) * 0.58;
      const eventXg = timeline.filter((e) => e.side === side && e.minute <= clock).reduce((sum, e) => {
        if (e.type === 'goal') return sum + 0.3;
        if (e.type === 'star') return sum + Number(e.boost || 0.12);
        if (e.type === 'chance') return sum + 0.22;
        if (e.type === 'woodwork') return sum + 0.16;
        if (e.type === 'pressure') return sum + 0.08;
        return sum;
      }, 0);
      const lateCatchup = finalXg * Math.pow(baseFrac, 2.25) * 0.2;
      return clamp(Math.min(finalXg, base + eventXg + lateCatchup), 0, finalXg);
    }

    // Builds live stats with tempo waves and event-driven xG jumps, so shots/xG do not
    // rise in a perfectly straight line while the match clock runs.
    function liveStatsAtClock(m, clock, possessionJitter, matchLenMinutes, cardCounts) {
      if (!m.stats) return null;
      const frac = clamp(clock / matchLenMinutes, 0, 1);
      const decay = 1 - frac;
      const possA = Math.round(clamp(m.stats.A.possession + possessionJitter * decay, 20, 80));
      const possB = 100 - possA;
      const timeline = (m.events || []).filter((e) => e.type !== 'save');
      const eventShots = (sideKey) => timeline.filter((e) => e.side === sideKey && e.minute <= clock && ['goal', 'chance', 'woodwork'].includes(e.type)).length;
      const eventSot = (sideKey) => timeline.filter((e) => e.side === sideKey && e.minute <= clock && e.type === 'goal').length;
      const scale = (n, sideKey, statKey) => Math.round(n * statProgressFraction(m, sideKey, clock, matchLenMinutes, statKey));
      const side = (s, sideKey) => ({
        possession: sideKey === 'A' ? possA : possB,
        passAccuracy: s.passAccuracy,
        passes: scale(s.passes, sideKey, 'passes'),
        shots: Math.max(eventShots(sideKey), scale(s.shots, sideKey, 'shots')),
        shotsOnTarget: Math.max(eventSot(sideKey), scale(s.shotsOnTarget, sideKey, 'shotsOnTarget')),
        corners: scale(s.corners, sideKey, 'corners'),
        fouls: scale(s.fouls, sideKey, 'fouls'),
        yellowCards: cardCounts ? cardCounts.A_yellow : 0,
        redCards: cardCounts ? cardCounts.A_red : 0,
        saves: scale(s.saves, sideKey, 'saves')
      });
      return {
        A: side(m.stats.A, 'A'),
        B: { ...side(m.stats.B, 'B'), yellowCards: cardCounts ? cardCounts.B_yellow : 0, redCards: cardCounts ? cardCounts.B_red : 0 },
        xgA: liveXgForSide(m, 'A', clock, matchLenMinutes, timeline),
        xgB: liveXgForSide(m, 'B', clock, matchLenMinutes, timeline)
      };
    }

    function matchStatsHtml(stats) {
      if (!stats) return '';
      const row = (label, a, b) => `
        <div class="stat-row">
          <span class="stat-val">${a}</span>
          <span class="stat-label">${label}</span>
          <span class="stat-val">${b}</span>
        </div>
      `;
      const cardsText = (s) => {
        const parts = [];
        if (s.yellowCards) parts.push(`<span class="card-stat">${s.yellowCards}<span class="match-card-icon yellow small"></span></span>`);
        if (s.redCards) parts.push(`<span class="card-stat">${s.redCards}<span class="match-card-icon red small"></span></span>`);
        return parts.length ? parts.join(' ') : '-';
      };
      return `
        <div class="match-stats">
          ${row('Possession', `${stats.A.possession}%`, `${stats.B.possession}%`)}
          ${row('Shots (on target)', `${stats.A.shots} (${stats.A.shotsOnTarget})`, `${stats.B.shots} (${stats.B.shotsOnTarget})`)}
          ${row('Passes (acc.)', `${stats.A.passes} (${stats.A.passAccuracy}%)`, `${stats.B.passes} (${stats.B.passAccuracy}%)`)}
          ${row('Corners', stats.A.corners, stats.B.corners)}
          ${row('Fouls', stats.A.fouls, stats.B.fouls)}
          ${row('Cards', cardsText(stats.A), cardsText(stats.B))}
          ${row('Saves', stats.A.saves, stats.B.saves)}
          ${row('xG', stats.xgA.toFixed(2), stats.xgB.toFixed(2))}
        </div>
      `;
    }

    function renderAdvanceReady() {
      if (!advanceReady || !advanceReady.spoilerMode || tournamentStage === 'done') {
        advanceReadyPanel.style.display = 'none';
        advanceReadyPanel.innerHTML = '';
        return;
      }
      const members = advanceReady.members || [];
      const readyCount = members.filter((m) => m.ready).length;
      advanceReadyPanel.style.display = 'block';
      advanceReadyPanel.innerHTML = [
        '<div class="advance-ready-head"><span>Ready for next stage</span><span class="muted">' + readyCount + '/' + members.length + '</span></div>',
        '<div class="advance-ready-list">',
        members.map((m) => '<div class="advance-ready-row ' + (m.ready ? 'ready' : '') + '"><span class="advance-ready-check">' + (m.ready ? '✓' : '') + '</span><span class="advance-ready-name">' + m.username + '</span>' + (m.eliminated ? '<span class="advance-ready-badge">Out</span>' : '') + '</div>').join(''),
        '</div>'
      ].join('');
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
        const me = advanceReady && (advanceReady.members || []).find((m) => m.userId === App.state.user.id);
        btnContinue.textContent = me && me.ready ? '✓ Ready - waiting for players' : '✓ Ready for Next Stage';
      }
      renderAdvanceReady();
    }

    function countCardsSoFar(timeline, cursor) {
      const counts = { A_yellow: 0, A_red: 0, B_yellow: 0, B_red: 0 };
      for (let i = 0; i < cursor; i++) {
        const e = timeline[i];
        if (e.type === 'yellow') counts[`${e.side}_yellow`] += 1;
        else if (e.type === 'red') counts[`${e.side}_red`] += 1;
      }
      return counts;
    }

    // --- Live match report: only the viewer's own match plays out on a ticking clock
    // (through extra time and, if needed, a kick-by-kick penalty shootout — never an
    // instant jump to a final penalty score); every other match in the step is already
    // decided, offered as a static "final report" via the picker. Skippable. Hands off
    // to the normal, permanent results view (renderStep) when done.
    function playLiveReport(step, forCode, onDone) {
      const myMatchIdx = step.matches.findIndex((m) => m.aCode === forCode || m.bCode === forCode);
      if (myMatchIdx === -1) { onDone(); return; } // no match of mine this round — nothing to watch live

      const m = step.matches[myMatchIdx];
      const matchLenMinutes = m.wentToExtraTime ? 120 : 90;
      const myTimeline = (m.events || []).filter((e) => e.type !== 'save').slice().sort((a, b) => a.minute - b.minute);
      const myScore = { a: 0, b: 0 };
      let viewIdx = myMatchIdx;
      let clock = 0;
      let cursor = 0;
      let finished = false;
      let penaltyPhase = false;
      let penIdx = 0;
      const penScore = { a: 0, b: 0 };
      const possessionJitter = (Math.random() - 0.5) * 20; // settles to 0 by full time

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
        const clockLabel = penaltyPhase ? 'PENS' : `${Math.min(clock, matchLenMinutes)}'${clock > 90 ? ' ET' : ''}`;
        return `
          <div class="center"><span class="live-clock" id="liveClock">${clockLabel}</span></div>
          <div class="live-final-score">${nameTag(m.aName, m.aHuman, m.aUsername)} <b id="liveMyScore">${myScore.a} - ${myScore.b}</b> ${nameTag(m.bName, m.bHuman, m.bUsername)}</div>
          ${m.wentToPenalties ? `<div class="center muted" id="livePenScore" style="${penaltyPhase ? '' : 'display:none;'}margin-bottom:10px;">Penalties: <b>${penScore.a} - ${penScore.b}</b></div>` : ''}
          <div id="liveStatsZone" style="${penaltyPhase ? 'display:none;' : ''}">${matchStatsHtml(liveStatsAtClock(m, clock, possessionJitter, matchLenMinutes, countCardsSoFar(myTimeline, cursor)))}</div>
          <div class="live-feed" id="liveFeed"></div>
        `;
      }

      function otherMatchBody(idx) {
        const om = step.matches[idx];
        return `
          <div class="live-final-score">${nameTag(om.aName, om.aHuman, om.aUsername)} <b>${scoreText(om)}</b> ${nameTag(om.bName, om.bHuman, om.bUsername)}</div>
          ${matchStatsHtml(finalMatchStats(om))}
          ${penaltyShootoutHtml(om)}
          ${teamEventsHtml(om)}
        `;
      }

      function renderFeedUpToNow() {
        const feedEl = liveZone.querySelector('#liveFeed');
        if (!feedEl) return;
        feedEl.innerHTML = '';
        for (let i = cursor - 1; i >= 0; i--) {
          const e = myTimeline[i];
          const icon = eventIcon(e);
          const line = document.createElement('div');
          line.className = `live-feed-line ${eventTone(e)}`;
          line.innerHTML = `<b>${e.minute}'</b> ${icon} ${e.player}${e.assistBy ? ` <span class="muted">(assist: ${e.assistBy})</span>` : ''}${e.effect ? ` <span class="muted">(${e.effect})</span>` : ''}`;
          feedEl.appendChild(line);
        }
      }

      function renderPenaltyFeed() {
        const feedEl = liveZone.querySelector('#liveFeed');
        if (!feedEl) return;
        feedEl.innerHTML = '';
        for (let i = penIdx - 1; i >= 0; i--) {
          const k = m.penaltyKicks[i];
          const line = document.createElement('div');
          line.className = 'live-feed-line';
          line.innerHTML = `${k.side === 'A' ? '←' : '→'} ${k.scored ? '⚽' : '❌'} ${k.player} <span class="muted">${k.scored ? 'scored' : 'missed'}</span>`;
          feedEl.appendChild(line);
        }
      }

      function renderView() {
        const picker = `
          <div class="live-picker-row">
            <span class="muted">Watching:</span>
            <select id="liveMatchSelect">
              ${step.matches.map((sm, idx) => `<option value="${idx}" ${idx === viewIdx ? 'selected' : ''}>${sm.aName} vs ${sm.bName}${idx === myMatchIdx ? ' — Your Match' : ''}</option>`).join('')}
            </select>
          </div>
        `;
        liveZone.innerHTML = `${picker}<div id="liveBody">${viewIdx === myMatchIdx ? myMatchBody() : otherMatchBody(viewIdx)}</div><button class="btn btn-block" id="btnSkipLive" style="margin-top:12px;">⏭ Skip to Full Results</button>`;
        liveZone.querySelector('#liveMatchSelect').addEventListener('change', (e) => {
          viewIdx = Number(e.target.value);
          renderView();
        });
        liveZone.querySelector('#btnSkipLive').addEventListener('click', finish);
        if (viewIdx === myMatchIdx) { if (penaltyPhase) renderPenaltyFeed(); else renderFeedUpToNow(); }
      }

      renderView();

      function startPenaltyPhase() {
        penaltyPhase = true;
        clearInterval(timer);
        if (viewIdx === myMatchIdx) renderView();
        penaltyTimer = setInterval(() => {
          if (penIdx >= m.penaltyKicks.length) { clearInterval(penaltyTimer); finish(); return; }
          const k = m.penaltyKicks[penIdx];
          if (k.scored) { if (k.side === 'A') penScore.a += 1; else penScore.b += 1; }
          penIdx += 1;
          if (viewIdx === myMatchIdx) {
            const scoreEl = liveZone.querySelector('#livePenScore b');
            if (scoreEl) scoreEl.textContent = `${penScore.a} - ${penScore.b}`;
            renderPenaltyFeed();
          }
          if (penIdx >= m.penaltyKicks.length) { clearInterval(penaltyTimer); finish(); }
        }, 650);
      }

      let penaltyTimer = null;
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
          const statsEl = liveZone.querySelector('#liveStatsZone');
          if (clockEl) clockEl.textContent = `${Math.min(clock, matchLenMinutes)}'${clock > 90 ? ' ET' : ''}`;
          if (scoreEl) scoreEl.textContent = `${myScore.a} - ${myScore.b}`;
          if (statsEl) statsEl.innerHTML = matchStatsHtml(liveStatsAtClock(m, clock, possessionJitter, matchLenMinutes, countCardsSoFar(myTimeline, cursor)));
          renderFeedUpToNow();
        }
        if (clock >= matchLenMinutes) {
          if (m.wentToPenalties) startPenaltyPhase();
          else finish();
        }
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
      const prediction = lineup.prediction || {};
      const predictionIdeas = Array.isArray(prediction.ideas) ? prediction.ideas : [];
      const predictionCards = [
        ['Engine power', prediction.enginePower || '-'],
        ['Average OVR', prediction.avgOverall || avgOverall],
        ['Chemistry', prediction.chemistryPct != null ? `${prediction.chemistryPct}%` : '-'],
        ['Star threat', prediction.starThreatPct != null ? `${prediction.starThreatPct}%` : '-'],
        ['Tactical style', prediction.tacticalStyleLabel || 'Balanced'],
        ['Risk profile', prediction.riskLabel || 'Controlled']
      ];

      stepCard.innerHTML = `
        <h3 class="center">You're representing ${lineup.countryName}!</h3>
        <p class="muted center">${lineup.formation} &middot; OVR ${avgOverall}</p>
        <div id="lineupPitch"></div>
        <div class="lineup-predictions">
          <div class="lineup-prediction-stat wide">
            <span class="lineup-prediction-value">${chanceText}</span>
            <span class="muted">predicted title chance</span>
          </div>
          ${predictionCards.map(([label, value]) => `<div class="lineup-prediction-card"><span>${label}</span><b>${value}</b></div>`).join('')}
          <div class="lineup-prediction-card wide trio">
            ${prediction.topScorer ? `<div><span>Goal focus</span><b>${prediction.topScorer}</b></div>` : ''}
            ${prediction.topAssist ? `<div><span>Creator focus</span><b>${prediction.topAssist}</b></div>` : ''}
            ${prediction.pressurePlayer ? `<div><span>Pressure player</span><b>${prediction.pressurePlayer}</b></div>` : ''}
          </div>
          ${predictionIdeas.length ? `<div class="lineup-prediction-ideas wide">${predictionIdeas.map((idea) => `<span>${idea}</span>`).join('')}</div>` : ''}
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
      const POS_ORDER = { FW: 0, MF: 1, DF: 2, GK: 3 };
      const orderedSquad = record.squad.slice().sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos]);
      const half = Math.ceil(orderedSquad.length / 2);
      const left = orderedSquad.slice(0, half);
      const right = orderedSquad.slice(half);
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

    function tournamentSummaryLine(summary) {
      if (!summary || !summary.totalMatches) return '';
      let line = `${summary.totalMatches} matches played, ${summary.totalGoals} goals scored (${summary.avgGoalsPerMatch} per match)`;
      if (summary.biggest && summary.biggest.margin > 0) {
        const b = summary.biggest;
        const winnerFirst = b.goalsA >= b.goalsB;
        line += ` — biggest result: ${winnerFirst ? b.aName : b.bName} ${Math.max(b.goalsA, b.goalsB)}-${Math.min(b.goalsA, b.goalsB)} ${winnerFirst ? b.bName : b.aName}`;
      }
      return `<p class="muted tournament-summary-line">${line}</p>`;
    }

    function awardTeamLabel(entry) {
      if (!entry) return '';
      const teamDisplay = entry.isHuman && entry.username ? entry.username : (entry.teamName || entry.teamCode || '');
      if (!teamDisplay) return '';
      return ` <span class="muted" style="font-size:0.78em;font-weight:500;opacity:0.8;">(${teamDisplay})</span>`;
    }

    function tournamentAwardsHtml(awards, summary) {
      if (!awards) return '';
      const detailText = (entry, unit) => entry ? `${entry.count} ${unit}` : '';
      const potm = awards.playerOfTournament;
      const potmDetail = potm ? [
        potm.goals ? `${potm.goals} goal${potm.goals === 1 ? '' : 's'}` : null,
        potm.assists ? `${potm.assists} assist${potm.assists === 1 ? '' : 's'}` : null,
        potm.saves ? `${potm.saves} save${potm.saves === 1 ? '' : 's'}` : null,
        potm.isChampion ? 'champion bonus' : null
      ].filter(Boolean).join(' · ') : '';
      const card = (label, entry, detail, tone = '') => entry ? `
        <article class="award-card ${tone}">
          <span class="award-kicker">${label}</span>
          <b>${entry.player}</b>
          <span class="award-meta">${awardTeamLabel(entry)}</span>
          <span class="award-pill">${detail}</span>
        </article>
      ` : '';
      const pulse = [];
      if (summary && summary.totalMatches) {
        pulse.push(['Matches', summary.totalMatches]);
        pulse.push(['Goals', summary.totalGoals]);
        pulse.push(['Avg Goals', summary.avgGoalsPerMatch]);
        if (summary.biggest && summary.biggest.margin > 0) {
          const b = summary.biggest;
          const winnerFirst = b.goalsA >= b.goalsB;
          pulse.push(['Biggest Win', `${winnerFirst ? b.aName : b.bName} ${Math.max(b.goalsA, b.goalsB)}-${Math.min(b.goalsA, b.goalsB)}`]);
        }
      }
      const body = [
        card('Golden Ball', potm, potmDetail || `${potm ? potm.score : ''} engine score`, 'primary'),
        card('Golden Boot', awards.topScorer, detailText(awards.topScorer, 'goals')),
        card('Creator Award', awards.topAssist, detailText(awards.topAssist, 'assists')),
        card('Golden Glove', awards.mostSaves, detailText(awards.mostSaves, 'saves')),
        card('Knockout Hero', awards.knockoutHero, detailText(awards.knockoutHero, 'KO goals')),
        card('Heat Check', awards.mostBooked, detailText(awards.mostBooked, 'card pts'))
      ].join('');
      if (!body.trim() && !pulse.length) return '';
      return `
        <div class="myteam-card awards-card">
          <div class="myteam-header"><span>Tournament Awards</span><span class="badge">Engine recap</span></div>
          ${pulse.length ? `<div class="award-pulse-grid">${pulse.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>` : ''}
          <div class="awards-grid">${body}</div>
        </div>
      `;
    }

    function bracketScoreHtml(m) {
      if (!m.result) return '<span class="bracket-node-score">TBD</span>';
      const extras = [
        m.result.wentToExtraTime ? 'AET' : null,
        m.result.wentToPenalties && m.result.penalties ? `pens ${m.result.penalties.A}-${m.result.penalties.B}` : null
      ].filter(Boolean).join(' · ');
      return `<span class="bracket-node-score">${scoreText(m.result)}</span>${extras ? `<span class="bracket-node-extra">${extras}</span>` : ''}`;
    }

    function bracketNodeHtml(m, isTerminal) {
      const aWin = m.winnerCode && m.winnerCode === m.aCode;
      const bWin = m.winnerCode && m.winnerCode === m.bCode;
      return `
        <article class="bracket-node ${isTerminal ? 'terminal' : ''}">
          <div class="bracket-node-team ${aWin ? 'winner' : ''}"><span>${nameTag(m.aName, m.aHuman, m.aUsername)}</span><b>${m.result ? m.result.goalsA : '-'}</b></div>
          <div class="bracket-node-mid">${bracketScoreHtml(m)}</div>
          <div class="bracket-node-team ${bWin ? 'winner' : ''}"><span>${nameTag(m.bName, m.bHuman, m.bUsername)}</span><b>${m.result ? m.result.goalsB : '-'}</b></div>
        </article>
      `;
    }

    function completedBracketHtml(rounds) {
      if (!rounds || !rounds.length) return '';
      const finalRound = rounds[rounds.length - 1];
      const sideRounds = rounds.slice(0, -1).map((round) => {
        const splitAt = Math.ceil(round.matches.length / 2);
        return {
          round,
          leftMatches: round.matches.slice(0, splitAt),
          rightMatches: round.matches.slice(splitAt)
        };
      });
      const isSplitBracket = rounds.length >= 5;
      const roundSection = (round, matches, idx, sideClass = '', isTerminal = false) => `
        <section class="bracket-chart-round ${sideClass} stage-${round.stage || idx}">
          <h4>${round.label}</h4>
          <div class="bracket-stack">
            ${matches.map((m) => bracketNodeHtml(m, isTerminal)).join('')}
          </div>
        </section>
      `;
      return `
        <div class="myteam-card bracket-recap-card">
          <div class="myteam-header">
            <span>Knockout Bracket Chart</span>
            <button class="btn btn-ghost btn-sm" id="btnToggleBracket">Show Full Bracket</button>
          </div>
          <div class="bracket-recap hidden" id="bracketRecap">
            <div class="bracket-chart ${isSplitBracket ? 'split' : 'compact'}" style="--side-round-count:${sideRounds.length};--round-count:${rounds.length};">
              ${isSplitBracket ? `
                <div class="bracket-wing bracket-wing-left">
                  ${sideRounds.map((x, idx) => roundSection(x.round, x.leftMatches, idx, 'side-left')).join('')}
                </div>
                <section class="bracket-chart-round bracket-final-center stage-${finalRound.stage || 'final'}">
                  <h4>${finalRound.label}</h4>
                  <div class="bracket-stack">
                    ${finalRound.matches.map((m) => bracketNodeHtml(m, true)).join('')}
                  </div>
                </section>
                <div class="bracket-wing bracket-wing-right">
                  ${sideRounds.map((x, idx) => roundSection(x.round, x.rightMatches, idx, 'side-right')).join('')}
                </div>
              ` : rounds.map((round, idx) => roundSection(round, round.matches, idx, idx === rounds.length - 1 ? 'terminal-round' : '', idx === rounds.length - 1)).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function matchAnalysisRecapHtml(analyses) {
      if (!analyses || !analyses.length) return '';
      const outcomeLabel = { w: 'Win', d: 'Draw', l: 'Loss' };
      const toneIcon = { good: '+', bad: '-', neutral: '=' };
      const analysisData = (m) => typeof m.analysis === 'string' ? { summary: m.analysis, verdict: '', metrics: [], factors: [] } : (m.analysis || { summary: '', verdict: '', metrics: [], factors: [] });
      const metricGrid = (metrics) => metrics && metrics.length ? `<div class="engine-metric-grid">${metrics.map((x) => `
        <div class="engine-metric"><span>${x.label}</span><b>${x.mine}</b><em>${x.opponent}</em></div>
      `).join('')}</div>` : '';
      const factorList = (factors) => factors && factors.length ? `<div class="engine-factor-list">${factors.slice(0, 6).map((f) => `
        <div class="engine-factor ${f.tone || 'neutral'}"><span>${toneIcon[f.tone] || '='}</span><div><b>${f.label}: ${f.value}</b><small>${f.detail}</small></div></div>
      `).join('')}</div>` : '';
      return `
        <div class="myteam-card engine-recap-card">
          <div class="myteam-header">
            <span>Engine Match Review</span>
            <span class="badge">Data model</span>
          </div>
          <p class="muted tournament-summary-line">A richer post-match model built from xG, player quality, chemistry, tactical style, star moments, shot pressure, possession, saves, cards, extra time and penalties.</p>
          <div class="engine-recap-list">
            ${analyses.map((m) => {
              const data = analysisData(m);
              return `
              <article class="engine-recap-match ${m.outcome === 'w' ? 'win' : m.outcome === 'l' ? 'loss' : 'draw'}">
                <div class="engine-recap-topline">
                  <span class="history-outcome ${m.outcome === 'w' ? 'win' : m.outcome === 'l' ? 'loss' : 'draw'}">${m.outcome.toUpperCase()}</span>
                  <div class="engine-recap-meta">
                    <b>${m.label} vs ${m.opponentName}</b>
                    <span>${outcomeLabel[m.outcome] || 'Result'} &middot; ${m.score}</span>
                  </div>
                </div>
                ${metricGrid(data.metrics)}
                ${factorList(data.factors)}
                <p>${data.summary || ''}</p>
                ${data.verdict ? `<div class="engine-verdict">${data.verdict}</div>` : ''}
              </article>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    function renderStep(step) {
      if (tournamentStage === 'done') {
        stagePill.parentElement.style.display = 'none';
      } else {
        stagePill.parentElement.style.display = '';
        stagePill.textContent = STAGE_LABEL[tournamentStage] || tournamentStage;
      }
      newResultsPing = false;

      if (!step) {
        stepCard.innerHTML = `<p class="muted center">The World Cup draw is complete. Click below to kick off Matchday 1.</p>`;
        championZone.innerHTML = '';
        renderButton();
        return;
      }

      const chevronIcon = '<svg class="match-expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

      const matchesHtml = step.matches.map((m, idx) => {
        const aWin = m.winnerCode && m.winnerCode === m.aCode;
        const bWin = m.winnerCode && m.winnerCode === m.bCode;
        return `
        <div class="match-row match-row-clickable" data-idx="${idx}">
          <div class="match-team ${aWin ? 'winner' : ''}"><span class="match-team-name">${nameTag(m.aName, m.aHuman, m.aUsername)}</span></div>
          <div class="match-score-box">
            <span class="match-score-val">${m.goalsA} - ${m.goalsB}</span>
            ${m.wentToExtraTime ? `<span class="match-score-pens">AET</span>` : ''}
            ${m.wentToPenalties ? `<span class="match-score-pens">pens ${m.penalties.A}-${m.penalties.B}</span>` : ''}
          </div>
          <div class="match-team side-b ${bWin ? 'winner' : ''}"><span class="match-team-name">${nameTag(m.bName, m.bHuman, m.bUsername)}</span></div>
          ${chevronIcon}
        </div>
        <div class="match-report hidden" id="report-${idx}">
          ${matchStatsHtml(finalMatchStats(m))}
          ${penaltyShootoutHtml(m)}
          ${teamEventsHtml(m)}
        </div>
      `;
      }).join('');

      let groupFinalHtml = '';
      if (step.groupFinal) {
        groupFinalHtml = `
          <h3 style="margin-top:18px;">Final Group Standings</h3>
          <div class="group-grid">
            ${Object.entries(step.groupFinal.groups).map(([label, rows]) => `
              <div>
                <h4>Group ${label}</h4>
                <table class="group-table">
                  <thead><tr><th>Team</th><th>P</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
                  <tbody>
                    ${rows.map((r) => `
                      <tr class="${r.isHuman ? 'human' : ''} ${r.advanced ? '' : 'eliminated'}">
                        <td>${r.isHuman ? r.username : r.name}</td>
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
        <p class="muted" style="margin-top:-8px;">Tap a match for the full report — stats, goals, assists, cards.</p>
        <div class="matchlog" style="max-height:none;">${matchesHtml}</div>
        ${groupFinalHtml}
      `;
      stepCard.querySelectorAll('.match-row-clickable').forEach((row) => {
        row.addEventListener('click', () => {
          const report = stepCard.querySelector(`#report-${row.dataset.idx}`);
          if (report) report.classList.toggle('hidden');
          row.classList.toggle('expanded');
        });
      });

      if (step.champion) {
        const championTitle = step.champion.isHuman ? step.champion.username : step.champion.name;
        const championSub = step.champion.isHuman ? step.champion.name : 'Bot-controlled nation';
        championZone.innerHTML = `
          <div class="champion-banner">
            <div class="champion-label">World Cup Champion</div>
            <h2>${championTitle}</h2>
            <p class="champion-team-name">${championSub}</p>
            <div class="row" style="margin-top:16px;justify-content:center;">
              <button class="btn btn-ghost" id="btnBackHome">Back to Dashboard</button>
              <button class="btn btn-ghost" id="btnViewHistoryFromChampion">My Match History</button>
              ${isCreator ? '<button class="btn btn-ghost" id="btnNewRoom">Start New Room</button>' : ''}
              ${isCreator ? '<button class="btn btn-primary" id="btnRematch">Rematch — Same Players</button>' : ''}
            </div>
          </div>
          ${myRecordCardHtml(step.myRecord)}
          ${matchAnalysisRecapHtml(step.myMatchAnalyses)}
          ${completedBracketHtml(step.completedBracket)}
          ${tournamentAwardsHtml(step.tournamentAwards, step.tournamentSummary)}`;
        championZone.querySelector('#btnBackHome').addEventListener('click', () => App.goDashboard());
        championZone.querySelector('#btnViewHistoryFromChampion').addEventListener('click', () => App.goMatchHistory());
        const bracketBtn = championZone.querySelector('#btnToggleBracket');
        const bracketRecap = championZone.querySelector('#bracketRecap');
        if (bracketBtn && bracketRecap) {
          bracketBtn.addEventListener('click', () => {
            bracketRecap.classList.toggle('hidden');
            bracketBtn.textContent = bracketRecap.classList.contains('hidden') ? 'Show Full Bracket' : 'Hide Full Bracket';
          });
        }
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
      advanceReady = s.advanceReady || null;
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

    App.onSocket('tournament:advanceReady', (payload) => {
      advanceReady = payload;
      renderButton();
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
