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
      const careerEl = document.getElementById('profileCareer');
      careerEl.innerHTML = '<p class="muted">Loading...</p>';
      profileDialog.showModal();
      try {
        const { user } = await Api.me();
        document.getElementById('profileEmail').value = user.email;
      } catch { /* ignore — dialog still usable for password change / logout */ }
      try {
        const stats = await Api.careerStats();
        const winRate = stats.w + stats.d + stats.l > 0 ? Math.round((stats.w / (stats.w + stats.d + stats.l)) * 100) : 0;
        careerEl.innerHTML = `
          <div class="career-stat"><span class="career-value">${stats.tournaments}</span><span class="career-label">Tournaments</span></div>
          <div class="career-stat"><span class="career-value">🏆 ${stats.titles}</span><span class="career-label">Titles</span></div>
          <div class="career-stat"><span class="career-value">${stats.w}-${stats.d}-${stats.l}</span><span class="career-label">W-D-L</span></div>
          <div class="career-stat"><span class="career-value">${stats.gf}-${stats.ga}</span><span class="career-label">Goals For-Against</span></div>
          <div class="career-stat" style="grid-column: 1 / -1;"><span class="career-value">${winRate}%</span><span class="career-label">Win Rate</span></div>
        `;
      } catch {
        careerEl.innerHTML = '<p class="muted">Career stats unavailable right now.</p>';
      }
    });
    document.getElementById('btnCloseProfile').addEventListener('click', () => profileDialog.close());
    document.getElementById('btnLogout').addEventListener('click', () => { profileDialog.close(); logout(); });
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
    goDashboard();
  }

  return { state, init, onAuthed, logout, goAuth, goDashboard, goLobby, goDraft, goTournament, ensureSocket, onSocket, toast };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
