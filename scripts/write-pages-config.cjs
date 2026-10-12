const fs = require('node:fs');
const path = require('node:path');

let apiBase = (process.env.DRAFTBOX_API_BASE || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
if (apiBase) {
  const url = new URL(apiBase);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('DRAFTBOX_API_BASE must be the HTTPS origin of your game server, such as https://your-service.onrender.com');
  }
  apiBase = url.origin;
} else {
  console.warn('::warning::DRAFTBOX_API_BASE is unset. Pages visitors will need to enter the server address in settings.');
}
fs.writeFileSync(path.join(__dirname, '..', 'web', 'js', 'deploy-config.js'),
  `window.DRAFTBOX_CONFIG = ${JSON.stringify({ apiBase })};\n`);
