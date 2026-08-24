const MatchHistoryView = {
  async render(container) {
    container.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="margin:0;">Match History</h2>
        <button class="btn btn-ghost" id="btnHistoryBack">← Back</button>
      </div>
      <div id="historyBody"><p class="muted center">Loading your match history...</p></div>
    `;
    container.querySelector('#btnHistoryBack').addEventListener('click', () => App.goDashboard());

    const body = container.querySelector('#historyBody');

    let data;
    try {
      data = await Api.matchHistory();
    } catch (e) {
      body.innerHTML = `<p class="muted center">Couldn't load match history: ${e.message}</p>`;
      return;
    }

    const tournaments = data.tournaments || [];
    if (!tournaments.length) {
      body.innerHTML = `<p class="muted center">No finished tournaments yet — your match history will show up here once you complete one.</p>`;
      return;
    }

    const outcomeLabel = { w: 'W', d: 'D', l: 'L' };
    const outcomeClass = { w: 'win', d: 'draw', l: 'loss' };

    function dateLabel(iso) {
      try { return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
      catch { return iso; }
    }

    function matchRow(m, ti, mi) {
      const analysis = typeof m.analysis === 'string' ? m.analysis : (m.analysis && (m.analysis.summary || m.analysis.verdict)) ? [m.analysis.summary, m.analysis.verdict].filter(Boolean).join(' ') : '';
      const scoreText = m.wentToPenalties
        ? `${m.myGoals}-${m.oppGoals} (pens ${m.penalties.A}-${m.penalties.B})`
        : `${m.myGoals}-${m.oppGoals}${m.wentToExtraTime ? ' (AET)' : ''}`;
      const stageLabel = m.group ? `Group ${m.group}` : (STAGE_HISTORY_LABEL[m.stage] || m.stage);
      return `
        <div class="match-row match-row-clickable" data-ti="${ti}" data-mi="${mi}">
          <div class="match-team"><span class="match-team-name">vs ${m.opponent}${m.opponentIsHuman ? ' <span class="player-chip">human</span>' : ''}</span></div>
          <div class="match-score-box">
            <span class="match-score-val history-outcome ${outcomeClass[m.outcome]}">${outcomeLabel[m.outcome]}</span>
            <span class="match-score-pens">${scoreText}</span>
          </div>
          <div class="match-team side-b"><span class="muted">${stageLabel}</span></div>
        </div>
        <div class="match-report hidden" id="hist-report-${ti}-${mi}">
          <p class="history-analysis">${analysis}</p>
        </div>
      `;
    }

    body.innerHTML = tournaments.map((tour, ti) => `
      <div class="myteam-card" style="margin-bottom:14px;">
        <div class="myteam-header">
          <span>${tour.countryName}${tour.champion ? ' 🏆' : ''}</span>
          <span class="badge">${tour.roomName} &middot; ${dateLabel(tour.date)}</span>
        </div>
        <div class="matchlog" style="max-height:none;">
          ${tour.matches.map((m, mi) => matchRow(m, ti, mi)).join('')}
        </div>
      </div>
    `).join('');

    body.querySelectorAll('.match-row-clickable').forEach((row) => {
      row.addEventListener('click', () => {
        const report = body.querySelector(`#hist-report-${row.dataset.ti}-${row.dataset.mi}`);
        if (report) report.classList.toggle('hidden');
        row.classList.toggle('expanded');
      });
    });
  }
};

const STAGE_HISTORY_LABEL = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-Finals', sf: 'Semi-Finals', final: 'Final'
};
