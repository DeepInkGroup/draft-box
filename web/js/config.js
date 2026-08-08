// Default backend URL — override at runtime via the ⚙️ settings dialog (saved to localStorage),
// since this frontend is a static GitHub Pages site and the backend is deployed separately.
const DEFAULT_API_BASE = 'http://localhost:4321';

function getApiBase() {
  return localStorage.getItem('draftbox.apiBase') || DEFAULT_API_BASE;
}

function setApiBase(url) {
  localStorage.setItem('draftbox.apiBase', url.replace(/\/+$/, ''));
}
