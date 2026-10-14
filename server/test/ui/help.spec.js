const { test, expect } = require('@playwright/test');
const path = require('node:path');
async function localAssets(page) {
  await page.route('https://cdn.socket.io/**', route => route.fulfill({ path: path.join(__dirname, '../../node_modules/socket.io/client-dist/socket.io.min.js'), contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
}
async function fits(page, dialogId) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.locator(dialogId), bounds = await dialog.boundingBox(), viewport = page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.width).toBeLessThanOrEqual(viewport.width); expect(bounds.height).toBeLessThanOrEqual(viewport.height);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}
for (const width of [1280, 768, 390, 320]) {
  test(`profile, formation explorer and searchable rulebook at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await localAssets(page);
    const username = `help_${width}_${Date.now().toString().slice(-6)}`;
    const response = await request.post('/api/auth/register', { data: { username, email: username + '@example.test', password: 'test-password' } });
    expect(response.status()).toBe(201);
    const account = await response.json();
    await page.addInitScript(token => sessionStorage.setItem('draftbox.token', token), account.token);
    await page.goto('/');
    await page.locator('#btnProfile').click();
    await expect(page.locator('#profileHeroName')).toHaveText(username);
    await expect(page.locator('#profileCareer .career-stat')).toHaveCount(5);
    await expect(page.locator('#profileMatchRecord .record-win dd')).toHaveText('0');
    await expect(page.locator('#profileMatchRecord .record-draw dd')).toHaveText('0');
    await expect(page.locator('#profileMatchRecord .record-loss dd')).toHaveText('0');
    await expect(page.locator('#profileInsights')).not.toContainText('Attack Index');
    await fits(page, '#profileDialog');
    await page.screenshot({ path: `test-results/profile-new-${width}.png` });
    await page.locator('#profileTab-friends').click();
    await expect(page.locator('#profileFriendCode')).toHaveText(account.user.friendCode);
    await expect(page.locator('#profileFriends')).toContainText('No friends');
    await page.locator('#friendCodeInput').fill('BAD');
    await page.locator('#btnAddFriend').click();
    await expect(page.locator('#profileError')).toBeVisible();
    await fits(page, '#profileDialog');
    await page.locator('#profileTab-preferences').click();
    await page.locator('#profileDraftLayout [data-value="pitch-first"]').click();
    expect(await page.evaluate(() => localStorage.getItem('draftbox.draftLayout'))).toBe('pitch-first');
    await page.locator('#profileTab-preferences').press('ArrowRight');
    await expect(page.locator('#profileTab-security')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#profileEmail')).toHaveValue(username + '@example.test');
    await expect(page.locator('#profileEmail')).toBeDisabled();
    await page.locator('#profileCurrentPassword').fill('test-password');
    await page.locator('#profileNewPassword').fill('tiny');
    await page.locator('#btnChangePassword').click();
    await expect(page.locator('#profileError')).toBeVisible();
    await fits(page, '#profileDialog');
    await page.locator('#btnCloseProfile').click();
    if (width === 1280) {
      await page.route('**/api/auth/me/career', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tournaments: 2, titles: 1, w: 8, d: 2, l: 3, gf: 24, ga: 12 }) }));
      await page.locator('#btnProfile').click();
      await expect(page.locator('#profileMatchRecord .record-win dd')).toHaveText('8');
      await expect(page.locator('#profileMatchRecord .record-draw dd')).toHaveText('2');
      await expect(page.locator('#profileMatchRecord .record-loss dd')).toHaveText('3');
      await expect(page.locator('#profileHeroMeta')).toHaveText('13 matches played');
      await page.screenshot({ path: 'test-results/profile-populated-desktop.png' });
      await page.locator('#btnCloseProfile').click();
      await page.unroute('**/api/auth/me/career');
    }
    await page.locator('#btnProfile').click();
    await expect(page.locator('#profilePanel-overview')).toBeVisible();
    await expect(page.locator('#profileError')).toBeHidden();
    await page.locator('#btnCloseProfile').click();

    await page.locator('#btnGameGuide').click();
    await page.locator('#guideFormation').selectOption('4-4-2');
    await expect(page.locator('#guideFormationName')).toHaveText('4-4-2');
    await expect(page.locator('#guidePitch .pitch-dot')).toHaveCount(11);
    await expect(page.locator('#guideFormationDescription')).toContainText('strike partnership');
    await fits(page, '#gameGuideDialog');
    await page.screenshot({ path: `test-results/formations-new-${width}.png` });
    await page.locator('#guideTab-styles').click();
    await expect(page.locator('.tactic-explorer-card')).toHaveCount(12);
    await page.locator('#guideStyleSearch').fill('catenaccio');
    await expect(page.locator('.tactic-explorer-card')).toHaveCount(1);
    await expect(page.locator('#guideStyleCount')).toHaveText('1 of 12 styles');
    await page.locator('#guideStyleSearch').fill('zznothingzz');
    await expect(page.locator('#guideStyles')).toContainText('No styles found');
    await page.locator('#guideClearSearch').click();
    await expect(page.locator('.tactic-explorer-card')).toHaveCount(12);
    await fits(page, '#gameGuideDialog');
    await page.screenshot({ path: `test-results/tactics-new-${width}.png` });
    await page.locator('#guideTab-chemistry').click();
    await expect(page.locator('#guidePanel-chemistry')).toContainText('new signings');
    await page.locator('#btnCloseGameGuide').click();

    await page.locator('#btnRulebook').click();
    await page.locator('[data-rule-category="league"]').click();
    await expect(page.locator('#rulebookTopics')).toContainText('34 matchdays');
    await expect(page.locator('#rulebookTopics .rule-topic')).toHaveCount(7);
    await page.locator('#rulebookSearch').fill('transfers');
    await expect(page.locator('#rulebookResultCount')).toContainText('matching');
    await expect(page.locator('#rulebookTopics')).toContainText('randomly offered');
    await fits(page, '#rulebookDialog');
    await page.screenshot({ path: `test-results/rulebook-new-${width}.png` });
    await page.locator('#rulebookSearch').fill('zzzmissingzzz');
    await expect(page.locator('#rulebookTopics')).toContainText('No matching rules');
    await page.locator('#rulebookClearSearch').click();
    await expect(page.locator('#rulebookTopics')).toContainText('34 matchdays');
    await page.keyboard.press('Escape');
    await expect(page.locator('#rulebookDialog')).toBeHidden();

    await page.locator('#btnAbout').click();
    await expect(page.locator('#aboutContent')).toContainText('DeepInk Group');
    await expect(page.locator('#aboutContent .about-link')).toHaveCount(2);
    await fits(page, '#aboutDialog');
    await page.screenshot({ path: `test-results/about-new-${width}.png` });
    await page.locator('#btnCloseAbout').click();
    expect(errors).toEqual([]);
  });
}

test('About Us editor publishes safely, preserves drafts on conflicts and is available to anonymous visitors', async ({ page, request }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await localAssets(page); await page.goto('/');
  await page.locator('#btnAbout').click(); await expect(page.locator('#aboutContent')).toContainText('DeepInk Group'); await page.locator('#btnCloseAbout').click();
  await page.locator('#authUsername').fill('Admin'); await page.locator('#authPassword').fill(process.env.ADMIN_INITIAL_PASSWORD || 'ui-admin-password'); await page.locator('#authSubmit').click();
  await expect(page.locator('#adminConsole')).toBeVisible();
  await page.locator('[data-admin-tab="about"]').click();
  await expect(page.locator('#aboutEditorStatus')).toContainText('Ready to edit');
  await expect(page.locator('#aboutSave')).toBeDisabled();
  const original = await (await request.get('/api/about')).json();
  const token = await page.evaluate(() => sessionStorage.getItem('draftbox.token'));
  const headers = { Authorization: `Bearer ${token}` };
  try {
    await page.locator('#aboutEditorForm [name="title"]').fill('Meet our community');
    await page.locator('#aboutEditorForm [name="body"]').fill('Our football story.\n\n<img src=x onerror="window.aboutExecuted=true">');
    await page.locator('#aboutEditorForm [name="contactEmail"]').fill('team@example.test');
    await page.locator('#aboutEditorForm [name="website"]').fill('https://example.test/about');
    await expect(page.locator('#aboutPreviewBadge')).toHaveText('Unsaved changes');
    await expect(page.locator('#aboutPreview')).toContainText('<img src=x');
    expect(await page.locator('#aboutPreview img').count()).toBe(0);
    expect((await (await request.get('/api/about')).json()).content.title).toBe(original.content.title);
    await page.screenshot({ path: 'test-results/about-admin-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/about-admin-phone.png', fullPage: true });
    await page.locator('#aboutSave').click();
    await expect(page.locator('#aboutEditorStatus')).toContainText('Published successfully');
    await expect(page.locator('#aboutSave')).toBeDisabled();
    const saved = await (await request.get('/api/about')).json();
    expect(saved.revision).toBe(original.revision + 1);
    expect(saved.content.title).toBe('Meet our community');
    await page.locator('#btnAbout').click();
    await expect(page.locator('#aboutContent')).toContainText('Meet our community');
    await expect(page.locator('#aboutContent')).toContainText('<img src=x');
    await expect(page.locator('#aboutContent img')).toHaveCount(0);
    expect(await page.evaluate(() => window.aboutExecuted)).toBeUndefined();
    await expect(page.locator('#aboutContent a').filter({ hasText: 'Email us' })).toHaveAttribute('href', 'mailto:team%40example.test');
    await fits(page, '#aboutDialog'); await page.locator('#btnCloseAbout').click();
    const changed = await request.put('/api/admin/about', { headers, data: { revision: saved.revision, content: { ...saved.content, title: 'A newer admin edit' } } });
    expect(changed.status()).toBe(200);
    await page.locator('#aboutEditorForm [name="title"]').fill('My local draft');
    await page.locator('#aboutSave').click();
    await expect(page.locator('#aboutEditorStatus')).toContainText('Another administrator updated');
    await expect(page.locator('#aboutEditorForm [name="title"]')).toHaveValue('My local draft');
    expect((await (await request.get('/api/about')).json()).content.title).toBe('A newer admin edit');
    await page.locator('#aboutReload').click();
    await expect(page.locator('#aboutEditorForm [name="title"]')).toHaveValue('A newer admin edit');
    await expect(page.locator('#btnHome')).toBeHidden(); await expect(page.locator('#btnProfile')).toBeHidden();
    expect(await page.evaluate(() => App.state.socket)).toBe(null);
  } finally {
    const current = await (await request.get('/api/about')).json();
    expect((await request.put('/api/admin/about', { headers, data: { revision: current.revision, content: original.content } })).status()).toBe(200);
  }
  expect(errors).toEqual([]);
});

test('About Us and tactics show retry actions after a failed request', async ({ page }) => {
  await localAssets(page); await page.goto('/');
  await page.route('**/api/about', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary connection issue' }) }));
  await page.locator('#btnAbout').click(); await expect(page.locator('#aboutContent')).toContainText('Temporary connection issue');
  await page.unroute('**/api/about'); await page.locator('#aboutRetry').click(); await expect(page.locator('#aboutContent')).toContainText('DeepInk Group'); await page.locator('#btnCloseAbout').click();
  await page.route('**/api/tactical-styles', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary connection issue' }) }));
  await page.locator('#btnGameGuide').click(); await page.locator('#guideTab-styles').click(); await expect(page.locator('#guideStyles')).toContainText('Temporary connection issue');
  await page.unroute('**/api/tactical-styles'); await page.locator('#guideRetry').click(); await expect(page.locator('.tactic-explorer-card')).toHaveCount(12);
});
