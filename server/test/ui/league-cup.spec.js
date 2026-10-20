const { test, expect } = require('@playwright/test');
const path = require('node:path');
async function setup(page, token) {
  await page.route('https://cdn.socket.io/**', route => route.fulfill({ path: path.join(__dirname, '../../node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']) await page.route(`https://${host}/**`, route => route.abort());
  await page.addInitScript(token => {
    sessionStorage.setItem('draftbox.token', token);
    const start = setTimeout.bind(window), stop = clearTimeout.bind(window), timers = new Map();
    window.setTimeout = (fn, delay, ...args) => {
      if (delay === 2000 && String(fn).includes('requestAutomaticResults')) {
        const id = start(() => {}, 2147483647); timers.set(id, () => { stop(id); timers.delete(id); fn(...args); }); return id;
      } return start(fn, delay, ...args);
    };
    window.clearTimeout = id => { timers.delete(id); stop(id); };
    window.nextCupRound = () => { const next = timers.values().next().value; if (next) next(); };
    window.cupRoundWaiting = () => timers.size > 0;
  }, token);
}
const choose = (page, id, value) => page.locator('#' + id + ' [data-value="' + value + '"]').click();
const fits = async page => {
  const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    textOverflow: (() => { const result = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const node = walker.currentNode; if (node.parentElement.closest('.table-scroll')) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        if ([...range.getClientRects()].some(rect => rect.right > innerWidth + 1)) result.push({ text: node.textContent.slice(0, 120), parent: node.parentElement.className });
      } return result.slice(0, 10); })(),
    overflow: document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll('body *')]
      .filter(el => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.table-scroll')).slice(0, 30)
      .map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width, text: el.innerText?.slice(0, 80) })) : [] }));
  expect(layout.scrollWidth, JSON.stringify({ elements: layout.overflow, text: layout.textOverflow })).toBeLessThanOrEqual(layout.width);
};
async function register(request, prefix) {
  const username = prefix + Date.now().toString().slice(-8);
  const response = await request.post('/api/auth/register', { data: { username, email: username + '@test.invalid', password: 'test-password' } });
  expect(response.status()).toBe(201); return response.json();
}

test('solo mobile cup draws sixteen clubs, plays each round and crowns a separate champion', async ({ page, request }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 320, height: 900 });
  const account = await register(request, 'cup_s_'), errors = [];
  page.on('pageerror', error => errors.push(error.message)); await setup(page, account.token); await page.goto('/');
  await page.locator('#modeSingle').click(); await page.locator('#singleLeague').click(); await page.locator('#btnSelectLeague').click();
  await expect(page.locator('#spKnockoutCup [data-value="false"]')).toHaveAttribute('aria-pressed', 'true');
  await choose(page, 'spKnockoutCup', true); await choose(page, 'spSquadMode', 'real'); await choose(page, 'spTransfers', false);
  await fits(page); await page.locator('#btnSingleplayer').click(); await page.locator('#btnLockTacticalStyle').click();
  await page.locator('#btnEnterTournament').click();
  await page.locator('#btnSkipToTransfers').click(); await expect(page.locator('#btnFinishLeague')).toHaveText('Finish League & Start Cup');
  await page.locator('#btnFinishLeague').click();
  await expect(page.locator('#leagueZone')).toContainText('Matchday 34 / 34');
  await expect(page.locator('#seasonResults')).toContainText('306 matches');
  await expect(page.locator('#leagueCupZone .cup-fixture')).toHaveCount(8);
  await expect(page.locator('#btnNextLeagueSeason')).toHaveCount(0); await expect(page.locator('#btnRematch')).toHaveCount(0);
  const pairs = await page.locator('#leagueCupZone .cup-fixture').allTextContents();
  await fits(page); await page.locator('#leagueCupZone').screenshot({ path: 'test-results/cup-draw-320.png' });
  await page.reload(); await expect(page.locator('#leagueCupZone .cup-fixture')).toHaveCount(8);
  expect(await page.locator('#leagueCupZone .cup-fixture').allTextContents()).toEqual(pairs);
  const table = await page.locator('#leagueZone tbody').textContent();
  for (const round of ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final']) {
    await expect(page.locator('#btnContinue')).toHaveText('Play Cup - ' + round); await page.locator('#btnContinue').click();
    const heading = page.locator('#stepCard h3').filter({ hasText: 'PGL Knockout Cup - ' + round });
    await expect.poll(async () => await page.locator('#btnSkipLive').isVisible() || await heading.isVisible()).toBe(true);
    if (await page.locator('#btnSkipLive').isVisible()) await page.locator('#btnSkipLive').click();
    await expect(heading).toBeVisible(); await fits(page);
  }
  await expect(page.locator('#cupChampion')).toContainText('PGL Knockout Cup Champion');
  await expect(page.locator('#leagueCupZone .cup-fixture')).toHaveCount(15);
  expect(await page.locator('#leagueZone tbody').textContent()).toBe(table);
  await expect(page.locator('#seasonResults')).toContainText('306 matches');
  await page.locator('#leagueCupZone').screenshot({ path: 'test-results/cup-champion-320.png' });
  await page.locator('#btnNextLeagueSeason').click(); await expect(page.locator('#leagueZone')).toContainText('Season 2');
  await page.locator('#btnEnterTournament').click();
  await expect(page.locator('#leagueCupZone')).toContainText('The top 16 clubs qualify');
  await expect(page.locator('#cupChampion')).toHaveCount(0); expect(errors).toEqual([]);
});

test('multiplayer results-only cup supports different viewing speeds and persisted brackets', async ({ page, browser, request }) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const host = await register(request, 'cup_h_'), guest = await register(request, 'cup_g_'), errors = [];
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4322', viewport: { width: 390, height: 844 } }), friend = await context.newPage();
  try {
    for (const player of [page, friend]) player.on('pageerror', error => errors.push(error.message));
    await setup(page, host.token); await setup(friend, guest.token); await page.goto('/');
    await page.locator('#modeCreate').click(); await choose(page, 'crMode', 'league'); await page.locator('#btnSelectLeague').click();
    await choose(page, 'crKnockoutCup', true); await choose(page, 'crSquadMode', 'real'); await choose(page, 'crTransfers', false);
    await choose(page, 'crResultsOnly', true); await page.locator('#crSlots').fill('2'); await page.locator('#btnCreateRoom').click();
    await expect(page.locator('.code-display')).toBeVisible(); const code = (await page.locator('.code-display').textContent()).trim();
    const headers = { Authorization: 'Bearer ' + host.token };
    const room = await (await request.get('/api/rooms/' + code, { headers })).json();
    expect(room.knockoutCup).toBe(true); const other = room.leagueClubs.find(club => club.code !== room.members[0].clubCode).code;
    await request.post('/api/rooms/' + code + '/join', { headers: { Authorization: 'Bearer ' + guest.token }, data: { clubCode: other } });
    await friend.goto('/#lobby/' + code); await expect(page.locator('#memberList li')).toHaveCount(2);
    await expect(page.locator('#app')).toContainText('PGL Knockout Cup: Enabled');
    await page.locator('#btnStart').click(); for (const player of [page, friend]) await player.locator('#btnLockTacticalStyle').click();
    await page.locator('#btnStartTournament').click();
    const check = async (player, cursor) => {
      await expect(player.locator('#leagueResultMatchday')).toHaveValue(String(cursor));
      await expect(player.locator('#leagueZone')).toContainText('Matchday ' + Math.min(cursor, 34) + ' / 34');
      await expect(player.locator('#liveZone')).toBeHidden(); await expect(player.locator('#continueZone')).toBeHidden();
    };
    const advance = async (player, cursor) => { await expect.poll(() => player.evaluate(() => cupRoundWaiting())).toBe(true); await player.evaluate(() => nextCupRound()); await check(player, cursor); };
    for (const player of [page, friend]) await check(player, 1);
    for (let cursor = 2; cursor <= 34; cursor++) await advance(page, cursor);
    await expect(page.locator('#leagueCupZone .cup-fixture')).toHaveCount(8);
    const draw = await page.locator('#leagueCupZone .cup-fixture').allTextContents();
    await page.locator('#leagueCupZone').screenshot({ path: 'test-results/cup-draw-1280.png' }); await fits(page);
    await page.reload(); await check(page, 34); expect(await page.locator('#leagueCupZone .cup-fixture').allTextContents()).toEqual(draw);
    for (let cursor = 35; cursor <= 38; cursor++) await advance(page, cursor);
    await expect(page.locator('#cupChampion')).toBeVisible();
    await expect(friend.locator('#cupChampion')).toHaveCount(0); await expect(friend.locator('#leagueCupZone')).toContainText('The top 16 clubs qualify');
    for (let cursor = 2; cursor <= 34; cursor++) await advance(friend, cursor);
    expect(await friend.locator('#leagueCupZone .cup-fixture').allTextContents()).toEqual(draw);
    await expect(friend.locator('#cupChampion')).toHaveCount(0); await fits(friend);
    for (let cursor = 35; cursor <= 38; cursor++) await advance(friend, cursor);
    await expect(friend.locator('#cupChampion')).toHaveText(await page.locator('#cupChampion').textContent());
    await expect(friend.locator('#leagueCupZone .cup-fixture')).toHaveCount(15); await fits(friend);
    await friend.locator('#leagueCupZone').screenshot({ path: 'test-results/cup-online-champion-390.png' });
    await expect(page.locator('#seasonResults')).toContainText('306 matches');
    await page.locator('#leagueResultMatchday').selectOption('35');
    await expect(page.locator('#leagueScoreResults .match-row')).toHaveCount(8);
    await page.locator('#btnNextLeagueSeason').click();
    for (const player of [page, friend]) { await expect(player.locator('#leagueZone')).toContainText('Season 2'); await check(player, 1); }
    const nextCode = page.url().split('/').pop(); expect((await (await request.get('/api/rooms/' + nextCode, { headers })).json()).knockoutCup).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
