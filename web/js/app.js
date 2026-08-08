const App = (() => {
  const state = { user: null, socket: null, roomCode: null };
  const appEl = document.getElementById('app');
  const whoamiEl = document.getElementById('whoami');
  const logoutBtn = document.getElementById('btnLogout');
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
    if (state.user) {
      whoamiEl.textContent = `👤 ${state.user.username}`;
      whoamiEl.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      whoamiEl.classList.add('hidden');
      logoutBtn.classList.add('hidden');
    }
  }

  function ensureSocket() {
    if (state.socket) return state.socket;
    state.socket = io(getApiBase(), { auth: { token: localStorage.getItem('draftbox.token') } });
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

  function goDashboard() {
    location.hash = '';
    DashboardView.render(appEl);
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
    localStorage.setItem('draftbox.token', token);
    state.user = user;
    setHeader();
    toast(`Welcome, ${user.username}!`);
    goDashboard();
  }

  function logout() {
    localStorage.removeItem('draftbox.token');
    goAuth();
  }

  async function init() {
    logoutBtn.addEventListener('click', logout);

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

    const token = localStorage.getItem('draftbox.token');
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
