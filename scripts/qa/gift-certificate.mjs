import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:4322';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of [375, 800, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const requests = [];
    page.on('request', r => { if (r.url().includes('/media/gift/') && r.resourceType() === 'media') requests.push(r.url()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    const section = page.locator('#gift-certificate');
    assert.equal(await section.evaluate(el => el.previousElementSibling.id), 'reviews');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(requests.length, 0, 'No gift media before the section is visible');
    assert.equal(await section.isVisible(), true);
    await section.scrollIntoViewIfNeeded();
    const video = section.locator('video');
    await video.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const v = document.querySelector('#gift-certificate video');
      return !v.paused && v.currentTime > 0;
    });
    const ratio = await video.evaluate(v => ({ fit: getComputedStyle(v).objectFit, ratio: v.clientWidth / v.clientHeight, natural: v.videoWidth / v.videoHeight }));
    assert.equal(ratio.fit, 'contain');
    assert.ok(Math.abs(ratio.ratio - 9 / 16) < 0.002);
    assert.equal(ratio.natural, 9 / 16);
    await section.locator('.gift__play').click();
    assert.equal(await video.evaluate(v => v.paused), true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await video.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    assert.equal(await video.evaluate(v => v.paused), true, 'Manual pause survives scrolling');
    await video.evaluate(v => { v.currentTime = 0; });

    const axe = await new AxeBuilder({ page }).include('#gift-certificate').analyze();
    assert.deepEqual(axe.violations.filter(v => ['serious','critical'].includes(v.impact)), []);
    await section.locator('.gift__play').click();
    await page.waitForFunction(() => !document.querySelector('#gift-certificate video').paused);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => document.querySelector('#gift-certificate video').paused);
    await section.locator('.gift__cta').click();
    assert.equal(await page.locator('#contact-sheet').evaluate(d => d.open), true);
    assert.ok(decodeURIComponent(await page.locator('#contact-sheet [data-whatsapp]').getAttribute('href')).includes('Подарочный сертификат'));
    console.log(`${width}px: order, layout, video, pause, contact CTA, axe OK`);
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(base, { waitUntil: 'networkidle' });
  const video = page.locator('#gift-certificate video');
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  assert.equal(await video.getAttribute('src'), null);
  assert.equal(await video.evaluate(v => v.paused), true);
  assert.ok(await video.getAttribute('poster'));
  await page.locator('.gift__play').click();
  await page.waitForFunction(() => !document.querySelector('#gift-certificate video').paused);
  console.log('Reduced motion: poster only until manual play OK');
  await page.close();
  for (const scenario of ['autoplay-denied', 'video-failed', 'no-js']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 900 }, javaScriptEnabled: scenario !== 'no-js' });
    if (scenario === 'autoplay-denied') await context.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('Denied', 'NotAllowedError')); };
    });
    const page = await context.newPage();
    if (scenario === 'video-failed') await page.route('**/media/gift/*.mp4', route => route.abort());
    await page.goto(base);
    const poster = page.locator('.gift__poster');
    await poster.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => { const image = document.querySelector('.gift__poster'); return image.complete && image.naturalWidth > 0; });
    assert.equal(await page.locator('#gift-certificate').getAttribute('data-frame'), null);
    assert.equal(await page.locator('#gift-certificate video').evaluate(v => getComputedStyle(v).opacity), '0');
    assert.equal(await poster.evaluate(img => new URL(img.src).origin === location.origin), true);
    console.log(`${scenario}: independent same-origin poster visible OK`);
    await context.close();
  }
} finally { await browser.close(); }
