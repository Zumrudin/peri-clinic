/** Checks clipping throughout real touch/mouse drags, including carousel wraparound.
 * Usage: node scripts/qa/gallery-clipping.mjs https://peri.zumrudin.ru
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4322';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of [375, 430, 800, 1440]) {
    const mobile = width <= 800;
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelector('[data-cookie-notice]')?.remove());
    const session = await context.newCDPSession(page);
    for (const id of ['clinic-rooms', 'clinic-team']) {
      const gallery = page.locator(`[data-gallery="${id}"]`);
      const rail = gallery.locator('[data-rail]');
      await rail.evaluate(el => window.scrollBy({ top: el.getBoundingClientRect().top - 180, behavior: 'instant' }));
      await page.waitForTimeout(350);
      const initial = await rail.boundingBox();
      if (!(await gallery.locator('.gallery-nav').isVisible())) {
        assert.ok(await rail.evaluate(el => el.scrollWidth <= el.clientWidth + 2));
        console.log(`PASS ${width}px ${id}: all cards fit`);
        continue;
      }
      for (const direction of [-1, 1]) {
        const x = initial.x + initial.width * (direction < 0 ? 0.85 : 0.15);
        const y = initial.y + 100;
        if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        else { await page.mouse.move(x, y); await page.mouse.down(); }
        for (let i = 1; i <= 10; i++) {
          const nextX = x + direction * initial.width * 0.65 * i / 10;
          if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: nextX, y }] });
          else await page.mouse.move(nextX, y);
          await page.waitForTimeout(25);
          const current = await rail.boundingBox();
          assert.ok(Math.abs(current.x - initial.x) < 1 && Math.abs(current.width - initial.width) < 1, `${width}px ${id}: clipping boundary moved`);
          // Hit-testing a card near the right boundary detects an invisible clip box
          // even when the card's own bounding rectangle appears correct.
          const visible = await rail.evaluate(el => {
            const r = el.getBoundingClientRect();
            const x = r.right - 8, y = r.top + 100;
            const card = [...el.querySelectorAll('[data-photo]')].find(photo => {
              const b = photo.getBoundingClientRect();
              return x > b.left + 3 && x < b.right - 3;
            });
            return !card || card.contains(document.elementFromPoint(x, y));
          });
          assert.ok(visible, `${width}px ${id}: photo clipped before the right boundary`);
        }
        assert.ok(await gallery.locator('[data-track]').evaluate(el => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41) > 5), `${width}px ${id} direction ${direction}: drag must actually move cards (${JSON.stringify(initial)})`);
        if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else await page.mouse.up();
        await page.waitForFunction(el => getComputedStyle(el).transform === 'none', await gallery.locator('[data-track]').elementHandle());
        assert.equal(await page.locator('[data-lightbox]').evaluate(el => el.open), false);
      }
      console.log(`PASS ${width}px ${id}: stationary clipping, visible photos, both drag directions`);
    }
    await context.close();
  }
} finally { await browser.close(); }
