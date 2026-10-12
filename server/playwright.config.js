const { defineConfig } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const chrome = process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : null;
module.exports = defineConfig({
  testDir: './test/ui',
  timeout: 45000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4322', launchOptions: chrome && fs.existsSync(chrome) ? { executablePath: chrome } : {} },
  webServer: {
    command: 'node src/index.js', url: 'http://127.0.0.1:4322/api/health', reuseExistingServer: false,
    env: { PORT: '4322', DB_PATH: path.join(os.tmpdir(), `draftbox-ui-${Date.now()}.sqlite`), JWT_SECRET: 'ui-test-secret' }
  }
});
