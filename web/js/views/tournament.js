const TournamentView = {
  async render(container, code) {
    container.innerHTML = `<div class="card center muted">در حال بارگذاری جام جهانی...</div>`;

    const socket = App.ensureSocket();
    socket.emit('room:join', { code });

    container.innerHTML = `
      <div id="championZone"></div>
      <div class="center"><span class="stage-pill" id="stagePill">...</span></div>
      <div class="card center" id="simZone">
        <button class="btn btn-primary" id="btnSimNext">▶ شبیه‌سازی مرحله بعد</button>
      </div>
      <div class="card">
        <h3>📋 گروه‌ها</h3>
        <div class="group-grid" id="groupGrid"></div>
      </div>
      <div class="card" id="bracketCard" style="display:none;">
        <h3>🏆 مرحله حذفی</h3>
        <div id="bracketZone"></div>
      </div>
      <div class="card">
        <h3>📜 آخرین نتایج</h3>
        <div class="matchlog" id="matchLog"></div>
      </div>
    `;

    const stagePill = container.querySelector('#stagePill');
    const groupGrid = container.querySelector('#groupGrid');
    const bracketCard = container.querySelector('#bracketCard');
    const bracketZone = container.querySelector('#bracketZone');
    const matchLog = container.querySelector('#matchLog');
    const championZone = container.querySelector('#championZone');
    const simZone = container.querySelector('#simZone');

    const ROUND_LABEL = { r32: 'یک‌شانزدهم نهایی', r16: 'یک‌هشتم نهایی', qf: 'ربع‌نهایی', sf: 'نیمه‌نهایی', final: 'فینال' };

    function scoreText(m) {
      if (!m.result) return 'در انتظار';
      let s = `${m.result.goalsA} - ${m.result.goalsB}`;
      if (m.result.wentToPenalties) s += ` (پن: ${m.result.penalties.A}-${m.result.penalties.B})`;
      return s;
    }

    function render(t) {
      stagePill.textContent = STAGE_LABEL[t.stage] || t.stage;

      if (t.champion) {
        championZone.innerHTML = `
          <div class="champion-banner">
            <div class="trophy">🏆</div>
            <h2>قهرمان جام جهانی: ${t.champion.name}</h2>
            <p class="muted">${t.champion.isHuman ? `کنترل‌شده توسط ${t.champion.username} 👑` : 'یک تیم بات قهرمان شد 🤖'}</p>
          </div>`;
        simZone.style.display = 'none';
      } else {
        championZone.innerHTML = '';
        simZone.style.display = 'block';
      }

      groupGrid.innerHTML = Object.entries(t.groups).map(([label, rows]) => `
        <div>
          <h4>گروه ${label}</h4>
          <table class="group-table">
            <thead><tr><th>تیم</th><th>ب</th><th>زده</th><th>خورده</th><th>تفاضل</th><th>امت</th></tr></thead>
            <tbody>
              ${rows.map((r) => `
                <tr class="${r.isHuman ? 'human' : ''} ${r.eliminated ? 'eliminated' : ''}">
                  <td>${r.name}${r.isHuman ? ` (${r.username})` : ''}</td>
                  <td>${r.played}</td>
                  <td>${r.gf}</td>
                  <td>${r.ga}</td>
                  <td>${r.gf - r.ga}</td>
                  <td><b>${r.pts}</b></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('');

      const roundKeys = Object.keys(t.bracket);
      if (roundKeys.length) {
        bracketCard.style.display = 'block';
        bracketZone.innerHTML = roundKeys.map((round) => `
          <div class="bracket-round">
            <h4>${ROUND_LABEL[round] || round}</h4>
            ${t.bracket[round].map((m) => `
              <div class="match-row">
                <span class="${m.winnerCode === m.aCode ? 'winner' : ''}">${m.aName}${m.aHuman ? ' 👤' : ''}</span>
                <span>${scoreText(m)}</span>
                <span class="${m.winnerCode === m.bCode ? 'winner' : ''}">${m.bName}${m.bHuman ? ' 👤' : ''}</span>
              </div>
            `).join('')}
          </div>
        `).join('');
      }

      matchLog.innerHTML = t.recentMatches.slice().reverse().map((m) => {
        const aName = t.groups ? (findName(t, m.aCode)) : m.aCode;
        const bName = findName(t, m.bCode);
        let s = `${m.goalsA} - ${m.goalsB}`;
        if (m.wentToPenalties) s += ` (پن)`;
        return `<div>${aName} <b>${s}</b> ${bName}</div>`;
      }).join('') || '<p class="muted">هنوز بازی‌ای انجام نشده.</p>';
    }

    function findName(t, code) {
      for (const rows of Object.values(t.groups)) {
        const hit = rows.find((r) => r.code === code);
        if (hit) return hit.name;
      }
      return code;
    }

    try {
      const state = await Api.getRoomState(code);
      if (state.tournament) render(state.tournament);
    } catch (e) { App.toast(e.message, true); }

    App.onSocket('room:state', (s) => { if (s.tournament) render(s.tournament); });
    App.onSocket('tournament:started', (t) => render(t));
    App.onSocket('tournament:update', (u) => render(u.tournament));
    App.onSocket('error:message', (e) => App.toast(e.error, true));

    container.querySelector('#btnSimNext').addEventListener('click', () => {
      socket.emit('tournament:simulateNext', { code });
    });
  }
};
