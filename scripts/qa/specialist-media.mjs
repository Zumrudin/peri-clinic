/** Run against an isolated build containing /specialisty/botashev and its public Telegram video. */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4321';
const out = 'docs/qa/specialist-media';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = [];
try {
  for (const width of [375, 800, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    // Substitute only in this browser's response; no CMS writes or fixture pages in the site.
    await page.route('**/specialisty/botashev', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replaceAll('peri_clinic/2055', 'peri_clinic/2048') });
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/specialisty/botashev`, { waitUntil: 'load' });
    const post = page.locator('div[data-telegram-post]');
    const start = Date.now();
    await post.scrollIntoViewIfNeeded();
    await post.locator('iframe').waitFor({ timeout: 20000 });
    const frame = await post.locator('iframe').elementHandle().then(el => el.contentFrame());
    await frame.waitForSelector('video', { state: 'attached', timeout: 20000 });
    const widgetMs = Date.now() - start;
    const before = await frame.locator('video').first().evaluate(v => ({ readyState: v.readyState, duration: v.duration, paused: v.paused }));
    const playStart = Date.now();
    // Mute to avoid autoplay policy affecting this automated network/playback measurement.
    await frame.locator('video').first().evaluate(async v => { v.muted = true; await Promise.race([v.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('Playback timed out')), 20000))]); });
    await frame.waitForFunction(() => document.querySelector('video')?.currentTime > 0.1, undefined, { timeout: 20000 });
    const playbackMs = Date.now() - playStart;
    await frame.waitForFunction(() => document.querySelector('video')?.currentTime > 3, undefined, { timeout: 15000 });
    assert.equal(await post.locator('iframe').evaluate(f => f.clientWidth <= f.parentElement.clientWidth + 1), true, 'widget clipped by its card');
    await frame.locator('video').first().evaluate(v => v.pause());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page overflow');
    assert.equal(await page.locator('[data-media-open]').count() > 0, true);
    await page.locator('[data-media-open]').first().click();
    await page.locator('[data-media-dialog][open]').waitFor();
    assert.equal(await page.locator('[data-media-image]').evaluate(i => i.complete && i.naturalWidth > 0), true);
    await page.keyboard.press('Escape');
    await post.scrollIntoViewIfNeeded();
    await post.evaluate(e => window.scrollTo(0, scrollY + e.getBoundingClientRect().top - 100));
    await page.screenshot({ path: `${out}/telegram-${width}.png` });
    results.push({ width, widgetMs, playbackMs, before, errors });
    await page.close();
  }
  const original = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await original.goto(`${base}/specialisty/botashev`);
  await original.locator('div[data-telegram-post]').scrollIntoViewIfNeeded();
  const originalFrame = original.frameLocator('[data-telegram-post] iframe');
  await originalFrame.getByText('Media is too big', { exact: true }).waitFor({ timeout: 20000 });
  await original.screenshot({ path: `${out}/original-video-unavailable-375.png` });
  await original.close();
  const blocked = await browser.newPage();
  await blocked.route('https://telegram.org/**', route => route.abort());
  await blocked.goto(`${base}/specialisty/botashev`);
  const post = blocked.locator('div[data-telegram-post]');
  await post.scrollIntoViewIfNeeded();
  await post.locator('[data-telegram-status]').filter({ hasText: 'дольше обычного' }).waitFor();
  assert.equal(await post.locator('a').getAttribute('href'), 'https://t.me/peri_clinic/2055');
  await blocked.close();
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, blockedFallback: 'passed', originalVideo: 'Telegram reports Media is too big; not playable in the widget', playablePost: 'https://t.me/peri_clinic/2048' }, null, 2));
  console.log(JSON.stringify({ results, blockedFallback: 'passed', originalVideo: 'Telegram reports Media is too big; not playable in the widget', playablePost: 'https://t.me/peri_clinic/2048' }, null, 2));
} finally { await browser.close(); }
