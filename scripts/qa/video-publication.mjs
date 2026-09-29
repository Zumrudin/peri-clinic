/** Compare a CMS snapshot with live cards and exercise every video in a real browser.
 * node scripts/qa/video-publication.mjs https://www.peri-clinic.ru /tmp/expected.json
 * Snapshot: [{path, items: [{title, video: {id}}]}], in CMS display order.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.argv[2];
const expected = JSON.parse(await readFile(process.argv[3], 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
 for (const width of [393, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width === 393, hasTouch: width === 393 });
  for (const entry of expected) {
   const page = await context.newPage();
   const errors = [];
   page.on('pageerror', error => { if (!error.message.includes('ResizeObserver loop')) errors.push(error.message); });
   page.on('response', response => { if (response.url().includes('/media/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
   const response = await page.goto(base + entry.path, { waitUntil: 'networkidle', timeout: 60000 });
   assert.equal(response.status(), 200);
   const cards = page.locator('[data-reel]');
   assert.equal(await cards.count(), entry.items.length, `card count: ${entry.path}`);
   for (let i = 0; i < entry.items.length; i++) {
    assert.equal((await cards.nth(i).locator('h3').textContent()).trim(), entry.items[i].title.trim());
    const video = cards.nth(i).locator('video');
    assert.ok((await video.getAttribute('data-src')).includes(entry.items[i].video.id));
    assert.match(await video.getAttribute('data-src'), /-mobile-v1\.mp4$/);
    assert.match(await video.getAttribute('data-hls'), /-hls-v1\/master\.m3u8$/);
   }
   if (width === 1440 && entry.path === '/') {
    assert.equal(await page.locator('[data-home-reels]').isVisible(), false, 'home feed is mobile-only');
   } else if (entry.items.length) {
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    await page.locator('[data-reels-rail]').scrollIntoViewIfNeeded();
    for (let i = 0; i < entry.items.length; i++) {
     await page.evaluate(index => {
      const rail = document.querySelector('[data-reels-rail]');
      const card = document.querySelectorAll('[data-reel]')[index];
      rail.scrollTo({ left: rail.scrollLeft + card.getBoundingClientRect().left - rail.getBoundingClientRect().left, behavior: 'instant' });
     }, i);
     await page.waitForFunction(index => {
      const v = document.querySelectorAll('[data-reel-video]')[index];
      return !v.paused && v.currentTime > .15 && v.videoWidth > 0 && !v.error;
     }, i, { timeout: 30000 });
     const data = await cards.nth(i).locator('video').evaluate(v => ({ time: v.currentTime, duration: v.duration, width: v.videoWidth, height: v.videoHeight, mode: v.dataset.streamMode }));
     assert.ok(Number.isFinite(data.duration) && data.duration > 0);
     assert.equal(await cards.nth(i).locator('[data-reel-error]').isVisible(), false);
     await cards.nth(i).locator('video').evaluate(v => { v.currentTime = Math.max(0, v.duration - 3); });
     await page.waitForFunction(index => {
      const v = document.querySelectorAll('[data-reel-video]')[index];
      return !v.seeking && !v.paused && v.currentTime > v.duration - 2.8 && !v.error;
     }, i, { timeout: 30000 });
     console.log(JSON.stringify({ viewport: width, page: entry.path, title: entry.items[i].title, tailPlayback: true, ...data }));
    }
   }
   assert.deepEqual(errors, [], `${entry.path}: browser/media errors`);
   await page.close();
  }
  await context.close();
 }
 console.log('PASS: CMS order, placement, derived URLs, and playback of every visible video at both widths');
} finally { await browser.close(); }
