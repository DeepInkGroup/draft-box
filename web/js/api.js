const Api = (() => {
  function token() {
    return localStorage.getItem('draftbox.token');
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

    createRoom: (name, humanSlotsMax, formation) => request('/api/rooms', { method: 'POST', body: { name, humanSlotsMax, formation } }),
    createSingleplayer: (formation) => request('/api/rooms/singleplayer', { method: 'POST', body: { formation } }),
    joinRoom: (code, formation) => request(`/api/rooms/${code}/join`, { method: 'POST', body: { formation } }),
    setFormation: (code, formation) => request(`/api/rooms/${code}/formation`, { method: 'POST', body: { formation } }),
    startDraft: (code) => request(`/api/rooms/${code}/start`, { method: 'POST' }),
    getRoom: (code) => request(`/api/rooms/${code}`),
    getRoomState: (code) => request(`/api/rooms/${code}/state`)
  };
})();
