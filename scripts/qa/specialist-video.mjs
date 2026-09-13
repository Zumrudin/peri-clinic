/** Tests an isolated build with the photo/video fixture from specialist-media-cms.mjs. */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:8097';
const out = 'docs/qa/specialist-video';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args:['--no-sandbox'] });
const results=[];
try {
  for (const width of [375,800,1440]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    const requests=[]; const errors=[];
    page.on('request',r=>requests.push(r.url()));
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/specialisty/botashev`,{waitUntil:'networkidle'});
    assert.equal(requests.some(u=>/t\.me|telegram\.org|telesco\.pe/.test(new URL(u).hostname)),false);
    assert.equal(requests.some(u=>u.includes('/media/specialists/')),false,'video must not download before opening');
    const link=page.locator('[data-media-open][data-video]');
    assert.equal(await link.count(),1);
    const videoUrl=await link.getAttribute('href');
    assert.ok(videoUrl.startsWith('/media/specialists/'));
    const range=await page.request.get(base+videoUrl,{headers:{Range:'bytes=0-1023'}});
    assert.equal(range.status(),206);
    assert.equal(range.headers()['content-type'],'video/mp4');
    assert.equal((await range.body()).length,1024);
    const start=Date.now();await link.click();
    const video=page.locator('[data-media-video]');
    await page.waitForFunction(()=>document.querySelector('[data-media-video]').currentTime>.1);
    const startMs=Date.now()-start;
    await video.evaluate(v=>{v.pause();v.currentTime=2;});
    await page.waitForFunction(()=>{const v=document.querySelector('[data-media-video]');return !v.seeking&&v.currentTime>=2;});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`${out}/player-${width}.png`});
    await page.keyboard.press('Escape');
    assert.equal(await video.getAttribute('src'),null);
    assert.equal(await video.evaluate(v=>v.paused),true);
    await page.locator('[data-media-open]:not([data-video])').first().click();
    await page.waitForFunction(()=>{const i=document.querySelector('[data-media-image]');return i.complete&&i.naturalWidth>0;});
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    results.push({width,startMs,range:'206 / 1024 bytes',seek:'passed',close:'stopped and unloaded',telegramRequests:0});
    await page.close();
  }
  const page=await browser.newPage();
  await page.route('**/media/specialists/**',route=>route.abort());
  await page.goto(`${base}/specialisty/botashev`);
  await page.locator('[data-media-open][data-video]').click();
  await page.locator('[data-media-error]').waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  const report={results,failedVideoFallback:'passed'};
  writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
