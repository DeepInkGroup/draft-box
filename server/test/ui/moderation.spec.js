const {test,expect}=require('@playwright/test');
const path=require('node:path');
for(const width of [1280,390])test(`admin kick, ban, unban and confirmed deletion at ${width}px`,async({page,browser,request})=>{
  await page.setViewportSize({width,height:900});
  const name='mod_ui_'+width+'_'+Date.now().toString().slice(-5);
  const account=await(await request.post('/api/auth/register',{data:{username:name,email:name+'@test.invalid',password:'test-password'}})).json();
  const admin=await(await request.post('/api/auth/login',{data:{username:'Admin',password:'ui-admin-password'}})).json();
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4322'}),victim=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));victim.on('pageerror',error=>errors.push(error.message));
  try{
    for(const target of [page,victim]){
      await target.route('https://cdn.socket.io/**',route=>route.fulfill({path:path.join(__dirname,'../../node_modules/socket.io/client-dist/socket.io.min.js'),contentType:'application/javascript'}));
      for(const host of ['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'])await target.route(`https://${host}/**`,route=>route.abort());
    }
    await page.addInitScript(token=>sessionStorage.setItem('draftbox.token',token),admin.token);
    await victim.goto('/');
    const signIn=async()=>{await victim.locator('#authUsername').fill(name);await victim.locator('#authPassword').fill('test-password');await victim.locator('#authSubmit').click();};
    await signIn();await expect(victim.locator('#modeCreate')).toBeVisible();await victim.evaluate(()=>App.ensureSocket());
    await page.goto('/#admin/users');await page.locator('#adminUserSearch').fill(name);
    await page.getByRole('button',{name:'Inspect '+name,exact:true}).click();
    const action=async kind=>{await page.locator(`[data-moderate="${kind}"]`).click();await page.locator('#adminConfirmAction').click();};
    await victim.locator('#btnProfile').click();await expect(victim.locator('#profileDialog')).toBeVisible();
    await action('kick');await expect(victim.locator('#authSubmit')).toBeVisible();await expect(victim.locator('#profileDialog')).toBeHidden();await signIn();await expect(victim.locator('#modeCreate')).toBeVisible();await victim.evaluate(()=>App.ensureSocket());
    await action('ban');await expect(victim.locator('#authSubmit')).toBeVisible();await signIn();await expect(victim.locator('#authError')).toContainText('banned');
    await expect(page.locator('#adminModeration')).toContainText('Banned');await action('unban');await signIn();await expect(victim.locator('#modeCreate')).toBeVisible();await victim.evaluate(()=>App.ensureSocket());
    await page.locator('[data-moderate="delete"]').click();await expect(page.locator('#adminConfirmAction')).toBeDisabled();
    await page.locator('#adminDeleteUsername').fill('wrong');await expect(page.locator('#adminConfirmAction')).toBeDisabled();
    await page.locator('#adminDeleteUsername').fill(name);await expect(page.locator('#adminConfirmAction')).toBeEnabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#adminModeration').screenshot({path:`test-results/admin-moderation-${width}.png`});
    await page.locator('#adminConfirmAction').click();await expect(page.locator('#adminUserDetail')).toBeHidden();await expect(victim.locator('#authSubmit')).toBeVisible();
    await expect(page.locator('#adminUsersTable')).toContainText('No matching accounts');
    expect((await request.get('/api/auth/me',{headers:{Authorization:'Bearer '+account.token}})).status()).toBe(401);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
