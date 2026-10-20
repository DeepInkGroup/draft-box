const {test,expect}=require('@playwright/test');
const path=require('node:path');
async function setup(page,token) {
  await page.route('https://cdn.socket.io/**',route=>route.fulfill({path:path.join(__dirname,'../../node_modules/socket.io/client-dist/socket.io.min.js'),contentType:'application/javascript'}));
  for(const host of ['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'])await page.route(`https://${host}/**`,route=>route.abort());
  await page.addInitScript(token=>{
    sessionStorage.setItem('draftbox.token',token);
    const start=setTimeout.bind(window),stop=clearTimeout.bind(window),timers=new Map();
    window.setTimeout=(fn,delay,...args)=>{
      if(delay===2000&&String(fn).includes('requestAutomaticResults')){
        const id=start(()=>{},2147483647);timers.set(id,()=>{stop(id);timers.delete(id);fn(...args);});return id;
      }return start(fn,delay,...args);
    };
    window.clearTimeout=id=>{timers.delete(id);stop(id);};
    window.nextSetupRound=()=>{const next=timers.values().next().value;if(next)next();};
    window.setupRoundWaiting=()=>timers.size>0;
  },token);
}
for(const width of [320,1280])test.describe('league setup windows '+width,()=>{
  test.use({viewport:{width,height:900},hasTouch:width===320,isMobile:width===320});
  test('every manager can change formation and tactics, including before the next season',async({page,browser,request})=>{
    test.setTimeout(150000);
    const suffix=width+'_'+Date.now().toString().slice(-6),errors=[];
    const register=async name=>{const response=await request.post('/api/auth/register',{data:{username:name,email:name+'@test.invalid',password:'test-password'}});expect(response.status()).toBe(201);return response.json();};
    const host=await register('mh_'+suffix),guest=await register('mg_'+suffix);
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4322',viewport:{width,height:900},hasTouch:width===320,isMobile:width===320}),friend=await context.newPage();
    for(const player of [page,friend])player.on('pageerror',error=>errors.push(error.message));
    const choice=(player,id,value)=>player.locator('#'+id+' [data-value="'+value+'"]').click();
    const fits=async player=>expect(await player.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const headers={Authorization:'Bearer '+host.token};
    try{
      await setup(page,host.token);await setup(friend,guest.token);await page.goto('/');
      await page.locator('#modeCreate').click();await choice(page,'crMode','league');await page.locator('#btnSelectLeague').click();
      for(const id of ['crMidseasonFormations','crMidseasonTactics','crEndseasonTactics'])await choice(page,id,'true');
      await choice(page,'crTransfers','false');await choice(page,'crResultsOnly','true');await choice(page,'crSquadMode','real');await page.locator('#crSlots').fill('2');
      await fits(page);await page.screenshot({path:`test-results/league-management-setup-${width}.png`,fullPage:true});
      await page.locator('#btnCreateRoom').click();await expect(page.locator('.code-display')).toBeVisible();
      const code=(await page.locator('.code-display').textContent()).trim();
      const room=await(await request.get('/api/rooms/'+code,{headers})).json();
      const clubCode=room.members[0].clubCode,other=room.leagueClubs.find(club=>club.code!==clubCode).code;
      await request.post('/api/rooms/'+code+'/join',{headers:{Authorization:'Bearer '+guest.token},data:{clubCode:other}});
      await friend.goto('/#lobby/'+code);await expect(page.locator('#memberList li')).toHaveCount(2);
      await expect(page.locator('#app')).toContainText('Mid-season formation changes: Enabled');
      await page.locator('#btnStart').click();
      for(const player of [page,friend])await player.locator('#btnLockTacticalStyle').click();
      await page.locator('#btnStartTournament').click();
      const check=async(player,day)=>{await expect(player.locator('#leagueZone')).toContainText('Matchday '+day+' / 34');await expect(player.locator('#liveZone')).toBeHidden();};
      const advance=async(player,day)=>{await expect.poll(()=>player.evaluate(()=>setupRoundWaiting())).toBe(true);await player.evaluate(()=>nextSetupRound());await check(player,day);};
      for(const player of [page,friend])await check(player,1);
      for(let day=2;day<=17;day++)for(const player of [page,friend])await advance(player,day);
      const squad=await(await request.get('/api/rooms/'+code+'/clubs/'+clubCode,{headers})).json();
      const original=squad.players.filter(player=>player.status==='Starting XI').map(player=>player.id).sort();
      for(const player of [page,friend]){
        await expect(player.locator('#transferZone')).toBeHidden();await expect(player.locator('#midseasonTacticsZone')).toBeVisible();
        await expect(player.locator('#midseasonFormationZone')).toBeVisible();await fits(player);
      }
      await page.locator('#midseasonFormation').selectOption('3-5-2');await expect(page.locator('#midseasonFormationPreview .pitch-dot')).toHaveCount(11);
      await page.locator('#midseasonFormationZone').screenshot({path:`test-results/league-management-formation-${width}.png`});
      await page.locator('#btnChangeLeagueFormation').click();await expect(page.locator('#midseasonFormationZone')).toBeHidden();
      await page.locator('#midseasonStyle').selectOption('vertical');await page.locator('#btnChangeLeagueTactic').click();
      await expect(page.locator('#leagueManagementWaiting')).toContainText(guest.user.username);
      await page.reload();await expect(page.locator('#leagueManagementWaiting')).toContainText(guest.user.username);
      await expect(page.locator('#midseasonFormationZone')).toBeHidden();expect(await page.evaluate(()=>setupRoundWaiting())).toBe(false);
      const updated=await(await request.get('/api/rooms/'+code+'/clubs/'+clubCode,{headers})).json();
      expect(updated.formation).toBe('3-5-2');expect(updated.players.filter(player=>player.status==='Starting XI').map(player=>player.id).sort()).toEqual(original);
      await friend.locator('#btnKeepLeagueFormation').click();await friend.locator('#midseasonStyle').selectOption('counter');await friend.locator('#btnChangeLeagueTactic').click();
      for(const player of [page,friend])await check(player,18);
      for(let day=19;day<=34;day++)for(const player of [page,friend])await advance(player,day);
      await page.locator('#btnNextLeagueSeason').click();
      for(const player of [page,friend]){
        await expect(player.locator('#leagueZone')).toContainText('Season 2');await check(player,0);
        await expect(player.locator('#midseasonTacticsZone')).toContainText('End-of-season Tactics');
        await expect(player.locator('#midseasonFormationZone')).toBeHidden();await fits(player);
      }
      await page.locator('#midseasonStyle').selectOption('counter');await page.locator('#btnChangeLeagueTactic').click();
      await page.reload();await check(page,0);await expect(page.locator('#leagueManagementWaiting')).toContainText(guest.user.username);
      await page.screenshot({path:`test-results/league-management-end-season-${width}.png`,fullPage:true});
      await friend.locator('#btnKeepLeagueTactic').click();for(const player of [page,friend])await check(player,1);
      const nextCode=page.url().split('/').pop();expect(nextCode).not.toBe(code);
      const meta=await(await request.get('/api/rooms/'+nextCode,{headers})).json();
      expect(meta.midseasonFormations).toBe(true);expect(meta.endseasonTactics).toBe(true);
      expect(meta.members.find(member=>member.userId===host.user.id).formation).toBe('3-5-2');
      expect(meta.members.find(member=>member.userId===host.user.id).tacticalStyle).toBe('counter');
      expect(errors).toEqual([]);
    }finally{await context.close();}
  });
});
