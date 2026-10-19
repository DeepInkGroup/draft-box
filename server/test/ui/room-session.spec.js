const {test,expect}=require('@playwright/test');
const path=require('node:path');
async function setup(page,token){
  await page.route('https://cdn.socket.io/**',route=>route.fulfill({path:path.join(__dirname,'../../node_modules/socket.io/client-dist/socket.io.min.js'),contentType:'application/javascript'}));
  for(const host of ['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'])await page.route(`https://${host}/**`,route=>route.abort());
  await page.addInitScript(token=>{
    sessionStorage.setItem('draftbox.token',token);
    const nativeSet=setTimeout.bind(window),nativeClear=clearTimeout.bind(window),timers=new Map();
    window.setTimeout=(callback,delay,...args)=>{
      if(delay===2000&&String(callback).includes('requestAutomaticResults')){
        const id=nativeSet(()=>{},2147483647);timers.set(id,()=>{nativeClear(id);timers.delete(id);callback(...args);});return id;
      }
      return nativeSet(callback,delay,...args);
    };
    window.clearTimeout=id=>{timers.delete(id);nativeClear(id);};
    window.nextRound=()=>{const next=timers.values().next().value;if(next)next();};
    window.roundWaiting=()=>timers.size>0;
  },token);
}
for(const width of [1280,390])test(`online automatic season, rematch and fresh room stay isolated at ${width}px`,{timeout:120000},async({page,browser,request})=>{
  test.setTimeout(120000);
  const suffix=width+'_'+Date.now().toString().slice(-6);
  const register=async name=>{const response=await request.post('/api/auth/register',{data:{username:name,email:name+'@test.invalid',password:'test-password'}});expect(response.status()).toBe(201);return response.json();};
  const host=await register('sh_'+suffix),guest=await register('sg_'+suffix);
  await page.setViewportSize({width,height:900});
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4322',viewport:{width,height:900}}),friend=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));friend.on('pageerror',error=>errors.push(error.message));
  try{
    await setup(page,host.token);await setup(friend,guest.token);await page.goto('/');
    await page.locator('#modeCreate').click();await page.locator('#crMode [data-value="league"]').click();await page.locator('#btnSelectLeague').click();
    await page.locator('#crResultsOnly [data-value="true"]').click();await page.locator('#crSquadMode [data-value="real"]').click();await page.locator('#crSlots').fill('2');
    await page.locator('#btnCreateRoom').click();await expect(page.locator('.code-display')).toBeVisible();
    const code=(await page.locator('.code-display').textContent()).trim();
    const room=await(await request.get('/api/rooms/'+code,{headers:{Authorization:'Bearer '+host.token}})).json();
    const otherClub=room.leagueClubs.find(club=>club.code!==room.members[0].clubCode).code;
    await request.post('/api/rooms/'+code+'/join',{headers:{Authorization:'Bearer '+guest.token},data:{clubCode:otherClub}});
    await friend.goto('/#lobby/'+code);await expect(page.locator('#memberList li')).toHaveCount(2);
    await page.locator('#btnStart').click();
    for(const player of [page,friend]){await expect(player.locator('#squadProgress')).toContainText('11');await player.locator('#btnLockTacticalStyle').click();}
    await page.locator('#btnStartTournament').click();
    const check=async(player,day)=>{
      await expect(player.locator('#leagueZone')).toContainText('Matchday '+day+' / 34');
      await expect(player.locator('#leagueResultMatchday')).toHaveValue(String(day));
      await expect(player.locator('#liveZone')).toBeHidden();await expect(player.locator('#continueZone')).toBeHidden();
    };
    const advance=async(player,day)=>{await expect.poll(()=>player.evaluate(()=>window.roundWaiting())).toBe(true);await player.evaluate(()=>window.nextRound());await check(player,day);};
    for(const player of [page,friend])await check(player,1);
    for(let day=2;day<=17;day++)for(const player of [page,friend])await advance(player,day);
    await page.locator('#btnSkipTransfers').click();await expect(page.locator('#leagueTransferWaiting')).toContainText(guest.user.username);
    await friend.locator('#btnSkipTransfers').click();for(const player of [page,friend])await check(player,18);
    for(let day=19;day<=34;day++)for(const player of [page,friend])await advance(player,day);
    for(const player of [page,friend])await expect(player.locator('#seasonResults')).toContainText('306 matches');
    const completed=await(await request.get('/api/rooms/'+code,{headers:{Authorization:'Bearer '+host.token}})).json();
    await page.locator('#btnRematch').click();await expect(page.locator('.code-display')).toBeVisible();
    const rematch=(await page.locator('.code-display').textContent()).trim();expect(rematch).not.toBe(code);
    await expect(friend.locator('.code-display')).toHaveText(rematch);
    await page.locator('#btnStart').click();await expect(page.locator('#squadProgress')).toContainText('11');
    await page.evaluate(()=>{window.abandonedSocket=App.state.socket;});
    await page.locator('#btnHome').click();await page.locator('#modeCreate').click();await page.locator('#btnCreateRoom').click();
    await expect(page.locator('.code-display')).toBeVisible();const fresh=(await page.locator('.code-display').textContent()).trim();expect(fresh).not.toBe(rematch);
    await page.evaluate(({oldCode})=>{
      abandonedSocket.emitEvent(['tournament:started',{}]);
      abandonedSocket.emitEvent(['room:rematchReady',{newCode:oldCode}]);
      abandonedSocket.emitEvent(['room:state',{stage:'drafting',code:oldCode}]);
    },{oldCode:rematch});
    await expect(page.locator('.code-display')).toHaveText(fresh);expect(await page.evaluate(()=>App.state.roomCode)).toBe(fresh);
    let release;const received=new Promise(resolve=>release=resolve);let waiting;
    const delayed=new Promise(resolve=>waiting=resolve);
    await page.route('**/api/rooms/'+code,async route=>{waiting();await received;await route.fulfill({json:completed});});
    await page.evaluate(old=>App.goLobby(old),code);await delayed;await page.locator('#btnHome').click();
    const response=page.waitForResponse(result=>result.url().endsWith('/api/rooms/'+code));release();await(await response).finished();
    await expect(page.locator('#modeCreate')).toBeVisible();expect(await page.evaluate(()=>App.state.roomCode)).toBe(null);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
