const AdminView = (() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  async function render(container) {
    if (App.state.user?.role !== 'admin') return App.goDashboard();
    container.innerHTML = `<div class="admin-page"><div class="card admin-hero"><div><span class="badge">Administrator</span><h1>Admin Panel</h1><p class="muted">Analyse the player database, review seasons and develop custom tactics.</p></div><button id="adminTactics" class="btn btn-primary">Open Tactics Lab</button></div><div id="adminMetrics" class="admin-metrics"></div>
      <section class="card"><h2>Player Analysis</h2><div class="admin-filters"><label>Competition<select id="adminCompetition"><option value="pgl">Persian Gulf League</option><option value="worldcup">World Cup</option></select></label><label>Club<select id="adminClub"></select></label><label>Position<select id="adminPosition"><option value="">All positions</option><option>GK</option><option value="DF">Defense</option><option value="MF">Midfield</option><option value="FW">Forward</option></select></label><label>Minimum OVR<input id="adminRating" type="number" min="0" max="99" value="0"></label><label>Search<input id="adminSearch" type="search" placeholder="Player or position"></label></div><p id="adminPlayerSummary" class="muted"></p><div id="adminComparison"></div><p class="muted">Select up to three players to compare. Ratings come from the game database.</p><div id="adminPlayers" class="admin-player-grid"></div><button id="adminMore" class="btn btn-ghost">Show More Players</button></section>
      <section class="card"><h2>League Analysis</h2><div class="field"><label for="adminLeague">Season</label><select id="adminLeague"><option value="">Choose a season</option></select></div><div id="adminLeagueReport" aria-live="polite"></div></section></div>`;
    const $ = (selector) => container.querySelector(selector);
    let players = [], clubs = [], shown = 36, chosen = new Set(), playerRequest = 0, leagueRequest = 0;
    $('#adminTactics').onclick = () => App.goTactics();
    function renderPlayers() {
      const query = $('#adminSearch').value.trim().toLowerCase();
      const filtered = players.filter((player) => (!$('#adminClub').value || player.clubCode === $('#adminClub').value) && (!$('#adminPosition').value || player.pos === $('#adminPosition').value) && player.overall >= Number($('#adminRating').value) && `${player.name} ${player.rawPos} ${player.clubName}`.toLowerCase().includes(query)).sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
      const average = filtered.length ? (filtered.reduce((sum, player) => sum + player.overall, 0) / filtered.length).toFixed(1) : '—';
      $('#adminPlayerSummary').textContent = `${filtered.length} players · Average OVR ${average} · ${filtered.filter((player) => player.isStar).length} stars`;
      $('#adminPlayers').innerHTML = filtered.slice(0, shown).map((player) => `<button class="transfer-player-card ${chosen.has(player.id) ? 'selected' : ''}" data-player="${esc(player.id)}" aria-pressed="${chosen.has(player.id)}"><div class="transfer-player-head"><b>${esc(player.name)}</b><span class="badge">OVR ${player.overall}</span></div><p>${esc(player.clubName)} · ${esc(player.rawPos || player.pos)}</p><div class="transfer-player-tags"><span>${esc(player.pos)}</span>${player.isStar ? '<span>★ Star</span>' : ''}</div></button>`).join('') || '<p>No players match your filters.</p>';
      $('#adminMore').classList.toggle('hidden', filtered.length <= shown);
      $('#adminPlayers').querySelectorAll('[data-player]').forEach((button) => button.onclick = () => {
        const id = button.dataset.player;
        if (chosen.has(id)) chosen.delete(id); else if (chosen.size < 3) chosen.add(id); else return App.toast('Compare up to three players.', true);
        renderPlayers();
      });
      const selected = players.filter((player) => chosen.has(player.id));
      $('#adminComparison').innerHTML = selected.length ? `<div class="admin-comparison"><h3>Player Comparison</h3><div class="table-scroll"><table class="table"><thead><tr><th>Attribute</th>${selected.map((player) => `<th>${esc(player.name)}</th>`).join('')}</tr></thead><tbody>${[['Club', 'clubName'], ['Position', 'rawPos'], ['Role', 'pos'], ['OVR', 'overall'], ['Star', 'isStar']].map(([label, key]) => `<tr><th>${label}</th>${selected.map((player) => `<td>${esc(key === 'isStar' ? player[key] ? 'Yes' : 'No' : player[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button id="clearComparison" class="btn btn-ghost btn-sm">Clear Comparison</button></div>` : '';
      if ($('#clearComparison')) $('#clearComparison').onclick = () => { chosen.clear(); renderPlayers(); };
    }
    async function loadPlayers() {
      const id = ++playerRequest;
      $('#adminPlayers').textContent = 'Loading players…';
      try {
        const data = await Api.get(`/api/admin/players?competition=${$('#adminCompetition').value}`);
        if (id !== playerRequest || !container.querySelector('#adminPlayers')) return;
        players = data.players; clubs = data.clubs; chosen.clear(); shown = 36;
        $('#adminClub').innerHTML = '<option value="">All clubs</option>' + clubs.map((club) => `<option value="${esc(club.code)}">${esc(club.name)}</option>`).join('');
        renderPlayers();
      } catch (error) { $('#adminPlayers').textContent = error.message; }
    }
    $('#adminCompetition').onchange = loadPlayers;
    for (const selector of ['#adminClub', '#adminPosition', '#adminRating', '#adminSearch']) $(selector).addEventListener('input', () => { shown = 36; renderPlayers(); });
    $('#adminMore').onclick = () => { shown += 36; renderPlayers(); };
    $('#adminLeague').onchange = async () => {
      const code = $('#adminLeague').value, id = ++leagueRequest;
      if (!code) { $('#adminLeagueReport').innerHTML = ''; return; }
      $('#adminLeagueReport').textContent = 'Loading season analysis…';
      try {
        const data = await Api.get(`/api/admin/leagues/${encodeURIComponent(code)}`);
        if (id !== leagueRequest) return;
        const table = data.league.table;
        $('#adminLeagueReport').innerHTML = `<h3>${esc(data.name)} · Matchday ${data.league.matchday}/${data.league.totalMatchdays}</h3><div class="table-scroll"><table class="table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th></tr></thead><tbody>${table.map((row, index) => `<tr><td>${index + 1}</td><td>${index >= table.length - 2 ? '↓ ' : ''}${esc(row.name)}</td>${['played', 'w', 'd', 'l', 'gf', 'ga', 'pts'].map((key) => `<td>${row[key]}</td>`).join('')}</tr>`).join('')}</tbody></table></div><label>Team player statistics<select id="adminStatsClub">${data.clubs.map((club, index) => `<option value="${index}">${esc(club.name)}</option>`).join('')}</select></label><div id="adminSeasonPlayers" class="table-scroll"></div>`;
        function stats() {
          const club = data.clubs[Number($('#adminStatsClub').value)];
          $('#adminSeasonPlayers').innerHTML = `<p class="muted">${esc(club.formation)} · ${esc(club.tacticalStyle)}</p><table class="table"><thead><tr><th>Player</th><th>Status</th><th>OVR</th><th>Apps</th><th>Goals</th><th>Assists</th><th>Saves</th><th>YC</th><th>RC</th></tr></thead><tbody>${club.players.map((player) => `<tr><td>${esc(player.name)}</td><td>${esc(player.status)}</td><td>${player.overall}</td>${['appearances', 'goals', 'assists', 'saves', 'yellowCards', 'redCards'].map((key) => `<td>${player.stats[key]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        }
        $('#adminStatsClub').onchange = stats; stats();
      } catch (error) { if (id === leagueRequest) $('#adminLeagueReport').textContent = error.message; }
    };
    try {
      const [overview, leagues] = await Promise.all([Api.get('/api/admin/overview'), Api.get('/api/admin/leagues')]);
      $('#adminMetrics').innerHTML = Object.entries(overview).map(([label, value]) => `<div class="card"><span>${esc(label)}</span><b>${value}</b></div>`).join('');
      $('#adminLeague').innerHTML += leagues.map((season) => `<option value="${esc(season.code)}">${esc(season.name)} · ${esc(season.manager)} · ${esc(season.status)}</option>`).join('');
    } catch (error) { App.toast(error.message, true); }
    await loadPlayers();
  }
  return { render };
})();
