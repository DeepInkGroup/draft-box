const DraftView = {
  async render(container, code) {
    container.innerHTML = `<div class="card center muted">در حال اتصال به درفت...</div>`;

    const socket = App.ensureSocket();
    socket.emit('room:join', { code });

    container.innerHTML = `
      <div class="slots-bar" id="slotsBar"></div>
      <div class="card" id="revealCard">
        <p class="muted center">در حال دریافت اولین تیم تصادفی...</p>
      </div>
      <div class="card">
        <div class="row" style="align-items:center;">
          <h3 style="margin:0;">👤 تیم من</h3>
          <span class="muted" style="text-align:left;">استخر باقی‌مانده: <b id="poolCount">-</b> بازیکن</span>
        </div>
        <ul class="squad-list" id="squadList"></ul>
      </div>
      <p class="muted center" id="waitingMsg" style="display:none;">✅ درفت تو تمام شد! منتظر بقیه بازیکنان برای شروع جام جهانی...</p>
    `;

    const slotsBar = container.querySelector('#slotsBar');
    const revealCard = container.querySelector('#revealCard');
    const squadList = container.querySelector('#squadList');
    const poolCount = container.querySelector('#poolCount');
    const waitingMsg = container.querySelector('#waitingMsg');

    function renderSlots(filled, remaining) {
      const groups = ['GK', 'DF', 'MF', 'FW'];
      slotsBar.innerHTML = groups.map((g) => {
        const total = (filled[g] || 0) + (remaining[g] || 0);
        const full = (remaining[g] || 0) === 0;
        return `<div class="slot-pill ${full ? 'full' : ''}">${POS_LABEL[g]}<br>${filled[g] || 0}/${total}</div>`;
      }).join('');
    }

    function renderSquad(squad) {
      squadList.innerHTML = squad.map((p) => `
        <li><b>${p.name}</b><br><span class="muted">${POS_LABEL[p.pos]} · ${p.team} · OVR ${p.overall}</span></li>
      `).join('') || '<li class="muted">هنوز بازیکنی انتخاب نکردی</li>';
    }

    function renderReveal(payload) {
      if (payload.done) {
        revealCard.innerHTML = '';
        waitingMsg.style.display = 'block';
        return;
      }
      if (payload.exhausted) {
        revealCard.innerHTML = '<p class="error-text center">بازیکن مناسبی برای پست‌های باقی‌مانده پیدا نشد. لطفاً صفحه را رفرش کن.</p>';
        return;
      }
      revealCard.innerHTML = `
        <div class="reveal-team">${payload.team.name}</div>
        <div class="reveal-sub">یک بازیکن از این تیم برای اسکواد خودت انتخاب کن</div>
        <div class="player-grid" id="playerGrid"></div>
        <button class="btn btn-block" id="btnSkip">🔄 رد کردن و نمایش تیم بعدی</button>
      `;
      const grid = revealCard.querySelector('#playerGrid');
      grid.innerHTML = payload.players
        .slice()
        .sort((a, b) => b.overall - a.overall)
        .map((p) => `
          <div class="player-card ${p.available ? '' : 'unavailable'}" data-id="${p.id}">
            <div class="pname">${p.isStar ? '<span class="star">★</span> ' : ''}${p.name}</div>
            <div class="pmeta"><span>${POS_LABEL[p.pos]}</span><span class="overall">${p.overall}</span></div>
          </div>
        `).join('');

      grid.querySelectorAll('.player-card').forEach((card) => {
        card.addEventListener('click', () => {
          if (card.classList.contains('unavailable')) return;
          socket.emit('draft:pick', { code, playerId: card.dataset.id });
        });
      });

      revealCard.querySelector('#btnSkip').addEventListener('click', () => {
        socket.emit('draft:reveal', { code });
      });
    }

    App.onSocket('room:state', (s) => {
      if (s.myDraft) {
        renderSlots(s.myDraft.filled, s.myDraft.remaining);
        renderSquad(s.myDraft.squad);
        poolCount.textContent = s.poolRemaining ?? '-';
        if (!s.myDraft.draftComplete) socket.emit('draft:reveal', { code });
        else { revealCard.innerHTML = ''; waitingMsg.style.display = 'block'; }
      }
    });

    App.onSocket('draft:reveal', renderReveal);

    App.onSocket('draft:picked', (payload) => {
      renderSlots(payload.filled, payload.remaining);
      renderSquad(payload.squad);
      if (!payload.draftComplete) {
        socket.emit('draft:reveal', { code });
      } else {
        revealCard.innerHTML = '';
        waitingMsg.style.display = 'block';
      }
    });

    App.onSocket('draft:poolUpdate', (u) => {
      poolCount.textContent = u.poolRemaining;
    });

    App.onSocket('tournament:started', () => App.goTournament(code));

    App.onSocket('error:message', (e) => App.toast(e.error, true));
  }
};
