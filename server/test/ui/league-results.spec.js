const {test,expect} = require('@playwright/test');
const path = require('node:path');
for(const {width,windows} of [{width:390,windows:false},{width:768,windows:true},{width:1280,windows:true}]) {
  test(`results-only autoplay and club browser at ${width}px`,{timeout:60000},async({page,request})=>{
    await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://cdn.socket.io/**',route=>route.fulfill({path:path.join(__dirname,'../../node_modules/socket.io/client-dist/socket.io.min.js'),contentType:'application/javascript'}));
    await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort());await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
    const username=`results_${width}_${Date.now().toString().slice(-6)}`;
    const account=await(await request.post('/api/auth/register',{data:{username,email:username+'@example.test',password:'test-password'}})).json();
    await page.addInitScript(token=>sessionStorage.setItem('draftbox.token',token),account.token);
    await page.addInitScript(()=>{
      window.__liveShown=false;
      document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{
        const zone=document.querySelector('#liveZone');if(zone&&zone.style.display==='block')window.__liveShown=true;
      }).observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['style']}));
    });
    // Control only the result-display delay; keep Socket.io heartbeat timers real.
    await page.addInitScript(realFirstDelay=>{
      const nativeSet=window.setTimeout.bind(window), nativeClear=window.clearTimeout.bind(window), timers=new Map();
      let first=true;window.__resultDelays=[];
      window.setTimeout=(callback,delay,...args)=>{
        if(delay===2000 && typeof callback==='function' && callback.toString().includes('requestAutomaticResults')) {
          window.__resultDelays.push(delay);
          const real=realFirstDelay && first;first=false;
          const id=nativeSet(()=>{timers.delete(id);callback(...args);},real?delay:2147483647);
          timers.set(id,()=>{nativeClear(id);timers.delete(id);callback(...args);});return id;
        }
        return nativeSet(callback,delay,...args);
      };
      window.clearTimeout=id=>{timers.delete(id);nativeClear(id);};
      window.__advanceResultTimer=()=>{const advance=timers.values().next().value;if(!advance)throw Error('No pending result timer');advance();};
    },width===390);
    await page.goto('/');await expect(page.locator('#modeSingle')).toBeVisible();
    await page.evaluate(()=>{
      const ensure=App.ensureSocket;window.__gameCommands=[];window.__liveShown=false;
      App.ensureSocket=function(...args){const socket=ensure(...args);if(!socket.__observingCommands){const emit=socket.emit;socket.emit=function(name,...args){window.__gameCommands.push(name);return emit.call(this,name,...args);};socket.__observingCommands=true;}return socket;};
      App.ensureSocket();
      new MutationObserver(()=>{const zone=document.querySelector('#liveZone');if(zone&&zone.style.display==='block')window.__liveShown=true;}).observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['style']});
    });
    await page.locator('#modeSingle').click();await page.locator('#singleLeague').click();await page.locator('#btnSelectLeague').click();
    await page.locator('#spResultsOnly [data-value="true"]').click();await page.locator('#spSquadMode [data-value="real"]').click();
    if(windows) {
      await page.locator('#spMidseasonTactics [data-value="true"]').click();await page.locator('#spEndTransfers [data-value="true"]').click();
    } else await page.locator('#spTransfers [data-value="false"]').click();
    await page.locator('#btnSingleplayer').click();await expect(page.locator('#squadProgress')).toContainText('11');
    const code=page.url().split('/').pop();await page.locator('#btnLockTacticalStyle').click();
    const advanceThrough=async(from,end)=>{
      for(let day=from;day<=end;day++) {
        await expect(page.locator('#leagueZone')).toContainText('Matchday '+day+' / 34',{timeout:15000});
        await expect(page.locator('#stepCard h3')).toContainText('Matchday '+day);
        await expect(page.locator('#leagueResultMatchday')).toHaveValue(String(day));
        await expect(page.locator('.my-fixture')).toHaveCount(1);
        if(day<end)await page.evaluate(()=>window.__advanceResultTimer());
      }
    };
    await expect(page.locator('#leagueZone')).toContainText('Matchday 1 / 34',{timeout:15000});
    if(width===390) {
      await page.waitForTimeout(2100);await expect(page.locator('#leagueZone')).toContainText('Matchday 2 / 34');
      await advanceThrough(2,3);
    } else await advanceThrough(1,3);
    const commands=await page.evaluate(()=>window.__gameCommands);expect(commands).toContain('league:autoplay');expect(commands).not.toContain('tournament:advance');
    await page.reload();await expect(page.locator('#leagueZone')).toContainText('Matchday 3 / 34');
    await page.evaluate(()=>window.__advanceResultTimer());await advanceThrough(4,windows?17:34);
    await expect(page.locator('#btnEnterTournament')).toHaveCount(0);await expect(page.locator('#continueZone')).toBeHidden();
    await expect(page.locator('#btnSkipToTransfers')).toBeHidden();await expect(page.locator('#btnFinishLeague')).toBeHidden();
    await expect(page.locator('#liveZone')).toBeHidden();await expect(page.locator('#stepCard .match-report')).toHaveCount(0);
    if(windows) {
      await expect(page.locator('#transferZone')).toBeVisible();await expect(page.locator('#midseasonTacticsZone')).toBeVisible();
      await page.reload();await expect(page.locator('#leagueZone')).toContainText('Matchday 17 / 34');
      await page.locator('#btnKeepLeagueTactic').click();await expect(page.locator('#transferZone')).toBeVisible();
      await page.locator('#btnSkipTransfers').click();
      await advanceThrough(18,34);
    }
    await expect(page.locator('#seasonResults')).toContainText('306 matches',{timeout:15000});
    await expect(page.locator('#leagueResultMatchday option')).toHaveCount(34);
    await page.locator('#leagueResultMatchday').selectOption('1');await expect(page.locator('.result-only-row')).toHaveCount(9);
    await expect(page.locator('#liveMatchSelect')).toHaveCount(0);await expect(page.locator('#stepCard .match-row-clickable')).toHaveCount(0);
    await page.locator('#leagueSquadBrowser summary').click();await expect(page.locator('#leagueClubOverview')).toContainText('Your club');
    await expect(page.locator('#leagueClubOverview')).toContainText('Average XI OVR');
    const firstPage=await page.locator('#leagueClubPlayers .club-player-header h4').allTextContents();
    await page.locator('#leagueClubNextPage').click();await expect(page.locator('#leagueClubPageNumber')).toContainText('Page 2');
    const nextPage=await page.locator('#leagueClubPlayers .club-player-header h4').allTextContents();
    expect(nextPage.some(name=>firstPage.includes(name))).toBe(false);
    await page.locator('#leaguePlayerStatus').selectOption('xi');await expect(page.locator('#leagueClubPlayers .club-player-card')).toHaveCount(11);
    await page.locator('#leaguePlayerPosition').selectOption('GK');await expect(page.locator('#leagueClubPlayers .club-player-card')).toHaveCount(1);
    await expect(page.locator('#leaguePlayerCount')).toContainText('1 of');
    await page.locator('#leaguePlayerSearch').fill('NoMatchingPlayer');await expect(page.locator('.club-empty')).toContainText('No matching players');
    await page.locator('#leagueClearFilters').click();await expect(page.locator('#leaguePlayerPosition')).toHaveValue('all');await expect(page.locator('#leaguePlayerStatus')).toHaveValue('all');
    await page.locator('#leaguePlayerSort').selectOption('goals');
    const goals=await page.locator('#leagueClubPlayers dl div').filter({has:page.locator('dt',{hasText:/^Goals$/})}).locator('dd').allTextContents();
    expect(goals.map(Number)).toEqual(goals.map(Number).sort((a,b)=>b-a));
    await page.locator('#leagueClubNext').click();await expect(page.locator('#leagueClubOverview')).toContainText('AI club');
    await page.locator('#leagueMyClub').click();await expect(page.locator('#leagueClubOverview')).toContainText('Your club');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.evaluate(()=>document.querySelector('#leagueSquadBrowser').scrollIntoView({block:'start'}));
    await page.screenshot({path:`test-results/club-browser-${width}.png`,fullPage:false});
    const state=await(await request.get('/api/rooms/'+code,{headers:{Authorization:`Bearer ${account.token}`}})).json();expect(state.resultsOnly).toBe(true);
    await page.reload();await expect(page.locator('#seasonResults')).toContainText('306 matches');await expect(page.locator('#leagueResultMatchday option')).toHaveCount(34);
    if(windows) {
      await page.locator('#btnNextLeagueSeason').click();await expect(page.locator('#transferZone')).toContainText('End-of-season');
      await expect(page.locator('#leagueZone')).toContainText('Matchday 0 / 34');await expect(page.locator('#continueZone')).toBeHidden();
      await page.locator('#btnSkipTransfers').click();await advanceThrough(1,17);
    }
    expect(await page.evaluate(()=>window.__liveShown)).toBe(false);expect(errors).toEqual([]);
  });
}
