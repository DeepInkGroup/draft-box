const Api = (() => {
  function token() {
    // sessionStorage, not localStorage: localStorage is shared across every tab of this
    // origin, so logging in as a second user in another tab would silently overwrite the
    // first tab's token and misattribute its next action to the wrong account. sessionStorage
    // is isolated per tab, which is exactly what's needed when testing/using multiple
    // accounts (e.g. a room creator and a friend) in the same browser.
    return sessionStorage.getItem('draftbox.token');
  }

  async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(getApiBase() + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token() ? { Authorization: `Bearer ${token()}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `Server error (${res.status})`);
    return data;
  }

  return {
    register: (username, email, password) => request('/api/auth/register', { method: 'POST', body: { username, email, password } }),
    login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
    me: () => request('/api/auth/me'),
    changePassword: (currentPassword, newPassword) =>
      request('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    careerStats: () => request('/api/auth/me/career'),
    matchHistory: () => request('/api/auth/me/matches'),
    teams: () => request('/api/teams'),

    createRoom: (opts) => request('/api/rooms', { method: 'POST', body: opts }),
    createSingleplayer: (opts) => request('/api/rooms/singleplayer', { method: 'POST', body: opts }),
    joinRoom: (code, formation) => request(`/api/rooms/${code}/join`, { method: 'POST', body: { formation } }),
    setFormation: (code, formation) => request(`/api/rooms/${code}/formation`, { method: 'POST', body: { formation } }),
    startDraft: (code) => request(`/api/rooms/${code}/start`, { method: 'POST' }),
    getRoom: (code) => request(`/api/rooms/${code}`),
    getRoomState: (code) => request(`/api/rooms/${code}/state`)
  };
})();
