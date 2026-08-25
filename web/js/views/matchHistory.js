const MatchHistoryView = {
  async render(container) {
    container.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h2 style="margin:0;">Match History</h2>
        <button class="btn btn-ghost" id="btnHistoryBack">Back</button>
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
      body.innerHTML = `<p class="muted center">No finished tournaments yet - your match history will show up here once you complete one.</p>`;
      return;
    }

    const outcomeLabel = { w: 'W', d: 'D', l: 'L' };
    const outcomeClass = { w: 'win', d: 'draw', l: 'loss' };
    const stageRank = { group: 1, r32: 2, r16: 3, qf: 4, sf: 5, final: 6 };

    function dateLabel(iso) {
      try { return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
      catch { return iso; }
    }

    function record(matches) {
      return matches.reduce((acc, m) => {
        acc[m.outcome] += 1;
        acc.gf += m.myGoals;
        acc.ga += m.oppGoals;
        if (m.stage !== 'group') acc.knockouts += 1;
        if (m.opponentIsHuman) acc.humans += 1;
        acc.bestRank = Math.max(acc.bestRank, stageRank[m.stage] || 0);
        return acc;
      }, { w: 0, d: 0, l: 0, gf: 0, ga: 0, knockouts: 0, humans: 0, bestRank: 0 });
    }

    function bestStage(matches) {
      const best = matches.reduce((pick, m) => (stageRank[m.stage] || 0) > (stageRank[pick] || 0) ? m.stage : pick, 'group');
      return STAGE_HISTORY_LABEL[best] || best;
    }

    function metricGrid(metrics) {
      if (!metrics || !metrics.length) return '';
      return `<div class="engine-metric-grid history-metrics">${metrics.slice(0, 6).map((x) => `
        <div class="engine-metric"><span>${x.label}</span><b>${x.mine}</b><em>${x.opponent}</em></div>
      `).join('')}</div>`;
    }

    function factorList(factors) {
      const icon = { good: '+', bad: '-', neutral: '=' };
      if (!factors || !factors.length) return '';
      return `<div class="engine-factor-list history-factors">${factors.slice(0, 4).map((f) => `
        <div class="engine-factor ${f.tone || 'neutral'}"><span>${icon[f.tone] || '='}</span><div><b>${f.label}: ${f.value}</b><small>${f.detail}</small></div></div>
      `).join('')}</div>`;
    }

    function analysisReport(m) {
      const data = typeof m.analysis === 'string' ? { summary: m.analysis } : (m.analysis || {});
      const summary = data.summary || data.verdict || 'No engine notes were stored for this match.';
      return `
        ${metricGrid(data.metrics)}
        ${factorList(data.factors)}
        <p class="history-analysis">${summary}</p>
        ${data.verdict ? `<div class="engine-verdict">${data.verdict}</div>` : ''}
      `;
    }

    function scoreText(m) {
      return m.wentToPenalties && m.penalties
        ? `${m.myGoals}-${m.oppGoals} (pens ${m.penalties.A}-${m.penalties.B})`
        : `${m.myGoals}-${m.oppGoals}${m.wentToExtraTime ? ' (AET)' : ''}`;
    }

    function matchRow(m, ti, mi) {
      const stageLabel = m.group ? `Group ${m.group}` : (STAGE_HISTORY_LABEL[m.stage] || m.stage);
      const knockout = m.stage !== 'group';
      return `
        <div class="match-row match-row-clickable history-match-row" data-ti="${ti}" data-mi="${mi}" data-outcome="${m.outcome}" data-knockout="${knockout ? '1' : '0'}">
          <div class="match-team"><span class="match-team-name">vs ${m.opponent}${m.opponentIsHuman ? ' <span class="player-chip">human</span>' : ''}</span></div>
          <div class="match-score-box">
            <span class="match-score-val history-outcome ${outcomeClass[m.outcome]}">${outcomeLabel[m.outcome]}</span>
            <span class="match-score-pens">${scoreText(m)}</span>
          </div>
          <div class="match-team side-b"><span class="muted">${stageLabel}</span></div>
        </div>
        <div class="match-report hidden history-report" id="hist-report-${ti}-${mi}" data-outcome="${m.outcome}" data-knockout="${knockout ? '1' : '0'}">
          ${analysisReport(m)}
        </div>
      `;
    }

    const allMatches = tournaments.flatMap((tour) => tour.matches.map((m) => ({ ...m, tour })));
    const total = record(allMatches);
    const played = allMatches.length || 1;
    const winRate = Math.round((total.w / played) * 100);
    const titles = tournaments.filter((t) => t.champion).length;
    const bestRun = tournaments.slice().sort((a, b) => record(b.matches).bestRank - record(a.matches).bestRank)[0];

    body.innerHTML = `
      <div class="history-hero myteam-card">
        <div class="myteam-header"><span>Career Review</span><span class="badge">${tournaments.length} tournaments</span></div>
        <div class="history-summary-grid">
          <div><span>Record</span><b>${total.w}-${total.d}-${total.l}</b></div>
          <div><span>Win rate</span><b>${winRate}%</b></div>
          <div><span>Goals</span><b>${total.gf}-${total.ga}</b></div>
          <div><span>Titles</span><b>${titles}</b></div>
        </div>
        <div class="history-idea-grid">
          <article><b>Best run</b><span>${bestRun.countryName} - ${bestStage(bestRun.matches)}</span></article>
          <article><b>Pressure games</b><span>${total.knockouts} knockout matches tracked</span></article>
          <article><b>Human duels</b><span>${total.humans} matches against real players</span></article>
        </div>
        <div class="history-filter-row" id="historyFilters">
          <button class="active" data-filter="all">All</button>
          <button data-filter="w">Wins</button>
          <button data-filter="d">Draws</button>
          <button data-filter="l">Losses</button>
          <button data-filter="ko">Knockout</button>
        </div>
      </div>
      ${tournaments.map((tour, ti) => {
        const r = record(tour.matches);
        return `
        <div class="myteam-card history-tournament-card" style="margin-bottom:14px;">
          <div class="myteam-header">
            <span>${tour.countryName}${tour.champion ? ' - Champion' : ''}</span>
            <span class="badge">${tour.roomName} &middot; ${dateLabel(tour.date)}</span>
          </div>
          <div class="history-tour-summary">
            <span>${r.w}-${r.d}-${r.l} record</span><span>${r.gf}-${r.ga} goals</span><span>${bestStage(tour.matches)}</span>
          </div>
          <div class="matchlog" style="max-height:none;">
            ${tour.matches.map((m, mi) => matchRow(m, ti, mi)).join('')}
          </div>
        </div>`;
      }).join('')}
    `;

    body.querySelectorAll('.match-row-clickable').forEach((row) => {
      row.addEventListener('click', () => {
        const report = body.querySelector(`#hist-report-${row.dataset.ti}-${row.dataset.mi}`);
        if (report) report.classList.toggle('hidden');
        row.classList.toggle('expanded');
      });
    });

    body.querySelectorAll('#historyFilters button').forEach((button) => {
      button.addEventListener('click', () => {
        body.querySelectorAll('#historyFilters button').forEach((b) => b.classList.remove('active'));
        button.classList.add('active');
        const filter = button.dataset.filter;
        body.querySelectorAll('.history-match-row, .history-report').forEach((el) => {
          const show = filter === 'all' || el.dataset.outcome === filter || (filter === 'ko' && el.dataset.knockout === '1');
          el.classList.toggle('history-filtered', !show);
        });
      });
    });
  }
};

const STAGE_HISTORY_LABEL = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-Finals', sf: 'Semi-Finals', final: 'Final'
};
