import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:4322';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(base);
    await page.evaluate(() => { window.navigationTestMarker = true; });
    for (const route of ['/', '/kontakty', '/']) {
      if (route !== '/') {
        await page.evaluate(route => {
          const a = document.createElement('a'); a.href = route; a.textContent = 'QA'; document.body.append(a); a.click();
        }, route);
        await page.waitForURL(`**${route}`);
      }
      await page.evaluate(() => { window.giftNavigated = false; document.addEventListener('astro:page-load', () => { window.giftNavigated = true; }, { once: true }); });
      await page.locator('header a[href="/"]').first().click();
      await page.waitForFunction(() => window.giftNavigated);
      assert.equal(await page.evaluate(() => window.navigationTestMarker), true, 'ClientRouter navigation preserves the JS context');
      const video = page.locator('#gift-certificate video');
      await video.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const video = document.querySelector('#gift-certificate video');
        return !video.paused && video.currentTime > 0 && video.closest('section').hasAttribute('data-frame');
      }, null, { timeout: 10000 });
      await page.locator('.gift__play').click();
      assert.equal(await video.evaluate(v => v.paused), true);
      await page.locator('.gift__play').click();
      await page.waitForFunction(() => !document.querySelector('#gift-certificate video').paused);
      console.log(`${width}px: logo navigation from ${route}, autoplay, pause/resume OK`);
    }
    await page.close();
  }
} finally { await browser.close(); }
