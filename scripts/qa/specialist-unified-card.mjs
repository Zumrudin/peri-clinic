import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const base = process.argv[2] || 'http://127.0.0.1:4341';
const out = 'docs/qa/specialist-unified-card';
mkdirSync(out, { recursive:true });
const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox'] });
const results = [];
try {
  for (const width of [1440,800,375,320]) {
    const context = await browser.newContext({ viewport:{width,height:1100}, reducedMotion:'reduce' });
    const page = await context.newPage();
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/specialisty/demo-specialist-1`, {waitUntil:'networkidle'});
    const cookies = page.locator('[data-cookie-accept]'); if (await cookies.isVisible()) await cookies.click();
    await page.locator('.specialist-page img[src]').evaluateAll(async images => Promise.all(images.map(async image => { image.loading='eager'; await image.decode(); })));
    const profile = await page.locator('.specialist-portrait').boundingBox();
    const info = await page.locator('.specialist-info').boundingBox();
    assert.ok(width <= 800 ? info.y >= profile.y + profile.height - 1 : info.x >= profile.x + profile.width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
    const links = page.locator('[data-media-open]');
    if (width > 800) {
      const boxes = await links.evaluateAll(elements => elements.map(e => e.getBoundingClientRect().y));
      assert.ok(boxes.every(y => Math.abs(y-boxes[0]) < 1));
      assert.equal(await page.locator('[data-media-pagination]').isVisible(),false);
    } else {
      await page.locator('[data-media-dot="2"]').click();
      await page.waitForFunction(() => document.querySelector('[data-media-dot="2"]')?.getAttribute('aria-current') === 'true');
      await page.locator('[data-media-dot="0"]').click();
      await links.first().focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await links.nth(1).evaluate(e => e === document.activeElement), true);
      await page.keyboard.press('Home');
    }
    await links.first().click();
    assert.equal(await page.locator('[data-media-dialog]').evaluate(d => d.open),true);
    await page.keyboard.press('Escape');
    assert.equal(await links.first().evaluate(e => e === document.activeElement),true);
    await page.waitForFunction(() => document.documentElement.style.overflow === '');
    await page.locator('.specialist-portrait').click();
    assert.equal(await page.locator('[data-lightbox]').evaluate(d => d.open),true);
    await page.keyboard.press('Escape');
    await page.locator('.specialist-booking').click();
    assert.equal(await page.locator('#contact-sheet').evaluate(d => d.open),true);
    await page.keyboard.press('Escape');
    const axe = await new AxeBuilder({page}).analyze();
    assert.deepEqual(axe.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
    await page.evaluate(() => document.activeElement?.blur());
    await page.locator('.specialist-page').screenshot({style:'header:not(.media-heading), .floating-contact, .mobile-cta-bar { visibility:hidden !important; }', path:`${out}/specialist-${width}.png`, animations:'disabled'});
    // Full three-part names and extended bios must fit the same layout.
    await page.locator('h1').evaluate(e => {e.textContent='Александрова Екатерина Константиновна';});
    await page.locator('.specialist-description').evaluate(e => {e.innerHTML += '<p>Описание профессионального опыта и направлений работы специалиста.</p>'.repeat(5);});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors,[]);
    results.push({width,layout:true,photo:true,booking:true,keyboard:true,axeSerious:0});
    await context.close();
    console.log(`PASS ${width}px`);
  }
  const page = await browser.newPage();
  await page.goto(`${base}/specialisty/demo-specialist-1`, {waitUntil:'networkidle'});
  // Generate an actual decodable local video fixture without an external service.
  const bytes = await page.evaluate(async () => {
    const canvas=document.createElement('canvas'); canvas.width=160; canvas.height=100;
    const stream=canvas.captureStream(10), recorder=new MediaRecorder(stream,{mimeType:'video/webm'}), chunks=[];
    const done=new Promise(resolve=>{recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));});
    recorder.ondataavailable=e=>chunks.push(e.data); recorder.start();
    for (let i=0;i<20;i++) { const ctx=canvas.getContext('2d'); ctx.fillStyle=i%2?'#ede9df':'#f6f4ef'; ctx.fillRect(0,0,160,100); await new Promise(resolve=>setTimeout(resolve,50)); }
    recorder.stop(); const result=await done; stream.getTracks().forEach(track=>track.stop()); return result;
  });
  await page.route('**/qa-video.webm', route => route.fulfill({status:200,contentType:'video/webm',body:Buffer.from(bytes)}));
  const link=page.locator('[data-media-open]').nth(1);
  await link.evaluate(a=>{a.href='/qa-video.webm';a.dataset.video='/qa-video.webm';});
  await link.click();
  const video=page.locator('[data-media-video]');
  assert.equal(await video.isVisible(),true);
  assert.equal(await video.evaluate(v=>v.paused),true);
  await video.evaluate(v=>v.play());
  assert.equal(await video.evaluate(v=>v.paused),false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => { const v=document.querySelector('[data-media-video]'); return v.paused && !v.hasAttribute('src'); });
  assert.equal(await link.evaluate(e=>e===document.activeElement),true);
  results.push({videoPlayback:true,autoplay:false,closeStopsPlayback:true});
  await page.close();
  const nojs = await browser.newPage({javaScriptEnabled:false,viewport:{width:375,height:900}});
  await nojs.goto(`${base}/specialisty/demo-specialist-1`);
  assert.ok(await nojs.locator('[data-media-open]').first().getAttribute('href'));
  assert.equal(await nojs.locator('[data-media-pagination]').isVisible(),false);
  const original = new URL(await nojs.locator('[data-media-open]').first().getAttribute('href'),base).href;
  await Promise.all([nojs.waitForURL(original),nojs.locator('[data-media-open]').first().click()]);
  assert.equal(nojs.url(),original);
  results.push({noJavaScriptPhotoLink:true});
  writeFileSync(`${out}/checks.json`,JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally { await browser.close(); }
