const { test, expect } = require('@playwright/test');
const path = require('node:path');

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`single-player league flow and saved season at ${viewport.width}px`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Use the same Socket.io client bytes locally to keep the test independent of CDN access.
    await page.route('https://cdn.socket.io/**', (route) => route.fulfill({ path: path.join(__dirname, '..', '..', 'node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
    await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    const username = `ui_${viewport.width}_${Date.now().toString().slice(-8)}`;
    const response = await request.post('/api/auth/register', { data: { username, email: `${username}@example.test`, password: 'test-password' } });
    const account = await response.json();
    await page.addInitScript((token) => sessionStorage.setItem('draftbox.token', token), account.token);
    await page.goto('/');
    await page.locator('#modeSingle').click();
    await expect(page.getByRole('heading', { name: 'League Games', exact: true })).toBeVisible();
    await page.locator('#singleWorldCup').click();
    await expect(page.getByRole('heading', { name: 'Single Player — World Cup' })).toBeVisible();
    await page.locator('#btnBack').click();
    await page.locator('#singleLeague').click();
    await expect(page.locator('#leagueSelect')).toHaveValue('pgl');
    await expect(page.locator('#leagueDetails')).toContainText('18 clubs');
    await page.locator('#btnSelectLeague').click();
    await expect(page.locator('#spClub option')).toHaveCount(18);
    await page.locator('#spClub').selectOption({ label: 'Persepolis' });
    await page.locator('#spAutoDraft').getByText('Auto', { exact: true }).click();
    await page.locator('#btnSingleplayer').click();
    await expect(page.getByRole('heading', { name: "You're representing Persepolis!" })).toBeVisible({ timeout: 20000 });
    await page.locator('#btnEnterTournament').click();
    await expect(page.locator('#leagueZone tbody tr')).toHaveCount(18);
    await expect(page.locator('#leagueZone')).toContainText('Matchday 0 / 34');
    const roomCode = (await page.url()).split('/').pop();
    // Drive the match through the real app socket, then reload to inspect the saved result.
    await page.evaluate((code) => App.ensureSocket().emit('tournament:advance', { code }), roomCode);
    await expect.poll(async () => {
      const result = await request.get('/api/rooms', { headers: { Authorization: `Bearer ${account.token}` } });
      return (await result.json()).leagues.find((league) => league.code === roomCode)?.matchday;
    }).toBe(1);
    await page.reload();
    await expect(page.locator('#leagueZone')).toContainText('Matchday 1 / 34');
    await expect(page.locator('#stepCard h3')).toContainText('Matchday 1 of 34');
    await expect(page.locator('#stepCard .match-row')).toHaveCount(9);
    await expect(page.locator('#btnContinue')).toHaveText('▶ Play Next Matchday');
    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(pageOverflows).toBe(false);
    await page.screenshot({ path: `test-results/pgl-${viewport.width}.png`, fullPage: true });
    await page.locator('#btnHome').click();
    await expect(page.locator('#activeLeagueSeasons')).toContainText('Persepolis');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.locator('#leagueZone')).toContainText('Matchday 1 / 34');
    expect(errors).toEqual([]);
  });
}
