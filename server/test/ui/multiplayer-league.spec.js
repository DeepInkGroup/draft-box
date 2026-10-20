const { test, expect } = require('@playwright/test');
const path = require('node:path');
async function assets(page) {
  await page.route('https://cdn.socket.io/**', route => route.fulfill({ path: path.join(__dirname, '../../node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']) await page.route(`https://${host}/**`, route => route.abort());
}
const choose = (page, id, value) => page.locator(`#${id} [data-value="${value}"]`).click();
async function fits(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
async function round(page, day) {
  await page.locator('#btnContinue').click();
  await expect(page.locator('#btnSkipLive')).toBeVisible();
  await page.locator('#btnSkipLive').click();
  await expect(page.locator('#btnSkipLive')).toBeHidden();
  await expect(page.locator('#leagueZone')).toContainText(`Matchday ${day} / 34`);
}
for (const width of [1280, 390]) {
  test(`two players create, join and play a league with shared transfers at ${width}px`, { timeout: 150000 }, async ({ page, browser, request }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width, height: 900 });
    const suffix = width + '_' + Date.now().toString().slice(-6);
    const register = async name => (await (await request.post('/api/auth/register', { data: { username: name, email: name + '@example.test', password: 'test-password' } })).json());
    const host = await register('mp_host_' + suffix), guest = await register('mp_guest_' + suffix);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4322', viewport: { width, height: 900 } });
    const friend = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message)); friend.on('pageerror', error => errors.push(error.message));
    try {
      await assets(page); await assets(friend);
      await page.addInitScript(token => sessionStorage.setItem('draftbox.token', token), host.token);
      await friend.addInitScript(token => sessionStorage.setItem('draftbox.token', token), guest.token);
      await page.goto('/'); await friend.goto('/');
      await page.locator('#modeCreate').click();
      await expect(page.locator('#crTimer .toggle-option')).toHaveCount(5);
      await choose(page, 'crMode', 'league'); await page.locator('#btnSelectLeague').click();
      await expect(page.locator('#crClub option')).toHaveCount(18);
      await expect(page.locator('#crSlots')).toHaveAttribute('max', '18');
      await expect(page.locator('#app')).not.toContainText('AI team transfers');
      await expect(page.locator('#crMidseasonTactics, #crEndseasonTactics, #crMidseasonFormations')).toHaveCount(3);
      await expect(page.locator('#crAiTransfers, #crEndAiTransfers')).toHaveCount(0);
      await choose(page, 'crSquadMode', 'real');
      await choose(page, 'crTransferLimit', '1');
      await choose(page, 'crEndTransfers', 'true'); await choose(page, 'crEndTransferLimit', '1');
      await expect(page.locator('#crManagerOffers [data-value="false"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#crPlayerDepartures [data-value="false"]')).toHaveAttribute('aria-pressed', 'true');
      if (width === 390) { await choose(page, 'crManagerOffers', 'true'); await choose(page, 'crPlayerDepartures', 'true'); }
      await page.locator('#crSlots').fill('2'); await page.locator('#crName').fill('Friends PGL');
      const hostClub = await page.locator('#crClub').inputValue();
      await fits(page); await page.screenshot({ path: `test-results/multiplayer-league-setup-${width}.png`, fullPage: true });
      await page.locator('#btnCreateRoom').click(); await expect(page.locator('.code-display')).toBeVisible();
      const code = (await page.locator('.code-display').textContent()).trim();
      await friend.locator('#modeJoin').click(); await friend.locator('#joinCode').fill(code); await friend.locator('#btnJoinRoom').click();
      await expect(friend.locator('#joinClub')).toBeVisible();
      expect(await friend.locator('#joinClub option').evaluateAll(options => options.map(option => option.value))).not.toContain(hostClub);
      await expect(friend.locator('#joinClub option')).toHaveCount(17);
      await friend.locator('#btnJoinRoom').click();
      await expect(page.locator('#memberList li')).toHaveCount(2); await expect(friend.locator('#memberList li')).toHaveCount(2);
      await expect(page.locator('#lobbyLeagueSettings')).toContainText('Persian Gulf League');
      await expect(page.locator('#lobbyLeagueSettings')).toContainText('AI club manager offers: ' + (width === 390 ? 'On' : 'Off'));
      await expect(page.locator('#lobbySlots')).toHaveText('2 / 2');
      await fits(friend); await page.screenshot({ path: `test-results/multiplayer-league-lobby-${width}.png`, fullPage: true });
      await page.locator('#btnStart').click();
      for (const player of [page, friend]) { await expect(player.locator('#squadProgress')).toContainText('11'); await player.locator('#btnLockTacticalStyle').click(); }
      await page.locator('#btnStartTournament').click();
      for (const player of [page, friend]) {
        await player.locator('#btnEnterTournament').click();
        await expect(player.locator('#btnSkipToTransfers')).toBeHidden(); await expect(player.locator('#btnFinishLeague')).toBeHidden();
        await expect(player.locator('#leagueZone tbody .club-manager')).toHaveCount(2);
        for (const user of [host, guest]) await expect(player.locator('#leagueZone tbody')).toContainText('@' + user.user.username);
        await expect(player.locator('.league-next-fixture .club-manager').first()).toBeVisible();
        await fits(player);
      }
      for (let day = 1; day <= 17; day++) { await round(page, day); await round(friend, day); }
      for (const player of [page, friend]) {
        await expect(player.locator('#transferZone')).toBeVisible();
        await player.locator('[data-release]').first().click(); await player.locator('#btnReleasePlayers').click();
        await expect(player.locator('#transferPick0 button')).toHaveCount(2);
      }
      const offers = await page.locator('#transferPick0 button').evaluateAll(buttons => buttons.map(button => button.dataset.player));
      const otherOffers = await friend.locator('#transferPick0 button').evaluateAll(buttons => buttons.map(button => button.dataset.player));
      expect(new Set([...offers, ...otherOffers]).size).toBe(4);
      await page.locator('#transferPick0 button').first().click(); await page.locator('#btnSignPlayers').click();
      await expect(page.locator('#btnContinue')).toHaveText('Waiting for player transfers'); await expect(page.locator('#btnContinue')).toBeDisabled();
      await expect(page.locator('#leagueTransferWaiting')).toContainText(guest.user.username);
      await page.reload(); await expect(page.locator('#leagueTransferWaiting')).toContainText(guest.user.username);
      await expect(page.locator('#btnContinue')).toBeDisabled();
      await fits(page); await page.screenshot({ path: `test-results/multiplayer-league-transfers-${width}.png`, fullPage: true });
      await friend.locator('#transferPick0 button').last().click(); await friend.locator('#btnSignPlayers').click();
      await expect(page.locator('#btnContinue')).toBeEnabled(); await expect(page.locator('#leagueTransferWaiting')).toBeHidden();
      for (let day = 18; day <= 34; day++) { await round(page, day); await round(friend, day); }
      for (const player of [page, friend]) { await expect(player.locator('#seasonResults')).toContainText('306 matches'); await fits(player); }
      await expect(friend.locator('#btnNextLeagueSeason')).toHaveCount(0);
      await page.locator('#btnNextLeagueSeason').click();
      if (width === 390) {
        for (const player of [page, friend]) await expect(player.locator('#leagueCareerZone')).toBeVisible();
        // Reconnecting must preserve the same choices, including a summer with no offers.
        const offers = await page.locator('[data-manager-club]').evaluateAll(buttons => buttons.map(button => button.dataset.managerClub));
        expect(offers.length).toBeLessThanOrEqual(2);
        await page.reload(); await expect(page.locator('#leagueCareerZone')).toBeVisible();
        expect(await page.locator('[data-manager-club]').evaluateAll(buttons => buttons.map(button => button.dataset.managerClub))).toEqual(offers);
        if (offers.length) {
          await page.locator('[data-manager-club]').first().click();
          await expect(page.locator('#leagueCareerZone')).toContainText('Decision saved');
        }
        if (await friend.locator('#btnKeepManagerClub').count()) {
          await friend.locator('#btnKeepManagerClub').click();
          await expect(friend.locator('#leagueCareerZone')).toContainText('Decision saved');
        }
        await expect(page.locator('#btnNextLeagueSeason')).toBeEnabled();
        await fits(page); await fits(friend);
        await page.locator('#leagueCareerZone').screenshot({ path: 'test-results/league-career-390.png' });
        await page.locator('#btnNextLeagueSeason').click();
      }
      for (const player of [page, friend]) {
        await expect(player.locator('#leagueZone')).toContainText('Season 2');
        await expect(player.locator('#transferZone')).toContainText('End-of-season Transfer Window');
        await player.locator('#btnSkipTransfers').click();
      }
      await round(page, 1); await round(friend, 1);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('single-player league has no timer controls or countdown, while World Cup keeps its timer options', async ({ page, request }) => {
  await assets(page);
  const username = 'solo_timer_' + Date.now().toString().slice(-6);
  const account = await (await request.post('/api/auth/register', { data: { username, email: username + '@example.test', password: 'test-password' } })).json();
  await page.addInitScript(token => sessionStorage.setItem('draftbox.token', token), account.token);
  await page.goto('/'); await page.locator('#modeSingle').click(); await page.locator('#singleWorldCup').click();
  await expect(page.locator('#spTimer .toggle-option')).toHaveCount(5);
  await page.locator('#btnBack').click(); await page.locator('#singleLeague').click(); await page.locator('#btnSelectLeague').click();
  await expect(page.locator('#spTimer')).toHaveCount(0); await expect(page.locator('#app')).not.toContainText('Pick Timer');
  await page.locator('#btnSingleplayer').click(); await expect(page.locator('#squadProgress')).toContainText('0');
  const code = page.url().split('/').pop();
  const state = await (await request.get('/api/rooms/' + code + '/state', { headers: { Authorization: `Bearer ${account.token}` } })).json();
  expect(state.pickTimeMs).toBe(0);
  const reveal = await page.evaluate(code => new Promise(resolve => { const socket = App.state.socket; socket.once('draft:reveal', resolve); socket.emit('draft:reveal', { code }); }), code);
  expect(reveal.deadline).toBe(null); expect(reveal.pickTimeMs).toBe(0);
});
