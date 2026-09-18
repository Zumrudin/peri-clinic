import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:4335';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of [375, 390, 600, 800]) {
    for (const size of [3, 4]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.route(base + '/', async route => {
        const response = await route.fetch();
        const $ = load(await response.text());
        $('[data-gallery="clinic-team"] [data-card]').slice(size).remove();
        await route.fulfill({ response, body: $.html() });
      });
      await page.goto(base, { waitUntil: 'networkidle' });
      const cookie = page.locator('[data-cookie-accept]');
      if (await cookie.isVisible()) await cookie.click();
      const gallery = page.locator('[data-gallery="clinic-team"]');
      const rail = gallery.locator('[data-rail]');
      await gallery.scrollIntoViewIfNeeded();
      const ids = () => gallery.locator('[data-photo]').evaluateAll(photos => photos.map(p => p.dataset.id));
      const initial = await ids();
      const session = await context.newCDPSession(page);
      const swipe = async direction => {
        const box = await gallery.locator('[data-photo]').first().boundingBox();
        const x = box.x + box.width * (direction < 0 ? 0.85 : 0.15), y = box.y + box.height / 2;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 6; step++) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + direction * step * box.width * 0.11, y }] });
        }
        await page.waitForTimeout(150);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(50);
        await page.waitForFunction(() => !document.querySelector('[data-gallery="clinic-team"] [data-track]').style.transform);
        assert.equal(await page.locator('[data-lightbox]').evaluate(d => d.open), false);
        const geometry = await rail.evaluate(el => ({ scroll: el.scrollLeft, offset: el.firstElementChild.getBoundingClientRect().left - el.getBoundingClientRect().left }));
        assert.ok(Math.abs(geometry.scroll) < 2 && Math.abs(geometry.offset) < 2, `first card must be visible at rail start: ${JSON.stringify(geometry)}`);
      };
      for (let step = 1; step <= initial.length + 1; step++) {
        await swipe(-1);
        assert.equal((await ids())[0], initial[step % initial.length]);
      }
      await swipe(1);
      assert.deepEqual(await ids(), initial);
      const before = await ids();
      const position = await rail.evaluate(el => el.getBoundingClientRect().top);
      await gallery.locator('[data-photo]').nth(1).click({ position: { x: 12, y: 40 } });
      await page.locator('[data-close]').click();
      await page.waitForFunction(() => !document.querySelector('[data-lightbox]').open);
      assert.deepEqual(await ids(), before, 'closing a photo must preserve card order');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-id')), before[1]);
      assert.ok(Math.abs(await rail.evaluate(el => el.getBoundingClientRect().top) - position) < 2);
      await gallery.locator('[data-photo]').nth(1).click({ position: { x: 12, y: 40 } });
      await page.locator('[data-lightbox-next]').click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-lightbox]').open);
      assert.deepEqual(await ids(), before, 'browsing photos must preserve card order');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-id')), before[1]);
      await swipe(-1);
      assert.equal((await ids())[0], before[1]);
      await swipe(1);
      assert.deepEqual(await ids(), before);
      await context.close();
      console.log(`PASS ${width}px, ${size} cards: real touch in both directions, wrap, visible card position, close and focus restoration`);
    }
  }
} finally { await browser.close(); }
