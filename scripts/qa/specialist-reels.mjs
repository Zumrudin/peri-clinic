import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { load } from 'cheerio';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4348';
const out = 'docs/qa/specialist-reels';
mkdirSync(out, { recursive:true });
const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox'] });
const results = [];
try {
  for (const width of [375, 800, 1440]) {
    const page = await browser.newPage({ viewport:{ width, height:1000 } });
    page.setDefaultTimeout(15000);
    console.log('Checking', width);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Duplicate demo cards only in this browser response to exercise desktop overflow.
    await page.route('**/specialisty/demo-specialist-1', async route => {
      const response = await route.fetch();
      const $ = load(await response.text());
      const rail = $('[data-media-rail]');
      rail.append(rail.html());
      rail.children().each((i, el) => $(el).attr('id', `specialist-media-${i}`));
      await route.fulfill({ response, body:$.html() });
    });
    await page.goto(`${base}/specialisty/demo-specialist-1`, { waitUntil:'load' });
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    const root = page.locator('[data-specialist-media]');
    await root.scrollIntoViewIfNeeded();
    const rail = root.locator('[data-media-rail]');
    assert.equal(await root.locator('h2').textContent(), 'Практика и события');
    assert.ok(await rail.evaluate(el => el.scrollWidth > el.clientWidth));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const ratio = await root.locator('.media-cover').first().evaluate(el => el.clientWidth / el.clientHeight);
    assert.ok(Math.abs(ratio - 9/16) < .01);
    await root.locator('.media-cover img').evaluateAll(images => Promise.all(images.map(img => { img.loading = 'eager'; return img.decode(); })));
    await root.screenshot({ path:`${out}/reels-${width}.png` });
    await root.locator('[data-media-next]').click();
    await page.waitForFunction(() => document.querySelector('[data-media-rail]').scrollLeft > 30);
    await page.waitForTimeout(500);
    await root.locator('[data-media-prev]').click();
    await page.waitForFunction(() => document.querySelector('[data-media-rail]').scrollLeft < 3);
    const first = root.locator('[data-media-open]').first();
    await first.focus();
    await page.keyboard.press('End');
    assert.equal(await root.locator('[data-media-open]').last().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Home');
    await first.click();
    await page.waitForFunction(() => { const img = document.querySelector('[data-media-image]'); return img.complete && img.naturalWidth > 0; });
    await page.keyboard.press('Escape');
    assert.equal(await first.evaluate(el => el === document.activeElement), true);
    // The existing viewer gets a local test video; no CMS data is changed.
    await page.route('**/qa-reels-video.mp4', route => route.fulfill({ path:'.cache/specialist-videos/bd2faf94-3efc-4e1b-9b46-4c795cc4232d-3cccdb4d138640b1.mp4', contentType:'video/mp4' }));
    await first.evaluate(el => { el.dataset.video = '/qa-reels-video.mp4'; el.href = '/qa-reels-video.mp4'; });
    await first.click();
    await page.waitForFunction(() => document.querySelector('[data-media-video]').currentTime > .1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-media-video]').hasAttribute('src'));
    await page.emulateMedia({ reducedMotion:'reduce' });
    await root.locator('[data-media-next]').click();
    assert.ok(await rail.evaluate(el => el.scrollLeft > 30));
    assert.deepEqual(errors, []);
    results.push({ width, overflow:'pass', arrows:'pass', keyboard:'pass', photo:'pass', video:'pass', reducedMotion:'pass' });
    await page.close();
  }
  for (const count of [1, 3]) {
    const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
    await page.route('**/specialisty/demo-specialist-1', async route => {
      const response = await route.fetch();
      const $ = load(await response.text());
      $('[data-media-rail]').children().slice(count).remove();
      await route.fulfill({ response, body:$.html() });
    });
    await page.goto(`${base}/specialisty/demo-specialist-1`, { waitUntil:'load' });
    assert.equal(await page.locator('[data-media-controls]').isVisible(), false);
    assert.equal(await page.locator('[data-media-pagination]').isVisible(), false);
    await page.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ fixture:'Six demo cards; local video injected for playback check', results }, null, 2));
  console.log(results);
} finally { await browser.close(); }
