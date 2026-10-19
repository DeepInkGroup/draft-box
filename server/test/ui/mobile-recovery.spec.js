const { test, expect } = require('@playwright/test');
const path = require('node:path');
test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
async function setup(page, token) {
  await page.route('https://cdn.socket.io/**', route => route.fulfill({ path: path.join(__dirname, '../../node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']) await page.route(`https://${host}/**`, route => route.abort());
  await page.addInitScript(token => {
    sessionStorage.setItem('draftbox.token', token);
    const start = window.setInterval.bind(window), stop = window.clearInterval.bind(window);
    window.reportTimers = new Set();
    window.setInterval = (fn, delay, ...args) => { const id = start(fn, delay, ...args); if ([180,650].includes(delay)) reportTimers.add(id); return id; };
    window.clearInterval = id => { reportTimers.delete(id); stop(id); };
  }, token);
}
for (const width of [320, 390]) test(`mobile room recovery across lobby, draft and live match at ${width}px`, { timeout: 90000 }, async ({ page, browser, request }) => {
  const suffix = width + '_' + Date.now().toString().slice(-6);
  const register = async prefix => {
    const username = prefix + suffix;
    const response = await request.post('/api/auth/register', { data: { username, email: username + '@test.invalid', password: 'test-password' } });
    expect(response.status()).toBe(201); return response.json();
  };
  const host = await register('longhost_'), guest = await register('longpeer_');
  await page.setViewportSize({ width, height: 850 });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4322', viewport: { width, height: 850 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), friend = await context.newPage();
  const errors = []; for (const player of [page, friend]) player.on('pageerror', error => errors.push(error.message));
  const post = async (url, user, data = {}) => {
    const response = await request.post(url, { headers: { Authorization: 'Bearer ' + user.token }, data });
    expect(response.ok()).toBe(true); return response.json();
  };
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const disconnect = async () => {
    await page.context().setOffline(true);
    await page.evaluate(() => App.state.socket.io.engine.close());
    await expect(page.locator('.room-connection')).toBeVisible();
    expect(await page.locator('#app').evaluate(el => el.inert)).toBe(true);
  };
  const reconnect = async () => {
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('.room-connection')).toBeHidden();
    expect(await page.locator('#app').evaluate(el => el.inert)).toBe(false);
  };
  try {
    await setup(page, host.token); await setup(friend, guest.token);
    const { leagues } = await (await request.get('/api/leagues')).json(); const clubs = leagues.find(item => item.id === 'pgl').teams;
    const create = async squadMode => {
      const room = await post('/api/rooms', host, { mode: 'league', leagueId: 'pgl', squadMode, clubCode: clubs[0].code, transferEnabled: false, endTransferEnabled: false, pickTimeMs: 0 });
      await post('/api/rooms/' + room.code + '/join', guest, { clubCode: clubs[1].code }); return room.code;
    };
    let code = await create('draft');
    await page.goto('/#lobby/' + code); await friend.goto('/#lobby/' + code);
    await expect(page.locator('#memberList li')).toHaveCount(2);
    await disconnect();
    await post('/api/rooms/' + code + '/start', host);
    await expect(friend.locator('#squadProgress')).toContainText('0');
    await reconnect(); await expect(page.locator('.player-card:not(.unavailable)').first()).toBeVisible();
    // A second drop happens while already drafting. On return, picks work again.
    await disconnect();
    await friend.locator('.player-card:not(.unavailable)').first().click();
    if (await friend.locator('.slot-choice-btn').count()) await friend.locator('.slot-choice-btn').first().click();
    await reconnect();
    await page.locator('.player-card:not(.unavailable)').first().click();
    if (await page.locator('.slot-choice-btn').count()) await page.locator('.slot-choice-btn').first().click();
    await expect(page.locator('#squadProgress')).toContainText('1 / 11');
    code = await create('real');
    for (const player of [page, friend]) await player.evaluate(code => App.goLobby(code), code);
    await expect(page.locator('#btnStart')).toBeVisible(); await page.locator('#btnStart').click();
    for (const player of [page, friend]) { await expect(player.locator('#squadProgress')).toContainText('11'); await player.locator('#btnLockTacticalStyle').click(); }
    await page.locator('#btnStartTournament').click();
    for (const player of [page, friend]) await player.locator('#btnEnterTournament').click();
    for (const user of [host, guest]) {
      const row = page.locator('#leagueZone tbody tr').filter({ hasText: '@' + user.user.username });
      await expect(row).toHaveCount(1); await expect(row.locator('.club-manager')).toBeVisible();
    }
    await expect(page.locator('#leagueZone tbody .club-manager')).toHaveCount(2);
    await fits(); await page.locator('#leagueZone').screenshot({ path: `test-results/online-managers-${width}.png` });
    await page.locator('#btnContinue').click(); await expect(page.locator('#btnSkipLive')).toBeVisible();
    await expect(page.locator('#liveZone .club-manager').first()).toBeVisible(); await fits();
    expect(await page.evaluate(() => reportTimers.size)).toBe(1);
    await disconnect(); expect(await page.evaluate(() => reportTimers.size)).toBe(0);
    await reconnect(); await expect(page.locator('#leagueZone')).toContainText('Matchday 1 / 34');
    await expect(page.locator('#btnSkipLive')).toBeHidden(); await expect(page.locator('#btnContinue')).toBeEnabled();
    expect(await page.evaluate(() => reportTimers.size)).toBe(0);
    await page.locator('#btnContinue').click(); await expect(page.locator('#btnSkipLive')).toBeVisible();
    // Restoring a browser-cached phone page also resynchronizes and cancels its old report.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect(page.locator('#leagueZone')).toContainText('Matchday 2 / 34');
    await expect(page.locator('#btnSkipLive')).toBeHidden(); expect(await page.evaluate(() => reportTimers.size)).toBe(0);
    await fits();
    await disconnect(); await page.locator('#btnHome').click();
    await expect(page.locator('#modeCreate')).toBeVisible(); await expect(page.locator('.room-connection')).toHaveCount(0);
    expect(await page.locator('#app').evaluate(el => el.inert)).toBe(false);
    await page.context().setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
    expect(await page.evaluate(() => App.state.roomCode)).toBe(null);
    expect(errors).toEqual([]);
  } finally { await page.context().setOffline(false); await context.close(); }
});
