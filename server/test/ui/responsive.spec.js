const {test, expect} = require('@playwright/test');
const path = require('node:path');
const players = new Map(require('../../src/data/pgl.json').teams.flatMap(club => club.players.map(player => [player.id,player])));
for (const viewport of [{width:320,height:568},{width:375,height:812},{width:768,height:1024},{width:820,height:1180},{width:1024,height:768},{width:812,height:375}]) {
  test.describe(`touch layout ${viewport.width}x${viewport.height}`, () => {
    test.use({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2});
    test('dialogs, league setup, boosted squads, transfers and results fit the viewport', {timeout:60000}, async ({page,request}) => {
      const errors = [];page.on('pageerror',error => errors.push(error.message));
      await page.route('https://cdn.socket.io/**',route => route.fulfill({path:path.join(__dirname,'../../node_modules/socket.io/client-dist/socket.io.min.js'),contentType:'application/javascript'}));
      await page.route('https://fonts.googleapis.com/**',route => route.abort());await page.route('https://fonts.gstatic.com/**',route => route.abort());await page.route('https://cdn.jsdelivr.net/**',route => route.abort());
      const username = `touch_${viewport.width}_${Date.now().toString().slice(-6)}`;
      const account = await (await request.post('/api/auth/register',{data:{username,email:username+'@example.test',password:'test-password'}})).json();
      await page.addInitScript(token => sessionStorage.setItem('draftbox.token',token),account.token);
      await page.goto('/');
      const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#btnProfile').click();await expect(page.locator('#profileDialog')).toBeVisible();
      const bounds = await page.locator('#profileDialog').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.width).toBeLessThanOrEqual(viewport.width);expect(bounds.height).toBeLessThanOrEqual(viewport.height);
      await page.locator('#btnCloseProfile').click();
      await page.locator('#modeSingle').click();await page.locator('#singleWorldCup').click();
      await expect(page.locator('#spRatingBoost')).toHaveCount(0);await fits();
      await page.locator('#btnBack').click();await page.locator('#singleLeague').click();await page.locator('#btnSelectLeague').click();
      for (const id of ['spTransferLimit','spEndTransferLimit']) {
        await expect(page.locator('#'+id+' button')).toHaveCount(3);
        await expect(page.locator('#'+id+' [data-value="0"]')).toHaveCount(0);
      }
      await page.locator('#spRatingBoost [data-value="true"]').click();
      await page.locator('#spTransfers [data-value="false"]').click();
      await expect(page.locator('#spAiTransfers button').first()).toBeDisabled();
      await expect(page.locator('#spTransferLimit button').first()).toBeDisabled();
      await page.locator('#spTransfers [data-value="true"]').click();
      const tapTarget = await page.locator('#spTransferLimit button').first().boundingBox();expect(tapTarget.height).toBeGreaterThanOrEqual(44);
      await fits();await page.screenshot({path:`test-results/setup-touch-${viewport.width}x${viewport.height}.png`,fullPage:true});
      await page.locator('#spSquadMode [data-value="real"]').click();await page.locator('#btnSingleplayer').click();
      await expect(page.locator('#squadProgress')).toContainText('11');
      const code = page.url().split('/').pop(), headers = {Authorization:`Bearer ${account.token}`};
      const saved = await (await request.get('/api/rooms/'+code+'/state',{headers})).json();
      expect(saved.pglRatingBoost).toBe(true);
      expect(saved.myDraft.squad.every(player => player.overall === players.get(player.id).overall + 10)).toBe(true);
      await fits();await page.locator('#btnLockTacticalStyle').click();await page.locator('#btnEnterTournament').click();
      await expect(page.locator('#leagueZone')).toContainText('All players +10 OVR');
      if(viewport.width<=640) {
        const wrapper=page.locator('#leagueZone .league-table-scroll');
        expect(await wrapper.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
        await expect(page.locator('#leagueZone thead th:visible')).toHaveCount(5);
        const cells=await page.locator('#leagueZone tbody tr').first().locator('td:visible').evaluateAll(cells=>cells.map(cell=>{const r=cell.getBoundingClientRect();return {left:r.left,right:r.right};}));
        for(let i=1;i<cells.length;i++)expect(cells[i].left).toBeGreaterThanOrEqual(cells[i-1].right-1);
        await page.locator('#leagueTableToggleStats').click();await expect(page.locator('#leagueZone thead th:visible')).toHaveCount(10);
        await wrapper.evaluate(el=>el.scrollLeft=el.scrollWidth);
        await expect(page.locator('#leagueZone tbody tr').first().locator('td').last()).toBeInViewport();
        await page.locator('#leagueTableToggleStats').click();await expect(page.locator('#leagueZone thead th:visible')).toHaveCount(5);
        await page.locator('#leagueZone').screenshot({path:'test-results/standings-'+viewport.width+'.png'});
      }
      await page.locator('#leagueSquadBrowser summary').click();await expect(page.locator('#leagueClubPlayers .transfer-player-card').first()).toBeVisible();
      await fits();await page.locator('#leagueSquadBrowser summary').click();
      await page.locator('#btnSkipToTransfers').click();await expect(page.locator('#transferZone')).toBeVisible();
      await page.locator('[data-release]').first().click();await page.locator('#btnReleasePlayers').click();
      await expect(page.locator('#transferPick0 button')).toHaveCount(2);await fits();
      await page.screenshot({path:`test-results/transfers-touch-${viewport.width}x${viewport.height}.png`,fullPage:true});
      await page.locator('#transferPick0 button').last().click();await page.locator('#btnSignPlayers').click();
      await page.locator('#btnFinishLeague').click();await expect(page.locator('#seasonResults')).toContainText('306 matches',{timeout:15000});
      await fits();await page.screenshot({path:`test-results/results-touch-${viewport.width}x${viewport.height}.png`,fullPage:true});
      expect(errors).toEqual([]);
    });
  });
}
