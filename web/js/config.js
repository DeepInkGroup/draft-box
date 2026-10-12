// Full-server deployments use the page's origin. GitHub Pages receives the
// hosted server URL through deploy-config.js; settings can override it.
const DEFAULT_API_BASE = window.DRAFTBOX_CONFIG?.apiBase || window.location.origin;

function getApiBase() {
  const saved = localStorage.getItem('draftbox.apiBase');
  // Discard the old automatic localhost default when visiting a hosted site.
  if (saved === 'http://localhost:4321' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return DEFAULT_API_BASE;
  }
  return saved || DEFAULT_API_BASE;
}

function setApiBase(url) {
  const value = url.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  if (!value) {
    localStorage.removeItem('draftbox.apiBase');
    return;
  }
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Enter a server address starting with http:// or https://');
  }
  if (window.location.protocol === 'https:' && parsed.protocol !== 'https:') {
    throw new Error('Use an HTTPS server address for this site');
  }
  localStorage.setItem('draftbox.apiBase', value);
}
