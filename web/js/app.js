const App = (() => {
  const state = { user: null, socket: null, roomCode: null };
  const appEl = document.getElementById('app');
  const homeBtn = document.getElementById('btnHome');
  const profileBtn = document.getElementById('btnProfile');
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.style.background = isError ? 'var(--danger)' : 'var(--ink)';
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3500);
  }

  function setHeader() {
    profileBtn.classList.toggle('hidden', !state.user);
    homeBtn.classList.toggle('hidden', !state.user);
  }

  function ensureSocket() {
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
    location.hash = '';
    DashboardView.render(appEl);
    if (startMode === 'create') DashboardView.renderCreateRoom(appEl);
  }

  function goLobby(code) {
    state.roomCode = code;
    location.hash = `lobby/${code}`;
    LobbyView.render(appEl, code);
  }

  function goDraft(code) {
    state.roomCode = code;
    location.hash = `draft/${code}`;
    DraftView.render(appEl, code);
  }

  function goTournament(code) {
    state.roomCode = code;
    location.hash = `tournament/${code}`;
    TournamentView.render(appEl, code);
  }

  function goMatchHistory() {
    location.hash = 'history';
    MatchHistoryView.render(appEl);
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
    const totalMatches = stats.w + stats.d + stats.l;
    const winRate = totalMatches > 0 ? Math.round((stats.w / totalMatches) * 100) : 0;
    const lossRate = totalMatches > 0 ? Math.round((stats.l / totalMatches) * 100) : 0;
    const titleRate = stats.tournaments > 0 ? Math.round((stats.titles / stats.tournaments) * 100) : 0;
    const goalDiff = stats.gf - stats.ga;
    const goalsPerMatch = totalMatches > 0 ? (stats.gf / totalMatches).toFixed(1) : '0.0';
    const goalsAgainstPerMatch = totalMatches > 0 ? (stats.ga / totalMatches).toFixed(1) : '0.0';
    const attackIndex = Math.min(99, Math.round(Number(goalsPerMatch) * 28 + Math.max(goalDiff, 0) * 2));
    const controlIndex = Math.max(1, Math.min(99, Math.round(86 - Number(goalsAgainstPerMatch) * 24 + Math.max(goalDiff, 0) * 1.4)));
    const momentumTier = totalMatches === 0 ? 'Fresh Start' : winRate >= 65 && goalDiff > 0 ? 'Hot Run' : lossRate <= 25 ? 'Stable' : 'Volatile';
    const formLabel = totalMatches === 0 ? 'Unranked' : winRate >= 65 ? 'Title Contender' : winRate >= 45 ? 'Knockout Threat' : 'Rebuild Mode';
    const profileStyle = totalMatches === 0
      ? 'Play one tournament to unlock a style read.'
      : goalDiff >= 6
        ? 'Front-foot manager: your sides create separation over a full run.'
        : Number(goalsAgainstPerMatch) <= 1.1
          ? 'Compact manager: defensive control is carrying your results.'
          : Number(goalsPerMatch) >= 1.8
            ? 'High-event manager: strong attack, but game control still matters.'
            : 'Fine-margin manager: improve chance quality before chasing risk.';
    const coachNote = totalMatches === 0
      ? 'No finished tournaments yet. Your first completed run will unlock form notes here.'
      : winRate >= 60
        ? 'Strong tournament form. Your teams are converting enough chances to stay ahead.'
        : goalDiff < 0
          ? 'Defensive balance is the next area to clean up. Check match summaries for recurring concessions.'
          : 'Competitive record. A small upgrade in finishing can turn draws into wins.';
    const nextTarget = stats.titles > 0
      ? 'Defend the title and push your win rate higher.'
      : stats.tournaments > 0
        ? 'Reach your first final and convert one deep run into a title.'
        : 'Finish one tournament to build your career baseline.';
    const draftFocus = Number(goalsAgainstPerMatch) > 1.4
      ? 'Prioritize a natural back line, CDM cover and chemistry before chasing another attacker.'
      : Number(goalsPerMatch) < 1.4 && totalMatches > 0
        ? 'Add one high-overall creator or star forward to raise shot quality in tight games.'
        : 'Keep the core balanced: one creator, one ball-winner and clean position fit.';
    const matchPlan = winRate >= 60
      ? 'Protect leads with Balanced or Possession after minute 70 instead of over-pressing.'
      : lossRate >= 45
        ? 'Reduce risky styles against stronger squads and lean on Counter Attack as an upset plan.'
        : 'Your results are close. Use tactical matchup edges before changing the XI.';
    const milestone = stats.titles > 0
      ? `Next milestone: ${stats.titles + 1} titles and a ${Math.min(90, winRate + 5)}% win-rate push.`
      : stats.tournaments > 0
        ? 'Next milestone: first title, then build a repeatable draft identity.'
        : 'Next milestone: finish a tournament to unlock richer history reads.';
    el.innerHTML = `
      <div class="profile-insight-card wide"><span>Coach Note</span><b>${coachNote}</b></div>
      <div class="profile-insight-card"><span>Goal Diff</span><b>${goalDiff >= 0 ? '+' : ''}${goalDiff}</b></div>
      <div class="profile-insight-card"><span>Goals / Match</span><b>${goalsPerMatch}</b></div>
      <div class="profile-insight-card"><span>Conceded / Match</span><b>${goalsAgainstPerMatch}</b></div>
      <div class="profile-insight-card"><span>Title Rate</span><b>${titleRate}%</b></div>
      <div class="profile-insight-card"><span>Attack Index</span><b>${attackIndex}</b></div>
      <div class="profile-insight-card"><span>Control Index</span><b>${controlIndex}</b></div>
      <div class="profile-insight-card"><span>Momentum</span><b>${momentumTier}</b></div>
      <div class="profile-insight-card"><span>Form Label</span><b>${formLabel}</b></div>
      <div class="profile-insight-card wide"><span>Next Target</span><b>${nextTarget}</b></div>
      <div class="profile-insight-card wide"><span>Draft Setup</span><b>${layoutLabel}</b></div>
      <div class="profile-insight-card wide"><span>Manager Read</span><b>${profileStyle}</b></div>
    `;
    if (roadmapEl) {
      roadmapEl.innerHTML = `
        <div class="profile-idea-head">Profile Game Plan</div>
        <div class="profile-idea-list">
          <div><b>Draft Focus</b><span>${draftFocus}</span></div>
          <div><b>Match Plan</b><span>${matchPlan}</span></div>
          <div><b>Next Milestone</b><span>${milestone}</span></div>
        </div>
      `;
    }
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
          <div><b>${item.friend.username}</b><span>${item.friend.friendCode}</span></div>
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

    const settingsDialog = document.getElementById('settingsDialog');
    document.getElementById('btnSettings').addEventListener('click', () => {
      document.getElementById('apiBaseInput').value = getApiBase();
      settingsDialog.showModal();
    });
    document.getElementById('btnSaveSettings').addEventListener('click', (e) => {
      e.preventDefault();
      const val = document.getElementById('apiBaseInput').value.trim();
      if (val) setApiBase(val);
      settingsDialog.close();
      toast('Server address saved');
      disconnectSocket();
    });

    const rulebookDialog = document.getElementById('rulebookDialog');
    document.getElementById('btnRulebook').addEventListener('click', () => rulebookDialog.showModal());
    document.getElementById('btnCloseRulebook').addEventListener('click', () => rulebookDialog.close());

    const profileDialog = document.getElementById('profileDialog');
    const profileError = document.getElementById('profileError');
    profileBtn.addEventListener('click', async () => {
      profileError.classList.add('hidden');
      document.getElementById('profileCurrentPassword').value = '';
      document.getElementById('profileNewPassword').value = '';
      document.getElementById('profileUsername').value = state.user ? state.user.username : '';
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
          <div class="career-stat" style="grid-column: 1 / -1;"><span class="career-value">${winRate}%</span><span class="career-label">Win Rate</span></div>
        `;
        if (insightsEl) renderProfileInsights(insightsEl, roadmapEl, stats, labelByLayout[selectedLayout] || selectedLayout);
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
    document.getElementById('profileFriends').addEventListener('click', async (e) => {
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
    if (view === 'lobby' && code) return goLobby(code);
    if (view === 'draft' && code) return goDraft(code);
    if (view === 'tournament' && code) return goTournament(code);
    if (view === 'history') return goMatchHistory();
    goDashboard();
  }

  return { state, init, onAuthed, logout, goAuth, goDashboard, goLobby, goDraft, goTournament, goMatchHistory, ensureSocket, onSocket, toast };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
