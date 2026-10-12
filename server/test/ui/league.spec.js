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
    await expect(page.locator('#btnTactics')).toBeHidden();
    await expect(page.locator('#btnAdmin')).toBeHidden();
    await page.goto('/#tactics');
    await expect(page.locator('#modeSingle')).toBeVisible();
    await expect(page.locator('#tactics-view')).toHaveCount(0);
    await page.locator('#modeSingle').click();
    await expect(page.getByRole('heading', { name: 'League Games', exact: true })).toBeVisible();
    await page.locator('#singleWorldCup').click();
    await expect(page.getByRole('heading', { name: 'Single Player — World Cup' })).toBeVisible();
    await page.locator('#btnBack').click();
    await page.locator('#singleLeague').click();
    await expect(page.locator('#leagueSelect')).toHaveValue('pgl');
    await expect(page.locator('#leagueDetails')).toContainText('18 clubs');
    await page.locator('#btnSelectLeague').click();
    await expect(page.locator('#spSquadMode')).toHaveValue('draft');
    await page.locator('#spSquadMode').selectOption('real');
    await expect(page.locator('#spAutoDraft')).toBeHidden();
    await expect(page.locator('#btnSingleplayer')).toHaveText('Use Real Club Squad');
    await page.locator('#spSquadMode').selectOption('draft');
    await expect(page.locator('#spClub option')).toHaveCount(18);
    await page.locator('#spClub').selectOption({ label: 'Persepolis' });
    await page.locator('#spAutoDraft').getByText('Auto', { exact: true }).click();
    await page.locator('#btnSingleplayer').click();
    await expect(page.getByRole('heading', { name: "You're representing Persepolis!" })).toBeVisible({ timeout: 20000 });
    await page.locator('#btnEnterTournament').click();
    await expect(page.locator('#leagueZone tbody tr')).toHaveCount(18);
    await expect(page.locator('#leagueZone tbody .relegation-mark')).toHaveCount(2);
    await expect(page.locator('#leagueZone tbody tr').nth(16).locator('.relegation-mark')).toHaveAttribute('aria-label', 'Relegation zone');
    await expect(page.locator('#leagueZone tbody tr').nth(17).locator('.relegation-mark')).toHaveAttribute('aria-label', 'Relegation zone');
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

for (const transferCount of [1, 2]) {
test(`real squad with ${transferCount} transfer(s) and relegation markers works on mobile`, async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://cdn.socket.io/**', (route) => route.fulfill({ path: path.join(__dirname, '..', '..', 'node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  const username = `real_${Date.now().toString().slice(-8)}`;
  const account = await (await request.post('/api/auth/register', { data: { username, email: `${username}@example.test`, password: 'test-password' } })).json();
  await page.addInitScript((token) => sessionStorage.setItem('draftbox.token', token), account.token);
  await page.goto('/');
  await page.locator('#modeSingle').click();
  await page.locator('#singleLeague').click();
  await page.locator('#btnSelectLeague').click();
  await page.locator('#spSquadMode').selectOption('real');
  await page.locator('#btnSingleplayer').click();
  await expect(page.locator('#squadProgress')).toContainText('11');
  const code = (await page.url()).split('/').pop();
  await expect(page.locator('#tacticalStyleGrid .tactical-style-card')).toHaveCount(12);
  for (const style of ['vertical', 'overlap', 'catenaccio']) {
    await expect(page.locator(`[data-style="${style}"]`)).toContainText('Strengths');
    await expect(page.locator(`[data-style="${style}"]`)).toContainText('Trade-offs');
  }
  await page.locator(`[data-style="${transferCount === 1 ? 'vertical' : 'catenaccio'}"]`).click();
  await page.locator('#btnLockTacticalStyle').click();
  await expect(page.locator('#btnEnterTournament')).toBeVisible();
  await page.locator('#btnEnterTournament').click();
  await page.locator('#leagueSquadBrowser summary').click();
  await page.locator('#leagueClubSelect').selectOption({ label: 'Esteghlal' });
  await expect(page.locator('#leagueClubMeta')).toContainText('Stats through matchday 0');
  await page.locator('#leaguePlayerSearch').fill('Jasir');
  await expect(page.locator('#leagueClubPlayers .transfer-player-card')).toHaveCount(1);
  await expect(page.locator('#leagueClubPlayers')).toContainText('Jasir Asani');
  await expect(page.locator('#leagueClubPlayers')).toContainText('Starting XI');
  await page.locator('#leagueSquadBrowser summary').click();
  await page.locator('#btnSkipToTransfers').click();
  await expect(page.locator('#transferZone')).toContainText('Mid-season Transfer Window');
  await expect(page.locator('#btnFinishLeague')).toBeHidden();
  await expect(page.locator('#leagueZone')).toContainText('Matchday 17 / 34');
  await expect(page.locator('#btnSkipToTransfers')).toBeHidden();
  await page.locator('#leagueSquadBrowser summary').click();
  await expect(page.locator('#leagueClubMeta')).toContainText('Stats through matchday 17');
  await expect(page.locator('#leagueClubPlayers')).toContainText('Jasir Asani');
  await expect(page.locator('#leagueClubPlayers dl div').filter({ has: page.locator('dt', { hasText: /^Apps$/ }) }).locator('dd')).toHaveText('17');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: `test-results/league-teams-${transferCount}-mobile.png`, fullPage: true });
  await page.locator('#leagueSquadBrowser summary').click();
  await page.reload();
  await expect(page.locator('#transferZone')).toContainText('Mid-season Transfer Window');
  await expect(page.locator('#continueZone')).toBeHidden();
  await expect(page.locator('[data-release]')).toHaveCount(11);
  await expect(page.locator('#btnReleasePlayers')).toBeDisabled();
  await page.locator('[data-release]').nth(0).click();
  await expect(page.locator('#btnReleasePlayers')).toBeEnabled();
  await expect(page.locator('#btnReleasePlayers')).toHaveText('Release 1 Player');
  if (transferCount === 2) {
    await page.locator('[data-release]').nth(1).click();
    await page.locator('[data-release]').nth(2).click();
    await expect(page.locator('[data-release].selected')).toHaveCount(2);
    await expect(page.locator('#btnReleasePlayers')).toHaveText('Release 2 Players');
  }
  await page.locator('#btnReleasePlayers').click();
  await expect(page.locator('#transferPick0')).toBeVisible();
  await page.reload();
  await expect(page.locator('#transferPick0')).toBeVisible();
  const first = await page.locator('#transferPick0 option').nth(1).getAttribute('value');
  await page.locator('#transferPick0').selectOption(first);
  if (transferCount === 2) {
    const second = await page.locator('#transferPick1 option').evaluateAll((options, first) => options.find((option) => option.value && option.value !== first).value, first);
    await page.locator('#transferPick1').selectOption(second);
  } else await expect(page.locator('#transferPick1')).toHaveCount(0);
  await expect(page.locator('#transferProfile0')).toContainText('OVR');
  await expect(page.locator('#transferProfile0')).toContainText('Available');
  await expect(page.locator('#transferProfile0')).toContainText('Assists');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: `test-results/transfers-${transferCount}-mobile.png`, fullPage: true });
  await page.locator('#btnSignPlayers').click();
  await expect(page.locator('#transferZone')).toBeHidden();
  await expect(page.locator('#btnContinue')).toBeVisible();
  await page.reload();
  await expect(page.locator('#transferZone')).toBeHidden();
  await expect(page.locator('#btnFinishLeague')).toBeVisible();
  await page.locator('#btnFinishLeague').click();
  await expect(page.locator('#seasonResults')).toContainText('306 matches');
  await expect(page.locator('#seasonResults')).toContainText('Top Scorers');
  await expect(page.locator('#seasonResults')).toContainText('Relegated');
  await expect(page.locator('#btnFinishLeague')).toBeHidden();
  await page.reload();
  await expect(page.locator('#leagueZone')).toContainText('Matchday 34 / 34');
  await expect(page.locator('#leagueZone tbody .relegation-mark')).toHaveCount(2);
  await expect(page.locator('#leagueZone tbody tr').nth(16).locator('.relegation-mark')).toHaveAttribute('aria-label', 'Relegated');
  await expect(page.locator('#leagueZone tbody tr').nth(17).locator('.relegation-mark')).toHaveAttribute('aria-label', 'Relegated');
  expect(errors).toEqual([]);
});
}
