const App = (() => {
  const state = { user: null, socket: null, roomCode: null };
  const appEl = document.getElementById('app');
  const homeBtn = document.getElementById('btnHome');
  const profileBtn = document.getElementById('btnProfile');
  const tacticsBtn = document.getElementById('btnTactics');
  const adminBtn = document.getElementById('btnAdmin');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  let friendStatsChart = null;

  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.style.background = isError ? 'var(--danger)' : 'var(--surface-2)';
    toastEl.style.color = isError ? '#fff' : 'var(--ink)';
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3500);
  }

  function setHeader() {
    const admin = state.user?.role === 'admin';
    document.body.classList.toggle('admin-session', admin);
    profileBtn.classList.toggle('hidden', !state.user || admin);
    tacticsBtn.classList.add('hidden');
    adminBtn.classList.toggle('hidden', state.user?.role !== 'admin');
    homeBtn.classList.toggle('hidden', !state.user || admin);
    document.getElementById('btnRulebook').classList.toggle('hidden', admin);
    document.getElementById('btnGameGuide').classList.toggle('hidden', admin);
  }

  function ensureSocket() {
    if (state.user?.role === 'admin') throw new Error('Administrator accounts can only use the admin panel');
    if (state.socket) return state.socket;
    state.socket = io(getApiBase(), { auth: { token: sessionStorage.getItem('draftbox.token') } });
    state.socket.on('connect_error', (e) => toast('Server connection error: ' + e.message, true));
    return state.socket;
  }

  function onSocket(event, handler) {
    const socket = ensureSocket();
    socket.off(event);
    socket.on(event, handler);
  }

  function disconnectSocket() {
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
  }

  function goAuth() {
    location.hash = '';
    disconnectSocket();
    state.user = null;
    setHeader();
    AuthView.render(appEl);
  }

  function goDashboard(startMode) {
    if (state.user?.role === 'admin') return goAdmin();
    location.hash = '';
    DashboardView.render(appEl);
    if (startMode === 'create') DashboardView.renderCreateRoom(appEl);
  }

  function goLobby(code) {
    if (state.user?.role === 'admin') return goAdmin();
    state.roomCode = code;
    location.hash = `lobby/${code}`;
    LobbyView.render(appEl, code);
  }

  function goDraft(code) {
    if (state.user?.role === 'admin') return goAdmin();
    state.roomCode = code;
    location.hash = `draft/${code}`;
    DraftView.render(appEl, code);
  }

  function goTournament(code) {
    if (state.user?.role === 'admin') return goAdmin();
    state.roomCode = code;
    location.hash = `tournament/${code}`;
    TournamentView.render(appEl, code);
  }

  function goMatchHistory() {
    if (state.user?.role === 'admin') return goAdmin();
    location.hash = 'history';
    MatchHistoryView.render(appEl);
  }

  function goTactics() {
    if (state.user?.role !== 'admin') { toast('Custom Tactics requires admin access.', true); return goDashboard(); }
    goAdmin('tactics');
  }

  function goAdmin(tab = 'overview') {
    if (state.user?.role !== 'admin') { toast('Admin access required.', true); return goDashboard(); }
    disconnectSocket();
    location.hash = tab === 'overview' ? 'admin' : `admin/${tab}`;
    AdminView.render(appEl, tab);
  }

  function onAuthed(user, token) {
    sessionStorage.setItem('draftbox.token', token);
    state.user = user;
    setHeader();
    toast(`Welcome, ${user.username}!`);
    goDashboard();
  }

  function logout() {
    sessionStorage.removeItem('draftbox.token');
    goAuth();
  }

  function renderProfileInsights(el, roadmapEl, stats, layoutLabel) {
    const total = stats.w + stats.d + stats.l;
    const winRate = total ? Math.round(stats.w / total * 100) : 0;
    const difference = stats.gf - stats.ga;
    document.getElementById('profileHeroRank').textContent = stats.titles ? 'Title winner' : total ? 'Active manager' : 'Fresh start';
    document.getElementById('profileHeroMeta').textContent = total ? total + ' matches played' : 'Ready for your first competition';
    el.innerHTML = [['Goal difference',(difference >= 0 ? '+' : '') + difference],['Goals per match',total ? (stats.gf / total).toFixed(1) : '\u2014'],['Conceded per match',total ? (stats.ga / total).toFixed(1) : '\u2014'],['Win rate',winRate + '%']].map(([label,value]) => '<div class="profile-insight-card"><span>' + label + '</span><b>' + value + '</b></div>').join('');
    roadmapEl.innerHTML = '<h3>' + (total ? 'Keep building your career' : 'Your first chapter starts here') + '</h3><p class="muted">' + (total ? 'Open Match History to review your results and see where your squad can improve.' : 'Finish a World Cup or league season to start filling your career record. Try a balanced formation and players in natural positions.') + '</p>';
  }

function renderStatsChart(stats) {
  const container = document.getElementById('profileMatchRecord');
  const total = stats.w + stats.d + stats.l;
  const wins = total ? stats.w / total * 100 : 0;
  const draws = total ? (stats.w + stats.d) / total * 100 : 0;
  const gradient = total ? 'conic-gradient(#55ce9d 0% ' + wins + '%,#afabc0 ' + wins + '% ' + draws + '%,#f08094 ' + draws + '% 100%)' : '#35303f';
  container.innerHTML = '<div class="profile-record-ring" style="background:' + gradient + '" aria-hidden="true"><div><b>' + total + '</b><span>matches</span></div></div><dl class="profile-record-legend">' + [['Wins',stats.w,'win'],['Draws',stats.d,'draw'],['Losses',stats.l,'loss']].map(([label,count,kind]) => '<div class="record-' + kind + '"><dt><i aria-hidden="true"></i>' + label + '</dt><dd>' + count + '</dd></div>').join('') + '</dl>' + (total ? '' : '<p class="muted profile-record-empty">Your first completed competition starts your record.</p>');
}

  function renderFriends(el, friends) {
    if (!friends || !friends.length) {
      el.innerHTML = '<p class="muted">No friends yet. Add a player by Friend ID.</p>';
      return;
    }
    el.innerHTML = friends.map((item) => {
      const incoming = item.status === 'pending' && item.direction === 'incoming';
      return `
        <div class="friend-row">
          <div><b class="friend-name" data-friend-id="${item.friend.id}" style="cursor: pointer;">${item.friend.username}</b><span>${item.friend.friendCode}</span></div>
          <div class="friend-actions">
            <span class="badge ${item.status === 'accepted' ? 'ok' : ''}">${item.status === 'accepted' ? 'Friend' : item.direction === 'incoming' ? 'Request' : 'Pending'}</span>
            ${incoming ? `<button class="btn btn-ghost btn-sm" data-friend-action="accept" data-friend-id="${item.id}">Accept</button><button class="btn btn-ghost btn-sm" data-friend-action="reject" data-friend-id="${item.id}">Reject</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadProfileFriends() {
    const listEl = document.getElementById('profileFriends');
    if (!listEl) return;
    try {
      const data = await Api.friends();
      renderFriends(listEl, data.friends || []);
    } catch (e) {
      listEl.innerHTML = `<p class="error-text">${e.message}</p>`;
    }
  }

  async function init() {
    homeBtn.addEventListener('click', () => goDashboard());
    tacticsBtn.addEventListener('click', () => goTactics());
    adminBtn.addEventListener('click', () => goAdmin());

    const settingsDialog = document.getElementById('settingsDialog');
    document.getElementById('btnSettings').addEventListener('click', () => {
      document.getElementById('apiBaseInput').value = getApiBase();
      settingsDialog.showModal();
    });
    document.getElementById('btnSaveSettings').addEventListener('click', (e) => {
      e.preventDefault();
      const val = document.getElementById('apiBaseInput').value.trim();
      try {
        setApiBase(val);
      } catch (err) {
        return toast(err.message, true);
      }
      settingsDialog.close();
      toast('Server address saved');
      disconnectSocket();
    });

    HelpViews.init();

    const profileDialog = document.getElementById('profileDialog');
    const profileError = document.getElementById('profileError');
    profileBtn.addEventListener('click', async () => {
      profileError.classList.add('hidden');
      document.getElementById('profileCurrentPassword').value = '';
      document.getElementById('profileNewPassword').value = '';
      const profileName = state.user ? state.user.username : 'Manager';
      document.getElementById('profileUsername').value = profileName;
      document.getElementById('profileHeroName').textContent = profileName;
      document.getElementById('profileHeroInitials').textContent = profileName.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'DB';
      document.getElementById('profileHeroRank').textContent = 'Fresh Start';
      document.getElementById('profileHeroMeta').textContent = 'Career data loading...';
      document.getElementById('profileEmail').value = '...';
      document.getElementById('profileFriendCode').textContent = state.user && state.user.friendCode ? state.user.friendCode : '-----';
      document.getElementById('friendCodeInput').value = '';
      const careerEl = document.getElementById('profileCareer');
      const insightsEl = document.getElementById('profileInsights');
      const roadmapEl = document.getElementById('profileRoadmap');
      const labelByLayout = { vertical: 'Vertical', 'pitch-first': 'Pitch First', horizontal: 'Side-by-Side' };
      careerEl.innerHTML = '<p class="muted">Loading...</p>';
      if (insightsEl) insightsEl.innerHTML = '';
      if (roadmapEl) roadmapEl.innerHTML = '<div class="profile-idea-head">Profile Game Plan</div><p class="muted">Loading profile recommendations...</p>';
      const layoutContainer = document.getElementById('profileDraftLayout');
      if (layoutContainer) {
        const savedLayout = localStorage.getItem('draftbox.draftLayout') || 'vertical';
        ToggleGroup.render(layoutContainer, {
          options: [
            { value: 'vertical', title: 'Vertical (Default)', sub: 'Players list on top, squad pitch below' },
            { value: 'pitch-first', title: 'Pitch First', sub: 'Squad pitch first, then player list (best for mobile)' },
            { value: 'horizontal', title: 'Side-by-Side', sub: 'Players list next to the squad pitch (left / right)' }
          ],
          selected: savedLayout,
          onChange: (val) => {
            localStorage.setItem('draftbox.draftLayout', val);
            toast(`Draft layout set to ${labelByLayout[val] || val}`);
          }
        });
      }
      profileDialog.showModal();
      try {
        const { user } = await Api.me();
        document.getElementById('profileEmail').value = user.email;
        document.getElementById('profileFriendCode').textContent = user.friendCode || '-----';
        document.getElementById('profileHeroName').textContent = user.username;
        document.getElementById('profileHeroInitials').textContent = user.username.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'DB';
        state.user = { ...state.user, ...user };
      } catch { /* ignore — dialog still usable for password change / logout */ }
      loadProfileFriends();
      try {
        const stats = await Api.careerStats();
        const selectedLayout = localStorage.getItem('draftbox.draftLayout') || 'vertical';
        const winRate = stats.w + stats.d + stats.l > 0 ? Math.round((stats.w / (stats.w + stats.d + stats.l)) * 100) : 0;
        careerEl.innerHTML = `
          <div class="career-stat"><span class="career-value">${stats.tournaments}</span><span class="career-label">Tournaments</span></div>
          <div class="career-stat"><span class="career-value">🏆 ${stats.titles}</span><span class="career-label">Titles</span></div>
          <div class="career-stat"><span class="career-value">${stats.w}-${stats.d}-${stats.l}</span><span class="career-label">W-D-L</span></div>
          <div class="career-stat"><span class="career-value">${stats.gf}-${stats.ga}</span><span class="career-label">Goals For-Against</span></div>
          <div class="career-stat"><span class="career-value">${winRate}%</span><span class="career-label">Win Rate</span></div>
        `;
        if (insightsEl) renderProfileInsights(insightsEl, roadmapEl, stats, labelByLayout[selectedLayout] || selectedLayout);
        renderStatsChart(stats);
      } catch {
        careerEl.innerHTML = '<p class="muted">Career stats unavailable right now.</p>';
        if (insightsEl) insightsEl.innerHTML = '<div class="profile-insight-card wide"><span>Coach Note</span><b>Career insights unavailable right now.</b></div>';
        if (roadmapEl) roadmapEl.innerHTML = '<div class="profile-idea-head">Profile Game Plan</div><p class="muted">Recommendations unavailable right now.</p>';
      }
    });
    document.getElementById('btnCloseProfile').addEventListener('click', () => profileDialog.close());
    document.getElementById('btnViewHistory').addEventListener('click', () => {
      profileDialog.close();
      goMatchHistory();
    });
    document.getElementById('btnLogout').addEventListener('click', () => { profileDialog.close(); logout(); });
    document.getElementById('btnAddFriend').addEventListener('click', async () => {
      profileError.classList.add('hidden');
      const input = document.getElementById('friendCodeInput');
      const friendCode = input.value.trim().toUpperCase();
      try {
        await Api.addFriend(friendCode);
        input.value = '';
        toast('Friend request sent');
        loadProfileFriends();
      } catch (e) {
        profileError.textContent = e.message;
        profileError.classList.remove('hidden');
      }
    });
    const friendProfileDialog = document.getElementById('friendProfileDialog');
    const friendProfileUsername = document.getElementById('friendProfileUsername');
    const friendProfileCareer = document.getElementById('friendProfileCareer');

    document.getElementById('btnCloseFriendProfile').addEventListener('click', () => friendProfileDialog.close());

    document.getElementById('profileFriends').addEventListener('click', async (e) => {
      const friendName = e.target.closest('.friend-name');
      if(friendName) {
        const friendId = friendName.dataset.friendId;
        const friendUsername = friendName.textContent;
        friendProfileUsername.textContent = `${friendUsername}'s Career`;
        friendProfileCareer.innerHTML = '<p class="muted">Loading...</p>';
        friendProfileDialog.showModal();
        const stats = await Api.getUserStats(friendId);
        
        const winRate = stats.w + stats.d + stats.l > 0 ? Math.round((stats.w / (stats.w + stats.d + stats.l)) * 100) : 0;
        friendProfileCareer.innerHTML = `
          <div class="career-stat"><span class="career-value">${stats.tournaments}</span><span class="career-label">Tournaments</span></div>
          <div class="career-stat"><span class="career-value">🏆 ${stats.titles}</span><span class="career-label">Titles</span></div>
          <div class="career-stat"><span class="career-value">${stats.w}-${stats.d}-${stats.l}</span><span class="career-label">W-D-L</span></div>
          <div class="career-stat"><span class="career-value">${stats.gf}-${stats.ga}</span><span class="career-label">Goals For-Against</span></div>
          <div class="career-stat" style="grid-column: 1 / -1;"><span class="career-value">${winRate}%</span><span class="career-label">Win Rate</span></div>
        `;

        const ctx = document.getElementById('friendStatsChart').getContext('2d');
        if (friendStatsChart) friendStatsChart.destroy();
        friendStatsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
            labels: ['Wins', 'Draws', 'Losses'],
            datasets: [{
                data: [stats.w, stats.d, stats.l],
                backgroundColor: [
                'rgba(34, 197, 94, 0.7)',
                'rgba(255, 255, 255, 0.5)',
                'rgba(240, 69, 90, 0.7)'
                ],
                borderColor: [
                '#22c55e',
                '#ffffff',
                '#f0455a'
                ],
                borderWidth: 1
            }]
            },
            options: {
            responsive: true,
            plugins: {
                legend: {
                position: 'top',
                },
                title: {
                display: true,
                text: 'Match Record'
                }
            }
            }
        });

        return;
      }

      const btn = e.target.closest('[data-friend-action]');
      if (!btn) return;
      profileError.classList.add('hidden');
      try {
        await Api.respondFriend(Number(btn.dataset.friendId), btn.dataset.friendAction);
        loadProfileFriends();
      } catch (err) {
        profileError.textContent = err.message;
        profileError.classList.remove('hidden');
      }
    });
    document.getElementById('btnChangePassword').addEventListener('click', async () => {
      profileError.classList.add('hidden');
      const currentPassword = document.getElementById('profileCurrentPassword').value;
      const newPassword = document.getElementById('profileNewPassword').value;
      if (!currentPassword || !newPassword) {
        profileError.textContent = 'Fill in both password fields';
        profileError.classList.remove('hidden');
        return;
      }
      try {
        await Api.changePassword(currentPassword, newPassword);
        document.getElementById('profileCurrentPassword').value = '';
        document.getElementById('profileNewPassword').value = '';
        toast('Password updated');
      } catch (e) {
        profileError.textContent = e.message;
        profileError.classList.remove('hidden');
      }
    });

    const token = sessionStorage.getItem('draftbox.token');
    if (!token) return goAuth();

    try {
      const { user } = await Api.me();
      state.user = user;
      setHeader();
    } catch {
      return goAuth();
    }

    const hash = location.hash.replace(/^#\/?/, '');
    const [view, code] = hash.split('/');
    if (state.user?.role === 'admin') return goAdmin(view === 'admin' ? code || 'overview' : view === 'tactics' ? 'tactics' : 'overview');
    if (view === 'lobby' && code) return goLobby(code);
    if (view === 'draft' && code) return goDraft(code);
    if (view === 'tournament' && code) return goTournament(code);
    if (view === 'history') return goMatchHistory();
    if (view === 'tactics') return goTactics();
    if (view === 'admin') return goAdmin();
    goDashboard();
  }

  return { state, init, onAuthed, logout, goAuth, goDashboard, goLobby, goDraft, goTournament, goMatchHistory, goTactics, goAdmin, ensureSocket, onSocket, toast };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
