import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:4322';
const output = process.argv[3] || 'docs/qa/equipment-carousel';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of (process.env.QA_WIDTHS || '320,375,390,600,800,801,1440').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width <= 800, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    const root = page.locator('#equipment');
    const rail = root.locator('[data-rail]');
    const track = root.locator('[data-track]');
    const cards = root.locator('[data-card]');
    await root.scrollIntoViewIfNeeded();
    await page.waitForTimeout(750);
    const names = () => cards.locator('h3').allTextContents();
    const initial = await names();
    const settled = async () => { await page.waitForTimeout(50); await page.waitForFunction(() => !document.querySelector('#equipment [data-track]').style.transform); };
    assert.ok(initial.length >= 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no page overflow');
    await root.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => { img.loading = 'eager'; return img.decode(); })));
    assert.equal(await root.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)), true, 'equipment images load');
    if (width <= 800) {
      assert.equal(await root.getAttribute('data-interactive'), '');
      assert.equal(await cards.first().locator('.machine-card__more').isVisible(), true);
      const cardBox = await cards.first().boundingBox();
      const railBox = await rail.boundingBox();
      assert.ok(cardBox.width < railBox.width && cardBox.width > railBox.width * 0.6, 'large card and next preview');
      // Both buttons wrap across the entire collection, including devices formerly hidden.
      for (let i = 1; i <= initial.length; i++) {
        await root.locator('[data-rail-next]').click(); await settled();
        assert.equal((await names())[0], initial[i % initial.length]);
      }
      await root.locator('[data-rail-prev]').click(); await settled();
      assert.equal((await names())[0], initial.at(-1));
      await rail.focus(); await page.keyboard.press('ArrowRight');
      assert.deepEqual(await names(), initial);
      const session = await context.newCDPSession(page);
      const swipe = async direction => {
        await cards.first().locator('img').scrollIntoViewIfNeeded();
        const box = await cards.first().locator('img').boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + direction * i * 15, y }] });
          await page.waitForTimeout(16);
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(50); await settled();
        assert.equal(new URL(page.url()).pathname, '/', 'swiping a linked photo must not navigate');
        const geometry = await rail.evaluate(el => ({ scroll: el.scrollLeft, offset: el.querySelector('[data-card]').getBoundingClientRect().left - el.getBoundingClientRect().left }));
        assert.ok(Math.abs(geometry.scroll) < 2 && Math.abs(geometry.offset) < 2, 'land on a complete card');
      };
      await swipe(-1);
      assert.notEqual((await names())[0], initial[0]);
      await swipe(1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const beforeReduced = await names();
      await root.locator('[data-rail-next]').click();
      assert.equal((await names())[0], beforeReduced[1]);
      assert.equal(await track.evaluate(el => el.style.transform), '');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      // Cross the breakpoint mid-spring, then return to touch mode.
      await root.locator('[data-rail-next]').click();
      await page.setViewportSize({ width: 1100, height: 1000 });
      await page.waitForTimeout(150);
      assert.equal(await root.getAttribute('data-interactive'), null);
      assert.deepEqual(await names(), initial);
      assert.equal(await track.evaluate(el => el.style.transform), '');
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      await root.locator('[data-rail-next]').click(); await settled();
      assert.equal((await names())[0], initial[1]);
      await root.locator('[data-rail-prev]').click(); await settled();
      const href = await cards.first().getAttribute('href');
      await root.screenshot({ path: `${output}/equipment-${width}.png` });
      await cards.first().locator('.machine-card__more').click();
      await page.waitForURL(url => url.pathname === href);
    } else {
      assert.equal(await root.getAttribute('data-interactive'), null);
      assert.equal(await cards.first().locator('.machine-card__more').isVisible(), false);
      await root.locator('[data-rail-next]').click();
      await page.waitForTimeout(700);
      assert.ok(await rail.evaluate(el => el.scrollLeft) > 20, 'native desktop rail still scrolls');
      await root.screenshot({ path: `${output}/equipment-${width}.png` });
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px: layout, images, controls, touch, wrapping, links and responsive mode`);
  }
} finally { await browser.close(); }
