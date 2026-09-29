// No real API/database access: browser submits only to intercepted test responses.
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const release = JSON.parse(await readFile('scripts/migrate/certificate-consent-2026-09-28.json', 'utf8'));
const config = { clinicName: 'Тестовая клиника', years: [2026, 2025, 2024], relationships: [{code:'child',label:'ребёнком'}], policyUrl: '/politika', consent: { version: release.version, sha256: release.sha256, url: release.url } };
const server = createServer(async (req, res) => {
  try {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    const iframe = pathname === '/cert-request/clinic-1';
    const iframeJS = pathname === '/js/cert-request.js';
    const file = iframe ? '/root/loyalpro/frontend/cert-request.html' : iframeJS ? '/root/loyalpro/frontend/js/cert-request.js' : resolve('dist', '.' + pathname + (extname(pathname) ? '' : '.html'));
    if (!iframe && !iframeJS && !file.startsWith(resolve('dist') + '/')) throw new Error('path');
    const bytes = await readFile(file);
    res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.webp':'image/webp' })[extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args:['--no-sandbox'] });
const context = await browser.newContext({ reducedMotion:'reduce' });
await context.addInitScript(() => localStorage.setItem('peri_consent','0'));
let configMode = 'current', postMode = 'success';
const posts=[];
await context.route('**/api/public/cert-requests/**', route => {
  if (route.request().method() === 'POST') {
    posts.push(route.request().postDataJSON());
    return route.fulfill(postMode === 'stale' ? {status:400,json:{error:'validation',fields:['consent_version']}} : {json:{ok:true,applicationToken:'a'.repeat(48)}});
  }
  const consent = configMode === 'old' ? undefined : configMode === 'mismatch' ? {...config.consent,sha256:'0'.repeat(64)} : config.consent;
  return route.fulfill({json:{...config,consent}});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function open(path='/spravka') { await page.goto(base+path,{waitUntil:'networkidle'}); }
async function fill() {
  for (const [key,value] of Object.entries({last:'Тестов',first:'Тест',middle:'Тестович',birthdate:'1990-01-01',inn:'000000000000',doc_serie_number:'0000000000',doc_issue_date:'2010-01-01',phone:'+70000000000'})) await page.locator('#cr-payer_'+key).fill(value);
}
try {
  await open();assert.equal(await page.locator('#cr-consent').isChecked(),false);
  assert.equal(await page.locator('#cr-policy').getAttribute('href'),'/politika');
  assert.equal(await page.locator('#cr-consent-document').getAttribute('href'),'/'+release.slug);
  assert.equal(await page.locator('label[for="cr-consent"] #cr-policy').count(),0);
  await fill();await page.locator('#cr-submit').click();assert.equal(posts.length,0);
  await page.locator('#cr-consent').check();await page.locator('#cr-submit').click();
  await page.locator('#cr-ok-view').waitFor({state:'visible'});
  assert.equal(posts.at(-1).consent,true);assert.equal(posts.at(-1).consent_version,release.version);assert.equal(posts.at(-1).consent_sha256,release.sha256);
  for (const mode of ['old','mismatch']) {
    configMode=mode;await open();assert.equal(await page.locator('#cr-submit').isDisabled(),true);
    assert.match(await page.locator('#cr-error').innerText(),/Редакция согласия/);
  }
  configMode='current';postMode='stale';await open();await fill();await page.locator('#cr-consent').check();await page.locator('#cr-submit').click();
  await page.waitForFunction(()=>document.getElementById('cr-error').textContent.includes('Редакция согласия'));
  assert.equal(await page.locator('#cr-consent').isChecked(),false);assert.equal(await page.locator('#cr-submit').isDisabled(),true);
  postMode='success';
  await mkdir('docs/qa/certificate-consent',{recursive:true});
  for (const width of [375,800,1440]) {
    await page.setViewportSize({width,height:900});await open();
    await page.evaluate(()=>document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible')));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#cr-consent').scrollIntoViewIfNeeded();
    await page.screenshot({path:`docs/qa/certificate-consent/form-${width}.png`});
    const axe=await new AxeBuilder({page}).include('.cert-request').analyze();
    assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
  }
  await open('/'+release.slug);assert.match(await page.locator('main').innerText(),/cert-request-2026-09-28-v1/);
  await open('/politika');assert.match(await page.locator('main').innerText(),/ИНН/);
  await open('/cert-request/clinic-1');await fill();assert.equal(await page.locator('#cr-consent').isChecked(),false);
  assert.equal(await page.locator('#cr-consent-document').getAttribute('href'),release.url);
  await page.locator('#cr-consent').check();await page.locator('#cr-submit').click();await page.locator('#cr-ok-view').waitFor({state:'visible'});
  assert.equal(posts.at(-1).consent_version,release.version);assert.equal(posts.at(-1).consent_sha256,release.sha256);
  configMode='old';await open('/cert-request/clinic-1');assert.equal(await page.locator('#cr-submit').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: separate unchecked consent and policy; explicit acceptance payload; absent/stale config; stale POST resets consent; archived text; iframe parity; 375/800/1440 and axe. No real submissions.');
} finally {await browser.close();server.close();}
