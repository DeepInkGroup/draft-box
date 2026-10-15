const { test, expect } = require('@playwright/test');
const path = require('node:path');
for (const width of [1280, 320]) {
  test(`supplied club logos and coaches across a league at ${width}px`, { timeout: 90000 }, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('https://cdn.socket.io/**', route => route.fulfill({ path: path.join(__dirname, '../../node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
    for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']) await page.route(`https://${host}/**`, route => route.abort());
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const username = `crest_${width}_${Date.now().toString().slice(-6)}`;
    const account = await (await request.post('/api/auth/register', { data: { username, email: username + '@example.test', password: 'test-password' } })).json();
    await page.addInitScript(token => sessionStorage.setItem('draftbox.token', token), account.token);
    const { leagues } = await (await request.get('/api/leagues')).json();
    const league = leagues.find(entry => entry.id === 'pgl');
    const fits = async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll('#app *')].map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent.slice(0, 70), right: el.getBoundingClientRect().right })).filter(el => el.right > innerWidth + 1) : []);
      if (overflow.length) await page.screenshot({ path: `test-results/pgl-overflow-${width}.png`, fullPage: true });
      expect(overflow).toEqual([]);
    };
    const loaded = async selector => {
      await expect.poll(() => page.locator(selector).evaluateAll(images => images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    };
    // Bundled assets must be served as actual PNGs.
    for (const club of league.teams) {
      const response = await request.get('/' + club.logo);
      expect(response.status()).toBe(200); expect(response.headers()['content-type']).toContain('image/png');
    }
    await page.goto('/'); await page.locator('#modeSingle').click(); await page.locator('#singleLeague').click();
    await page.locator('.coach-directory summary').click();
    await expect(page.locator('.coach-list li')).toHaveCount(20);
    await expect(page.locator('.coach-list')).toContainText('Yahya Golmohammadi'); await fits();
    await page.locator('#btnSelectLeague').click();
    for (const club of league.teams) {
      await page.locator('#spClub').selectOption(club.code);
      await expect(page.locator('.club-selection-preview')).toContainText(club.headCoach.name);
      await loaded('.club-selection-preview img'); await fits();
    }
    await page.locator('#spClub').selectOption(league.teams[0].code);
    await page.locator('.club-selection-preview').screenshot({ path: `test-results/pgl-club-preview-${width}.png` });
    await page.locator('#spSquadMode [data-value="real"]').click(); await page.locator('#btnSingleplayer').click();
    await page.locator('#btnLockTacticalStyle').click(); await page.locator('#btnEnterTournament').click();
    await expect(page.locator('#leagueZone tbody .club-logo')).toHaveCount(18); await loaded('#leagueZone .club-logo'); await fits();
    await page.locator('#leagueZone').screenshot({ path: `test-results/pgl-logos-standings-${width}.png` });
    await page.locator('#leagueTools .coach-directory summary').click();
    await expect(page.locator('#leagueTools .coach-list li')).toHaveCount(20); await fits();
    await page.locator('#leagueSquadBrowser summary').click();
    for (const club of [league.teams[0], league.teams[1]]) {
      await page.locator('#leagueClubSelect').selectOption(club.code);
      await expect(page.locator('#leagueClubOverview')).toContainText(club.headCoach.name);
      await loaded('#leagueClubOverview .club-logo'); await fits();
    }
    await page.locator('#leagueClubOverview').screenshot({ path: `test-results/pgl-coach-profile-${width}.png` });
    await page.locator('#leagueSquadBrowser summary').click();
    await page.locator('#btnContinue').click(); await expect(page.locator('#btnSkipLive')).toBeVisible();
    await loaded('#liveZone .club-logo'); await fits(); await page.locator('#btnSkipLive').click();
    await expect(page.locator('#stepCard .match-row .club-logo')).toHaveCount(18); await loaded('#stepCard .match-row .club-logo'); await fits();
    await page.reload(); await expect(page.locator('#leagueZone tbody .club-logo')).toHaveCount(18); await loaded('#leagueZone .club-logo');
    expect(errors).toEqual([]);
  });
}
