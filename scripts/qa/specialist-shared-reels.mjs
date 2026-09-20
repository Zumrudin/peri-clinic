import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
const out = 'docs/qa/specialist-shared-reels';
mkdirSync(out, { recursive: true });

const base = process.argv[2] || 'http://127.0.0.1:4322';
const path = process.argv[3] || '/specialisty/botashev';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of [375, 800, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}${path}`);
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    const root = page.locator('[data-home-reels]');
    await root.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-reel-video]').currentTime > .1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.waitForFunction(() => document.querySelector('[data-reel]').hasAttribute('data-caption-hidden'));
    const first = root.locator('[data-reel]').first();
    await first.locator('[data-reel-mute]').click();
    assert.equal(await first.locator('video').evaluate(v => v.muted), false);
    await first.locator('[data-reel-toggle]').click();
    assert.equal(await first.locator('video').evaluate(v => v.paused), true);
    await first.locator('[data-reel-toggle]').click();
    await page.waitForFunction(() => !document.querySelector('[data-reel-video]').paused);
    if (await root.locator('[data-reel]').count() > 1) {
      await first.locator('video').evaluate(v => { v.currentTime = v.duration - .3; });
      await page.waitForFunction(() => document.querySelectorAll('[data-reels-dot]')[1].getAttribute('aria-current') === 'true');
      await page.waitForFunction(() => document.querySelectorAll('[data-reel-video]')[1].currentTime > .1);
      assert.equal(await first.locator('video').evaluate(v => v.paused), true);
    }
    const rail = root.locator('[data-reels-rail]');
    await rail.focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-reels-dot]')].at(-1).getAttribute('aria-current') === 'true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-reel-video]')].every(v => v.paused));
    await rail.focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('[data-reels-rail]').scrollLeft < 2);
    await root.screenshot({ path: `${out}/reels-${width}.png` });
    const axe = await new AxeBuilder({ page }).include('[data-home-reels]').analyze();
    assert.deepEqual(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)), []);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}: playback, caption, sound, pause, advance, keyboard, reduced motion, accessibility`);
    await context.close();
  }
} finally { await browser.close(); }
