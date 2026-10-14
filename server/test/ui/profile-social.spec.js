const { test, expect } = require('@playwright/test');
const path = require('node:path');
async function assets(page) {
  await page.route('https://cdn.socket.io/**', route => route.fulfill({ path: path.join(__dirname, '../../node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']) await page.route(`https://${host}/**`, route => route.abort());
}
async function account(request, username) {
  const response = await request.post('/api/auth/register', { data: { username, email: username + '@example.test', password: 'test-password' } });
  expect(response.status()).toBe(201); return response.json();
}
async function signIn(page, user) { await assets(page); await page.addInitScript(token => sessionStorage.setItem('draftbox.token', token), user.token); }
for (const width of [1280, 390]) {
  test(`email updates and clan membership work at ${width}px`, async ({ page, browser, request }) => {
    await page.setViewportSize({ width, height: 900 });
    const suffix = width + '_' + Date.now().toString().slice(-6), tag = width === 1280 ? 'SOC1' : 'SOC2';
    const owner = await account(request, 'social_' + suffix), guest = await account(request, 'socialg_' + suffix);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4322', viewport: { width, height: 900 } });
    const friend = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message)); friend.on('pageerror', error => errors.push(error.message));
    try {
      await signIn(page, owner); await signIn(friend, guest); await page.goto('/'); await friend.goto('/');
      await page.locator('#btnProfile').click(); await page.locator('#profileTab-security').click();
      await expect(page.locator('#profileEmail')).toBeEnabled();
      const newEmail = 'new_' + suffix + '@example.test';
      await page.locator('#profileEmail').fill(newEmail); await page.locator('#profileEmailPassword').fill('wrong-password'); await page.locator('#btnUpdateEmail').click();
      await expect(page.locator('#profileEmailMessage')).toContainText('incorrect');
      await page.locator('#profileEmailPassword').fill('test-password'); await page.locator('#btnUpdateEmail').click();
      await expect(page.locator('#profileEmailMessage')).toContainText('updated successfully');
      await expect(page.locator('#profileEmailPassword')).toHaveValue('');
      const login = await request.post('/api/auth/login', { data: { username: newEmail.toUpperCase(), password: 'test-password' } });
      expect(login.status()).toBe(200); expect((await login.json()).user.id).toBe(owner.user.id);
      await page.locator('#btnCloseProfile').click(); await page.locator('#btnProfile').click(); await page.locator('#profileTab-security').click();
      await expect(page.locator('#profileEmail')).toHaveValue(newEmail);
      await page.screenshot({ path: `test-results/profile-email-${width}.png` });
      await page.locator('#profileTab-clan').click();
      await page.locator('#clanCreateForm [name="name"]').fill('Football Friends'); await page.locator('#clanCreateForm [name="tag"]').fill(tag);
      await page.locator('#clanCreateForm [name="description"]').fill('<img src=x onerror="window.clanExecuted=true">');
      await page.locator('#clanCreateForm button[type="submit"]').click();
      await expect(page.locator('#profileClanBadge')).toContainText(tag); await expect(page.locator('.clan-members li')).toHaveCount(1);
      await expect(page.locator('.clan-description')).toContainText('<img'); await expect(page.locator('#profileClanContent img')).toHaveCount(0);
      expect(await page.evaluate(() => window.clanExecuted)).toBeUndefined();
      await friend.locator('#btnProfile').click(); await friend.locator('#profileTab-clan').click();
      await friend.locator('#clanJoinForm [name="tag"]').fill(tag.toLowerCase()); await friend.locator('#clanJoinForm button[type="submit"]').click();
      await expect(friend.locator('.clan-members li')).toHaveCount(2); await expect(friend.locator('#clanEditForm')).toHaveCount(0);
      await page.locator('#clanRefresh').click(); await expect(page.locator('.clan-members li')).toHaveCount(2);
      await page.locator('#clanEditForm [name="name"]').fill('Matchday Crew'); await page.locator('#clanEditForm button[type="submit"]').click();
      await expect(page.locator('#clanMessage')).toContainText('saved');
      await friend.locator('#clanRefresh').click(); await expect(friend.locator('.clan-summary')).toContainText('Matchday Crew');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/profile-clan-${width}.png` });
      await page.locator('#clanLeave').click(); await expect(page.locator('#clanCreateForm')).toBeVisible(); await expect(page.locator('#profileClanBadge')).toBeHidden();
      await friend.locator('#clanRefresh').click(); await expect(friend.locator('#clanEditForm')).toBeVisible();
      await friend.locator('#clanLeave').click(); await expect(friend.locator('#clanJoinForm')).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('club chooser removes a club selected by another user while it is open', async ({ page, request }) => {
  const stamp = Date.now().toString().slice(-6);
  const host = await account(request, 'watchh_' + stamp), guest = await account(request, 'watchg_' + stamp), third = await account(request, 'watcht_' + stamp);
  const league = (await (await request.get('/api/leagues')).json()).leagues[0];
  const room = await (await request.post('/api/rooms', { headers: { Authorization: `Bearer ${host.token}` }, data: { mode: 'league', leagueId: 'pgl', clubCode: league.teams[0].code, humanSlotsMax: 3 } })).json();
  await signIn(page, guest); await page.goto('/'); await page.locator('#modeJoin').click(); await page.locator('#joinCode').fill(room.code); await page.locator('#btnJoinRoom').click();
  const chosen = await page.locator('#joinClub').inputValue();
  expect((await request.post(`/api/rooms/${room.code}/join`, { headers: { Authorization: `Bearer ${third.token}` }, data: { clubCode: chosen } })).status()).toBe(200);
  await expect(page.locator('#joinClub option')).toHaveCount(16, { timeout: 12000 });
  expect(await page.locator('#joinClub option').evaluateAll(options => options.map(option => option.value))).not.toContain(chosen);
  await page.locator('#btnJoinRoom').click(); await expect(page.locator('#memberList li')).toHaveCount(3);
});

test('a peer pick disables the open player card and closes a stale position chooser', async ({ page, browser, request }) => {
  const stamp = Date.now().toString().slice(-6), host = await account(request, 'pickh_' + stamp), guest = await account(request, 'pickg_' + stamp);
  const league = (await (await request.get('/api/leagues')).json()).leagues[0];
  const headers = { Authorization: `Bearer ${host.token}` };
  const room = await (await request.post('/api/rooms', { headers, data: { mode: 'league', leagueId: 'pgl', clubCode: league.teams[0].code, pickTimeMs: 0 } })).json();
  await request.post(`/api/rooms/${room.code}/join`, { headers: { Authorization: `Bearer ${guest.token}` }, data: { clubCode: league.teams[1].code } });
  await request.post(`/api/rooms/${room.code}/start`, { headers });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4322' }), peer = await context.newPage();
  try {
    await signIn(page, host); await signIn(peer, guest); await page.goto('/#/draft/' + room.code); await peer.goto('/#/draft/' + room.code);
    await expect(page.locator('#playerGrid')).toBeVisible(); await expect(peer.locator('#playerGrid')).toBeVisible();
    const reveal = await page.evaluate(code => new Promise(resolve => { const socket = App.state.socket; socket.once('draft:reveal', resolve); socket.emit('draft:reveal', { code }); }), room.code);
    // A deterministic view fixture covers the naturally occurring case where both users reveal the same source club.
    // The pick and peer pool update below use the real server and two authenticated connections.
    await peer.evaluate(payload => App.state.socket.listeners('draft:reveal')[0](payload), reveal);
    const positions = require('../../src/game/formations');
    const candidate = reveal.players.find(player => player.available && reveal.openSlots.filter(slot => positions.playerFitsSlot(player, slot)).length > 1);
    expect(candidate).toBeTruthy();
    await peer.locator(`[data-id="${candidate.id}"]`).click(); await expect(peer.locator('#slotChoice')).toBeVisible();
    await page.locator(`[data-id="${candidate.id}"]`).click(); await page.locator('#slotChoice .slot-choice-btn').first().click();
    await expect(peer.locator('#slotChoice')).toHaveCount(0);
    await expect(peer.locator(`[data-id="${candidate.id}"]`)).toHaveAttribute('aria-disabled', 'true');
    await expect(peer.locator(`[data-id="${candidate.id}"]`)).toContainText('Taken');
    const state = await (await request.get(`/api/rooms/${room.code}/state`, { headers: { Authorization: `Bearer ${guest.token}` } })).json();
    expect(state.myDraft.squad).toHaveLength(0);
  } finally { await context.close(); }
});
