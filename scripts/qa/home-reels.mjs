import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:4322';
const out = 'docs/qa/home-reels';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = [];
try {
  for (const width of [320, 375, 800, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/media/')) requests.push(request.url()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(requests.length, 0, 'no video download above fold');
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    const root = page.locator('[data-home-reels]');
    assert.equal(await root.count(), 1, 'CMS feed present');
    if (width > 800) {
      assert.equal(await root.isVisible(), false);
      assert.equal(requests.length, 0);
      results.push({ width, desktopHidden: true, videoRequests: 0 });
      await page.close(); continue;
    }
    await root.scrollIntoViewIfNeeded();
    const videos = root.locator('video');
    await page.waitForFunction(() => document.querySelector('[data-reel-video]').currentTime > .15);
    await page.waitForFunction(() => { const v = document.querySelectorAll('[data-reel-video]')[1]; return v.buffered.length > 0 && v.buffered.end(0) >= 1.9; });
    assert.equal(await videos.nth(1).evaluate(v => v.paused), true, 'neighbour buffered without playing');
    const ratio = await root.locator('[data-reel]').first().evaluate(el => el.clientWidth / el.clientHeight);
    assert.ok(Math.abs(ratio - 9 / 16) < .01);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await root.locator('[data-reel-toggle]').first().click();
    await page.waitForTimeout(150);
    assert.equal(await videos.first().evaluate(v => v.paused), true);
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await page.waitForTimeout(100);
    assert.equal(await videos.first().evaluate(v => v.paused), true, 'manual pause persists');
    await root.locator('[data-reel-toggle]').first().click();
    await page.waitForFunction(() => !document.querySelector('[data-reel-video]').paused);
    await root.locator('[data-reel-mute]').first().click();
    assert.equal(await videos.first().evaluate(v => v.muted), false);
    await root.locator('[data-reel-mute]').first().click();
    // Real touch input: horizontal swipe while preserving normal vertical page scroll.
    const box = await root.locator('[data-reel]').first().boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const y = Math.max(100, Math.min(600, box.y + box.height / 2));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .85, y }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (.85 - step * .08), y }] });
      await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelectorAll('[data-reel-video]')[1].currentTime > .1);
    assert.equal(await videos.first().evaluate(v => v.paused), true);
    const secondPosition = await videos.nth(1).evaluate(v => v.currentTime);
    await root.locator('[data-reels-rail]').focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => !document.querySelector('[data-reel-video]').paused, {}, { timeout: 2000 });
    await page.keyboard.press('End');
    await page.waitForFunction(t => { const v = document.querySelectorAll('[data-reel-video]')[1]; return !v.paused && v.currentTime >= t; }, secondPosition);
    await page.keyboard.press('Home');
    await page.waitForFunction(() => !document.querySelector('[data-reel-video]').paused, {}, { timeout: 2000 });
    await root.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - 100));
    await page.waitForTimeout(150);
    await root.screenshot({ path: `${out}/reels-${width}.png` });
    const axe = await new AxeBuilder({ page }).include('[data-home-reels]').analyze();
    assert.deepEqual(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id), []);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await videos.first().evaluate(v => v.paused), true);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => !document.querySelector('[data-reel-video]').paused);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    assert.equal(await videos.first().evaluate(v => v.paused), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await root.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    assert.equal(await videos.first().evaluate(v => v.paused), true);
    await root.locator('[data-reel-toggle]').first().click();
    await page.waitForFunction(() => !document.querySelector('[data-reel-video]').paused);
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await page.waitForTimeout(100);
    assert.equal(await videos.first().evaluate(v => v.paused), false, 'reduced motion allows manual playback');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100);
    assert.equal(await videos.first().evaluate(v => v.paused), true);
    assert.deepEqual(errors, []);
    results.push({ width, ratio, swipe: true, neighbourPreloaded: true, resumePosition: true, playback: true, pause: true, sound: true, keyboard: true, hiddenTabEvent: true, offscreen: true, reducedMotion: true, axe: 'pass' });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await page.route('**/media/**', route => route.abort());
  await page.goto(base);
  await page.locator('[data-home-reels]').scrollIntoViewIfNeeded();
  await page.locator('[data-reel-error]').first().waitFor({ state: 'visible' });
  assert.ok(await page.locator('[data-reel-error] a').first().getAttribute('href'));
  results.push({ failedVideoFallback: true });
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
