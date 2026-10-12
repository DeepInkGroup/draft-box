const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '..', '..', 'web', 'js', 'config.js'), 'utf8');
function browser(origin, deployed = '', saved = '') {
  const values = new Map(saved ? [['draftbox.apiBase', saved]] : []);
  const context = vm.createContext({
    URL,
    window: { location: new URL(origin), DRAFTBOX_CONFIG: { apiBase: deployed } },
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    }
  });
  vm.runInContext(source, context);
  return context;
}

test('full-server and Codespaces pages connect to their own origin without localhost settings', () => {
  for (const origin of ['http://localhost:4321', 'https://game.example.test', 'https://draft-box-4321.app.github.dev']) {
    const context = browser(origin);
    assert.equal(context.getApiBase(), origin);
  }
  const context = browser('https://game.example.test', '', 'http://localhost:4321');
  assert.equal(context.getApiBase(), 'https://game.example.test');
});

test('Pages uses the deployment server, accepts overrides and restores the default when cleared', () => {
  const context = browser('https://deepinkgroup.github.io', 'https://game.example.test', 'http://localhost:4321');
  assert.equal(context.getApiBase(), 'https://game.example.test');
  context.setApiBase('https://other.example.test/api/');
  assert.equal(context.getApiBase(), 'https://other.example.test');
  assert.throws(() => context.setApiBase('http://insecure.example.test'), /HTTPS/);
  assert.throws(() => context.setApiBase('javascript:alert(1)'), /http/);
  assert.equal(context.getApiBase(), 'https://other.example.test');
  context.setApiBase('');
  assert.equal(context.getApiBase(), 'https://game.example.test');
});
