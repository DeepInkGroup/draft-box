const AdminView = (() => {
  let cleanup = null;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const statusLabels = { online: 'Online', recent: 'Recently active', offline: 'Offline', new: 'No activity recorded' };
  function date(value) {
    if (!value) return 'Not recorded';
    const parsed = new Date(value.replace(' ', 'T') + 'Z');
    return Number.isNaN(parsed.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  }
  const icon = (path) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
  const tabs = [
    ['overview', 'Overview', 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
    ['users', 'Users', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
    ['players', 'Player Analysis', 'M12 3v18 M3 12h18 M5 5l14 14 M5 19 19 5'],
    ['leagues', 'League Reports', 'M4 20h16 M6 16V9 M12 16V4 M18 16v-5'],
    ['tactics', 'Tactics Lab', 'M9 3h6 M10 3v7L4 20h16l-6-10V3 M8 15h8'],
    ['settings', 'Account', 'M12 3 3 7v6c0 4 5 7 9 9 4-2 9-5 9-9V7z M8 12l3 3 5-5']
  ];
  async function render(container, initialTab = 'overview') {
    if (App.state.user?.role !== 'admin') return App.goDashboard();
    if (cleanup) cleanup();
    container.innerHTML = `<div class="admin-console" id="adminConsole"><aside class="admin-sidebar"><div class="admin-sidebar-brand"><span class="admin-mark">DB</span><div><b>Draft Box</b><span>Administration</span></div></div><p class="admin-nav-label">Workspace</p><nav aria-label="Admin sections">${tabs.map(([id, label, path]) => `<button class="admin-nav-item" data-admin-tab="${id}">${icon(path)}<span>${label}</span></button>`).join('')}</nav><div class="admin-identity"><span class="admin-avatar">A</span><div><b>${esc(App.state.user.username)}</b><span>Administrator</span></div></div><button id="adminLogout" class="btn btn-ghost">Sign Out</button></aside>
    <div class="admin-main"><header class="admin-page-header"><div><p class="admin-eyebrow">ADMIN PANEL <span>/</span> <span id="adminBreadcrumb">Overview</span></p><h1 id="adminPageTitle">Overview</h1><p class="muted" id="adminPageDescription">Your accounts, competitions and analysis tools in one place.</p></div><div class="admin-header-actions"><span id="adminRefreshTime" class="muted" aria-live="polite"></span><button id="adminRefresh" class="btn btn-ghost btn-sm">↻ Refresh</button></div></header>
    <section data-admin-panel="overview" class="admin-panel"><div id="adminMetrics" class="admin-metrics"></div><div class="admin-overview-grid"><section class="card admin-welcome"><span class="badge">Control room</span><h2>Welcome back, ${esc(App.state.user.username)}.</h2><p>Keep track of accounts, inspect league performance and test tactical ideas.</p><div class="row"><button class="btn btn-primary" data-admin-open="users">Review Users</button><button id="adminTactics" class="btn btn-ghost">Open Tactics Lab</button></div></section><section class="card"><div class="admin-section-head"><div><span class="admin-eyebrow">ACCOUNTS</span><h2>Activity at a glance</h2></div></div><div id="adminActivitySummary" class="admin-activity-summary"></div><p class="muted">Online means a connected game session. Recently active means a request in the last five minutes.</p></section></div><section class="card"><div class="admin-section-head"><div><span class="admin-eyebrow">DIRECTORY</span><h2>Newest Accounts</h2></div><button class="btn btn-ghost btn-sm" data-admin-open="users">View All Users →</button></div><div id="adminRecentUsers" class="admin-recent-users"></div></section></section>
    <section data-admin-panel="users" class="admin-panel hidden"><section class="card"><div class="admin-section-head"><div><h2>User Directory</h2><p class="muted">Find accounts and inspect their contact details, activity and games.</p></div><span id="adminUserCount" class="badge"></span></div><div class="admin-filters admin-user-filters"><label>Search accounts<input id="adminUserSearch" type="search" placeholder="Username, email or friend code"></label><label>Activity<select id="adminUserStatus"><option value="">All activity</option><option value="online">Online</option><option value="recent">Recently active</option><option value="offline">Offline</option><option value="new">No activity recorded</option></select></label><label>Role<select id="adminUserRole"><option value="">All roles</option><option value="user">Player</option><option value="admin">Administrator</option></select></label><label>Sort<select id="adminUserSort"><option value="created">Newest first</option><option value="seen">Last active</option><option value="name">Username A–Z</option></select></label></div><div id="adminUsersTable" class="table-scroll" aria-live="polite"></div><div class="admin-pagination"><p id="adminUserPageLabel" class="muted"></p><div class="row"><button id="adminUsersPrev" class="btn btn-ghost btn-sm">← Previous</button><button id="adminUsersNext" class="btn btn-ghost btn-sm">Next →</button></div></div></section><section id="adminUserDetail" class="card hidden" aria-live="polite"></section></section>
    <section data-admin-panel="players" class="admin-panel hidden"><section class="card"><div class="admin-section-head"><div><h2>Player Database</h2><p class="muted">Filter the roster, then select up to three players to compare.</p></div><span class="badge">PGL + World Cup</span></div><div class="admin-filters"><label>Competition<select id="adminCompetition"><option value="pgl">Persian Gulf League</option><option value="worldcup">World Cup</option></select></label><label>Club<select id="adminClub"></select></label><label>Position<select id="adminPosition"><option value="">All positions</option><option>GK</option><option value="DF">Defense</option><option value="MF">Midfield</option><option value="FW">Forward</option></select></label><label>Minimum OVR<input id="adminRating" type="number" min="0" max="99" value="0"></label><label>Search<input id="adminSearch" type="search" placeholder="Player or position"></label></div><p id="adminPlayerSummary" class="muted"></p><div id="adminComparison"></div><div id="adminPlayers" class="admin-player-grid"></div><button id="adminMore" class="btn btn-ghost">Show More Players</button></section></section>
    <section data-admin-panel="leagues" class="admin-panel hidden"><section class="card"><h2>League Analysis</h2><p class="muted">Inspect a season without changing any player's progress.</p><div class="field"><label for="adminLeague">Season</label><select id="adminLeague"><option value="">Choose a season</option></select></div><div id="adminLeagueReport" aria-live="polite"></div></section></section>
    <section data-admin-panel="tactics" class="admin-panel hidden"><div id="adminTacticsBody"></div></section>
    <section data-admin-panel="settings" class="admin-panel hidden"><section class="card admin-account-card"><h2>Administrator Account</h2><p class="muted">${esc(App.state.user.username)} · Administrator</p><form id="adminPasswordForm"><label>Current password<input id="adminCurrentPassword" type="password" autocomplete="current-password" required></label><label>New password<input id="adminNewPassword" type="password" minlength="6" autocomplete="new-password" required></label><label>Confirm new password<input id="adminConfirmPassword" type="password" minlength="6" autocomplete="new-password" required></label><p id="adminPasswordMessage" aria-live="polite"></p><button class="btn btn-primary" type="submit">Update Password</button></form></section></section></div></div>`;
    const $ = (selector) => container.querySelector(selector);
    const root = $('#adminConsole');
    const alive = () => container.contains(root);
    let tacticsLoaded = false, userPage = 1, userPages = 1, userRequest = 0, detailRequest = 0, selectedUser = null, searchTimer;
    const descriptions = {
      overview: 'Your accounts, competitions and analysis tools in one place.', users: 'Inspect user emails, roles, activity and game history.',
      players: 'Explore rosters and compare the players behind every team.', leagues: 'Review standings and player statistics across saved seasons.',
      tactics: 'Create, version and test tactics with the match engine.', settings: 'Manage your administrator login.'
    };
    function selectTab(id) {
      if (!tabs.some((tab) => tab[0] === id)) id = 'overview';
      const label = tabs.find((tab) => tab[0] === id)[1];
      root.querySelectorAll('[data-admin-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.adminPanel !== id));
      root.querySelectorAll('[data-admin-tab]').forEach((button) => {
        const active = button.dataset.adminTab === id;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      });
      $('#adminPageTitle').textContent = label; $('#adminBreadcrumb').textContent = label;
      $('#adminPageDescription').textContent = descriptions[id];
      location.hash = id === 'overview' ? 'admin' : `admin/${id}`;
      if (id === 'tactics' && !tacticsLoaded) { tacticsLoaded = true; TacticsView.init($('#adminTacticsBody')); }
    }
    root.querySelectorAll('[data-admin-tab], [data-admin-open]').forEach((button) => button.onclick = () => selectTab(button.dataset.adminTab || button.dataset.adminOpen));
    const onHashChange = () => {
      if (!alive() || App.state.user?.role !== 'admin') return;
      const [view, tab] = location.hash.replace(/^#\/?/, '').split('/');
      if (view !== 'admin' || (tab && !tabs.some((item) => item[0] === tab))) history.replaceState(null, '', '#admin');
      selectTab(view === 'admin' ? tab || 'overview' : 'overview');
    };
    window.addEventListener('hashchange', onHashChange);
    cleanup = () => { window.removeEventListener('hashchange', onHashChange); clearTimeout(searchTimer); };
    $('#adminLogout').onclick = () => App.logout();
    function statusHtml(user) { return `<span class="admin-status status-${user.status}"><i></i>${statusLabels[user.status]}</span>`; }
    async function loadUsers() {
      const request = ++userRequest;
      $('#adminUsersTable').innerHTML = '<div class="admin-loading">Loading user accounts…</div>';
      $('#adminUsersPrev').disabled = true; $('#adminUsersNext').disabled = true;
      const params = new URLSearchParams({ page: userPage, search: $('#adminUserSearch').value, role: $('#adminUserRole').value, status: $('#adminUserStatus').value, sort: $('#adminUserSort').value });
      try {
        const data = await Api.get('/api/admin/users?' + params);
        if (request !== userRequest || !alive()) return;
        userPage = data.page; userPages = data.pages;
        $('#adminUserCount').textContent = `${data.total} ${data.total === 1 ? 'account' : 'accounts'}`;
        $('#adminActivitySummary').innerHTML = [['Online', data.summary.online, 'online'], ['Recently active', data.summary.recent, 'recent'], ['Administrators', data.summary.admins, 'admin']].map(([label, count, style]) => `<div><span class="admin-status status-${style}"><i></i>${label}</span><b>${count}</b></div>`).join('');
        $('#adminUsersTable').innerHTML = data.users.length ? `<table class="table admin-users-table"><thead><tr><th>Account</th><th>Email</th><th>Role</th><th>Activity</th><th>Last seen</th><th>Games</th><th></th></tr></thead><tbody>${data.users.map((user) => `<tr><td data-label="Account"><div class="admin-user-cell"><span class="admin-avatar">${esc(user.username[0].toUpperCase())}</span><div><b>${esc(user.username)}</b><small>#${user.id} · ${esc(user.friendCode)}</small></div></div></td><td data-label="Email">${esc(user.email)}</td><td data-label="Role"><span class="admin-role ${user.role === 'admin' ? 'is-admin' : ''}">${user.role === 'admin' ? 'Administrator' : 'Player'}</span></td><td data-label="Activity">${statusHtml(user)}</td><td data-label="Last seen">${esc(date(user.lastSeen))}</td><td data-label="Games"><b>${user.games.total}</b><small class="admin-cell-note">${user.games.active} active</small></td><td><button class="btn btn-ghost btn-sm" data-inspect-user="${user.id}" aria-label="Inspect ${esc(user.username)}">View →</button></td></tr>`).join('')}</tbody></table>` : '<div class="admin-empty"><b>No matching accounts</b><p>Try another name, email, role or activity filter.</p><button id="adminClearUserFilters" class="btn btn-ghost btn-sm">Clear Filters</button></div>';
        $('#adminUserPageLabel').textContent = data.total ? `Showing ${(data.page - 1) * data.pageSize + 1}–${Math.min(data.total, data.page * data.pageSize)} of ${data.total} · Page ${data.page}/${data.pages}` : '0 accounts';
        $('#adminUsersPrev').disabled = userPage <= 1; $('#adminUsersNext').disabled = userPage >= userPages;
        if ($('#adminClearUserFilters')) $('#adminClearUserFilters').onclick = () => { $('#adminUserSearch').value = ''; $('#adminUserRole').value = ''; $('#adminUserStatus').value = ''; userPage = 1; loadUsers(); };
        root.querySelectorAll('[data-inspect-user]').forEach((button) => button.onclick = () => inspectUser(button.dataset.inspectUser));
      } catch (error) {
        if (request !== userRequest || !alive()) return;
        $('#adminUsersTable').innerHTML = `<div class="admin-empty"><b>Could not load accounts</b><p>${esc(error.message)}</p><button id="adminRetryUsers" class="btn btn-ghost">Try Again</button></div>`;
        $('#adminRetryUsers').onclick = loadUsers;
      }
    }
    async function inspectUser(id) {
      const request = ++detailRequest;
      selectedUser = id;
      $('#adminUserDetail').classList.remove('hidden'); $('#adminUserDetail').textContent = 'Loading account details…';
      try {
        const data = await Api.get(`/api/admin/users/${encodeURIComponent(id)}`);
        if (request !== detailRequest || !alive()) return;
        const user = data.user;
        $('#adminUserDetail').innerHTML = `<div class="admin-section-head"><div class="admin-user-cell"><span class="admin-avatar large">${esc(user.username[0].toUpperCase())}</span><div><h2>${esc(user.username)}</h2><p>${esc(user.email)}</p></div></div><button id="adminCloseUser" class="btn btn-ghost btn-sm" aria-label="Close user details">Close ×</button></div><div class="admin-detail-meta"><div><span>Activity</span>${statusHtml(user)}</div><div><span>Role</span><b>${user.role === 'admin' ? 'Administrator' : 'Player'}</b></div><div><span>Friend code</span><b>${esc(user.friendCode)}</b></div><div><span>Joined</span><b>${esc(date(user.createdAt))}</b></div><div><span>Last login</span><b>${esc(date(user.lastLogin))}</b></div><div><span>Last seen</span><b>${esc(date(user.lastSeen))}</b></div></div><div class="admin-account-totals"><span><b>${data.games.total}</b> Games joined</span><span><b>${data.games.active}</b> In progress</span><span><b>${data.games.finished}</b> Finished</span></div><h3>Recent Games</h3>${data.rooms.length ? `<div class="table-scroll"><table class="table"><thead><tr><th>Competition</th><th>Mode</th><th>Status</th><th>Created</th></tr></thead><tbody>${data.rooms.map((room) => `<tr><td>${esc(room.name)}<small class="admin-cell-note">${esc(room.code)}</small></td><td>${room.mode === 'league' ? 'League' : 'World Cup'}</td><td>${esc(room.status.replaceAll('_', ' '))}</td><td>${esc(date(room.createdAt))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No games joined.</p>'}`;
        $('#adminCloseUser').onclick = () => { selectedUser = null; detailRequest++; $('#adminUserDetail').classList.add('hidden'); };
        $('#adminUserDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) { if (request === detailRequest && alive()) $('#adminUserDetail').textContent = error.message; }
    }
    $('#adminUserSearch').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { if (alive()) { userPage = 1; loadUsers(); } }, 250); };
    for (const selector of ['#adminUserStatus', '#adminUserRole', '#adminUserSort']) $(selector).onchange = () => { userPage = 1; loadUsers(); };
    $('#adminUsersPrev').onclick = () => { userPage--; loadUsers(); };
    $('#adminUsersNext').onclick = () => { userPage++; loadUsers(); };
    $('#adminPasswordForm').onsubmit = async (event) => {
      event.preventDefault(); const message = $('#adminPasswordMessage'), button = event.currentTarget.querySelector('button');
      message.textContent = '';
      if ($('#adminNewPassword').value !== $('#adminConfirmPassword').value) { message.textContent = 'The new passwords do not match.'; message.className = 'error-text'; return; }
      button.disabled = true;
      try { await Api.changePassword($('#adminCurrentPassword').value, $('#adminNewPassword').value); $('#adminPasswordForm').reset(); message.className = 'admin-success'; message.textContent = 'Password updated.'; }
      catch (error) { message.className = 'error-text'; message.textContent = error.message; }
      finally { button.disabled = false; }
    };
    let players = [], clubs = [], shown = 36, chosen = new Set(), playerRequest = 0, leagueRequest = 0;
    $('#adminTactics').onclick = () => selectTab('tactics');
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
        if (id !== playerRequest || !alive()) return;
        players = data.players; clubs = data.clubs; chosen.clear(); shown = 36;
        $('#adminClub').innerHTML = '<option value="">All clubs</option>' + clubs.map((club) => `<option value="${esc(club.code)}">${esc(club.name)}</option>`).join('');
        renderPlayers();
      } catch (error) { if (id === playerRequest && alive()) $('#adminPlayers').textContent = error.message; }
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
        if (id !== leagueRequest || !alive()) return;
        const table = data.league.table;
        $('#adminLeagueReport').innerHTML = `<h3>${esc(data.name)} · Matchday ${data.league.matchday}/${data.league.totalMatchdays}</h3><div class="table-scroll"><table class="table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th></tr></thead><tbody>${table.map((row, index) => `<tr><td>${index + 1}</td><td>${index >= table.length - 2 ? '↓ ' : ''}${esc(row.name)}</td>${['played', 'w', 'd', 'l', 'gf', 'ga', 'pts'].map((key) => `<td>${row[key]}</td>`).join('')}</tr>`).join('')}</tbody></table></div><label>Team player statistics<select id="adminStatsClub">${data.clubs.map((club, index) => `<option value="${index}">${esc(club.name)}</option>`).join('')}</select></label><div id="adminSeasonPlayers" class="table-scroll"></div>`;
        function stats() {
          const club = data.clubs[Number($('#adminStatsClub').value)];
          $('#adminSeasonPlayers').innerHTML = `<p class="muted">${esc(club.formation)} · ${esc(club.tacticalStyle)}</p><table class="table"><thead><tr><th>Player</th><th>Status</th><th>OVR</th><th>Apps</th><th>Goals</th><th>Assists</th><th>Saves</th><th>YC</th><th>RC</th></tr></thead><tbody>${club.players.map((player) => `<tr><td>${esc(player.name)}</td><td>${esc(player.status)}</td><td>${player.overall}</td>${['appearances', 'goals', 'assists', 'saves', 'yellowCards', 'redCards'].map((key) => `<td>${player.stats[key]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        }
        $('#adminStatsClub').onchange = stats; stats();
      } catch (error) { if (id === leagueRequest && alive()) $('#adminLeagueReport').textContent = error.message; }
    };
    async function loadOverview() {
      try {
        const [overview, accounts] = await Promise.all([Api.get('/api/admin/overview'), Api.get('/api/admin/users')]);
        if (!alive()) return;
        const labels = { users: 'Accounts', rooms: 'Games created', finished: 'Completed games', tactics: 'Saved tactics', players: 'Players' };
        $('#adminMetrics').innerHTML = Object.entries(overview).map(([label, value], index) => `<div class="admin-stat"><div class="admin-stat-icon">${icon(tabs[index][2])}</div><span>${labels[label]}</span><b>${Number(value).toLocaleString('en')}</b></div>`).join('');
        $('#adminRecentUsers').innerHTML = accounts.users.slice(0, 5).map((user) => `<button class="admin-recent-account" data-recent-user="${user.id}"><span class="admin-avatar">${esc(user.username[0].toUpperCase())}</span><span><b>${esc(user.username)}</b><small>${esc(user.email)}</small></span>${statusHtml(user)}</button>`).join('') || '<p class="muted">No accounts yet.</p>';
        root.querySelectorAll('[data-recent-user]').forEach((button) => button.onclick = () => { selectTab('users'); inspectUser(button.dataset.recentUser); });
      } catch (error) { if (alive()) $('#adminMetrics').innerHTML = `<p class="error-text">${esc(error.message)}</p>`; }
    }
    async function loadLeagues() {
      try {
        const leagues = await Api.get('/api/admin/leagues');
        if (!alive()) return;
        const current = $('#adminLeague').value;
        $('#adminLeague').innerHTML = `<option value="">${leagues.length ? 'Choose a season' : 'No league seasons yet'}</option>` + leagues.map((season) => `<option value="${esc(season.code)}">${esc(season.name)} · ${esc(season.manager)} · ${esc(season.status.replaceAll('_', ' '))}</option>`).join('');
        if (leagues.some((season) => season.code === current)) $('#adminLeague').value = current;
      } catch (error) { if (alive()) $('#adminLeagueReport').textContent = error.message; }
    }
    async function refresh() {
      $('#adminRefresh').disabled = true;
      await Promise.all([loadOverview(), loadUsers(), loadPlayers(), loadLeagues()]);
      if (!alive()) return;
      $('#adminRefresh').disabled = false;
      $('#adminRefreshTime').textContent = 'Checked ' + new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date());
    }
    $('#adminRefresh').onclick = async () => { await refresh(); if (selectedUser && alive()) inspectUser(selectedUser); };
    selectTab(initialTab);
    await refresh();
  }
  return { render };
})();
