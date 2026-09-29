// Exercise the production controller with a fake counter. Never send analytics to Yandex.
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const remote = process.argv[2];
let server;
if (!remote) {
  server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url,'http://localhost').pathname;
      const file = resolve('dist', '.' + (path==='/'?'/index':path) + (extname(path)?'':'.html'));
      if (!file.startsWith(resolve('dist')+'/')) throw Error('path');
      const data = await readFile(file);
      res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
      res.end(data);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
}
const base = remote || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const KEY='peri_analytics_consent';
const copy=JSON.parse(await readFile('scripts/migrate/cookie-analytics-2026-09-28.json','utf8')).copy;
let checks=0;
async function fixture({counter=true,init,delay=false}={}) {
  const ctx=await browser.newContext({reducedMotion:'reduce'});
  if(init) await ctx.addInitScript(init);
  let tags=0, release;
  const gate=new Promise(r=>release=r);
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=req.url();
    if (/mc\.yandex|mc\.yandex\.com/.test(url)) {
      if(url.endsWith('/metrika/tag.js')) {
        tags++;if(delay) await gate;
        return route.fulfill({contentType:'text/javascript',body:`window.__ymCalls=[];window.ym=(...args)=>window.__ymCalls.push(args);`});
      }
      throw Error('Unexpected real analytics request: '+url);
    }
    // Production now ships the real counter, so both modes rewrite the page: fake counter or none at all.
    if(req.isNavigationRequest() && url.startsWith(base)) {
      const response=await route.fetch();
      const html=counter
        ?(await response.text()).replace(/data-counter(?:="[^"]*")?(?=\s|>)/,'data-counter="12345678"').replace(copy.inactive,copy.description)
        :(await response.text()).replace(/data-counter(?:="[^"]*")?(?=\s|>)/,'data-counter').replace(copy.description,copy.inactive).replace(/(data-cookie-accept)(?![^>]*disabled)/,'$1 disabled');
      return route.fulfill({response,body:html});
    }
    return route.continue();
  });
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/politika');
  await page.waitForFunction(()=>document.querySelector('[data-cookie-notice]')?.dataset.initialized==='true');
  return {ctx,page,tags:()=>tags,release,errors};
}
const visible=async p=>assert.equal(await p.locator('[data-cookie-notice]').isVisible(),true);
const calls=async p=>p.evaluate(()=>window.__ymCalls||[]);
const settings=async p=>{if(await p.locator('[data-cookie-notice]').isVisible()) return;await p.locator('[data-cookie-settings]').click();await visible(p);};
const accept=async p=>{await p.locator('[data-cookie-accept]').click();await p.waitForFunction(()=>window.__ymCalls?.some(x=>x[1]==='init'));};
try {
  console.log('Lifecycle');
  let f=await fixture();let p=f.page;
  await visible(p);assert.equal(f.tags(),0);
  await p.locator('[data-cookie-close]').click();assert.equal(f.tags(),0);
  await settings(p);await p.locator('[data-cookie-reject]').click();
  await p.reload();assert.equal(await p.locator('[data-cookie-notice]').isVisible(),false);assert.equal(f.tags(),0);
  await settings(p);await accept(p);assert.equal(f.tags(),1);
  const record=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
  assert.equal(record.choice,'accepted');assert.equal(record.version,'analytics-2026-09-28-v1');assert.match(record.sha256,/^[a-f0-9]{64}$/);assert.equal(record.counter,'12345678');
  await p.evaluate(()=>{document.cookie='_ym_uid=fake; path=/';localStorage.setItem('_ym_uid','fake');sessionStorage.setItem('_ym_test','fake');});
  await settings(p);await p.locator('[data-cookie-revoke]').click();
  assert.equal((await calls(p)).at(-1)[1],'destruct');
  assert.equal(await p.evaluate(()=>window.disableYaCounter12345678),true);
  assert.equal(await p.evaluate(()=>document.cookie.includes('_ym_uid')),false);
  assert.equal(await p.evaluate(()=>localStorage.getItem('_ym_uid')),null);
  const n=(await calls(p)).length;
  await p.evaluate(()=>{document.dispatchEvent(new CustomEvent('peri:contact',{detail:{goal:'contact_call'}}));document.dispatchEvent(new Event('astro:page-load'));});
  assert.equal((await calls(p)).length,n);
  await settings(p);await accept(p);assert.equal(f.tags(),1);
  const second=await f.ctx.newPage();await second.goto(base+'/politika');
  await second.waitForFunction(()=>window.__ymCalls?.some(x=>x[1]==='init'));
  await settings(p);await p.locator('[data-cookie-revoke]').click();
  await second.waitForFunction(()=>window.__ymCalls?.some(x=>x[1]==='destruct'));
  await second.close();
  await settings(p);await accept(p);
  await settings(p);
  await p.locator('.cookie-notice a[href="/soglasie-analitika-2026-09-28"]').click();
  await p.waitForURL('**/soglasie-analitika-2026-09-28');
  await p.waitForFunction(()=>window.__ymCalls?.some(x=>x[1]==='hit' && x[2].endsWith('/soglasie-analitika-2026-09-28')));
  assert.equal(f.tags(),2); // Initial document plus the second tab; SPA loads none.
  await p.evaluate(()=>document.dispatchEvent(new CustomEvent('peri:contact',{detail:{goal:'contact_call'}})));
  assert.equal((await calls(p)).at(-1)[1],'reachGoal');
  assert.deepEqual(f.errors,[]);checks+=12;await f.ctx.close();
  console.log('Invalid records');

  for(const mode of ['legacy','malformed','expired','revision','counter']) {
    f=await fixture();
    p=f.page;
    await p.evaluate(({mode,record,KEY})=>{
      localStorage.clear();
      if(mode==='legacy') localStorage.setItem('peri_consent','1');
      else if(mode==='malformed') localStorage.setItem(KEY,'{');
      else localStorage.setItem(KEY,JSON.stringify({...record,...(mode==='expired'?{expires:Date.now()-1}:mode==='revision'?{sha256:'0'.repeat(64)}:{counter:'87654321'})}));
    },{mode,record,KEY});
    await p.reload();await visible(p);assert.equal(f.tags(),0);checks++;await f.ctx.close();
  }
  console.log('Loading race');
  f=await fixture({delay:true});p=f.page;
  await p.locator('[data-cookie-accept]').click();await settings(p);await p.locator('[data-cookie-revoke]').click();f.release();
  await p.waitForFunction(()=>Array.isArray(window.__ymCalls));assert.equal((await calls(p)).length,0);checks++;await f.ctx.close();

  console.log('Blocked storage');
  f=await fixture({init:()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError');};}});p=f.page;
  await p.locator('[data-cookie-accept]').click();assert.equal(f.tags(),0);await visible(p);assert.match(await p.locator('[data-cookie-status]').innerText(),/Не удалось/);checks++;await f.ctx.close();

  console.log('No counter');
  f=await fixture({counter:false});p=f.page;assert.equal(await p.locator('[data-cookie-notice]').isVisible(),false);
  await settings(p);assert.equal(await p.locator('[data-cookie-accept]').isDisabled(),true);assert.equal(f.tags(),0);checks++;await f.ctx.close();

  console.log('Responsive and accessibility');
  f=await fixture();p=f.page;await mkdir('docs/qa/cookie-analytics',{recursive:true});
  for(const width of [375,800,1440]) {
    await p.setViewportSize({width,height:950});
    if(await p.locator('[data-cookie-notice]').isVisible()) await p.locator('[data-cookie-close]').click();
    await settings(p);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const axe=await new AxeBuilder({page:p}).include('[data-cookie-notice]').analyze();
    assert.deepEqual(axe.violations.filter(x=>['serious','critical'].includes(x.impact)),[]);
    await p.screenshot({path:`docs/qa/cookie-analytics/${remote?'production':'local'}-${width}.png`});checks++;
  }
  assert.deepEqual(f.errors,[]);await f.ctx.close();
  console.log(JSON.stringify({ok:true,checks,base}));
} finally {await browser.close();if(server) await new Promise(r=>server.close(r));}
