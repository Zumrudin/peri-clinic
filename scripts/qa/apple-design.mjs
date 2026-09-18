/**
 * Behavioural QA for the apple-design fixes on the homepage
 * (docs/superpowers/specs/2026-09-18-apple-design-fixes-design.md).
 * Usage: node scripts/qa/apple-design.mjs <baseUrl>
 * Mobile checks drive real touch through CDP at 375px; desktop checks use the mouse at 1440px.
 * Exits non-zero on the first failed assertion.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = (process.argv[2] || 'http://127.0.0.1:4322').replace(/\/$/, '');
const executablePath =
  process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (name) => console.log(`PASS ${name}`);

const prep = async (page) => {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('peri_consent', '1');
    document.querySelector('[data-cookie-notice]')?.remove();
  });
};
const touch = (session, type, points) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points });
/** Straight-line touch swipe; `holdMs` pauses before lift-off so the release velocity is ~0. */
const swipe = async (session, from, to, { steps = 8, stepMs = 16, holdMs = 0, lift = true } = {}) => {
  await touch(session, 'touchStart', [from]);
  for (let i = 1; i <= steps; i++) {
    await touch(session, 'touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
    await sleep(stepMs);
  }
  if (holdMs) await sleep(holdMs);
  if (lift) await touch(session, 'touchEnd', []);
};
const translateX = (locator) =>
  locator.evaluate((el) => {
    const t = getComputedStyle(el).transform;
    return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41;
  });
const waitSettled = async (locator, timeout = 2500) => {
  const handle = await locator.elementHandle();
  await locator.page().waitForFunction((el) => getComputedStyle(el).transform === 'none', handle, { timeout });
};

try {
  // ---------- Mobile: real touch ----------
  const mobile = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  {
    const page = await mobile.newPage();
    await prep(page);
    const session = await mobile.newCDPSession(page);

    // Gallery rail: follows the finger, no jump on release, springs to the next card.
    let tested = 0;
    for (const id of ['clinic-rooms', 'clinic-team']) {
      const gallery = page.locator(`[data-gallery="${id}"]`);
      if (!(await gallery.locator('.gallery-nav').isVisible())) continue;
      tested++;
      const rail = gallery.locator('[data-track]'); // the moving element (the rail only clips)
      const first = gallery.locator('[data-photo]').first();
      await first.scrollIntoViewIfNeeded();
      await sleep(300);
      const box = await first.boundingBox();
      const ids = await gallery.locator('[data-photo]').evaluateAll((els) => els.map((el) => el.dataset.id));
      const y = box.y + box.height / 2;
      const startX = box.x + box.width * 0.9;
      // Slow drag of 70% of a card, then hold: velocity ~0, so only the position decides
      // (the first 10px are recognition slop and do not move the rail).
      await swipe(session, { x: startX, y }, { x: startX - box.width * 0.7, y }, { steps: 10, stepMs: 20, holdMs: 200, lift: false });
      const duringDrag = await translateX(rail);
      assert.ok(Math.abs(duringDrag) > box.width * 0.3, `${id}: rail follows the finger (tx=${duringDrag})`);
      await touch(session, 'touchEnd', []);
      const afterRelease = await rail.evaluate(
        (el) =>
          new Promise((r) =>
            requestAnimationFrame(() => {
              const t = getComputedStyle(el).transform;
              r(t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41);
            }),
          ),
      );
      assert.ok(Math.abs(afterRelease - duringDrag) < 40, `${id}: no jump on release (${duringDrag} → ${afterRelease})`);
      await waitSettled(rail);
      const newFirst = await first.getAttribute('data-id');
      assert.equal(newFirst, ids[1], `${id}: settled on the next card`);
      pass(`${id}: live drag, continuous release, snap to next card`);

      // Fast flick: momentum projection carries it more than one card when there are enough.
      if (ids.length >= 4) {
        const before = await first.getAttribute('data-id');
        const b2 = await first.boundingBox();
        await swipe(session, { x: b2.x + b2.width * 0.9, y }, { x: b2.x + b2.width * 0.3, y }, { steps: 4, stepMs: 12 });
        await waitSettled(rail);
        const after = await first.getAttribute('data-id');
        const advanced = (ids.indexOf(after) - ids.indexOf(before) + ids.length) % ids.length;
        assert.ok(advanced >= 2, `${id}: flick travelled ${advanced} cards (expected ≥ 2)`);
        pass(`${id}: flick projects momentum across ${advanced} cards`);
      }
    }
    assert.ok(tested > 0, 'at least one overflowing gallery at 375px');

    // Results progress bar tracks scroll position continuously.
    {
      const rail = page.locator('[data-results-rail]');
      await rail.scrollIntoViewIfNeeded();
      const n = Number(await page.locator('[data-results-total]').textContent());
      const fraction = 0.37;
      const scaleX = await rail.evaluate(async (el, f) => {
        el.style.scrollBehavior = 'auto';
        el.style.scrollSnapType = 'none'; // a programmatic scrollLeft would otherwise snap to a card
        el.scrollLeft = (el.scrollWidth - el.clientWidth) * f;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const t = getComputedStyle(document.querySelector('[data-results-progress]')).transform;
        return new DOMMatrixReadOnly(t).a;
      }, fraction);
      const expected = 1 / n + (1 - 1 / n) * fraction;
      assert.ok(Math.abs(scaleX - expected) < 0.03, `progress ${scaleX.toFixed(3)} ≈ ${expected.toFixed(3)} at 37% scroll`);
      pass('results progress bar is continuous');
    }

    // Contact sheet: drag shut, or spring back after a short pull.
    {
      const sheet = page.locator('#contact-sheet');
      const panel = sheet.locator('.sheet__panel');
      const openSheet = async () => {
        // The closed dialog stays displayed for its exit transition (display: allow-discrete);
        // a tap during that window lands on the backdrop, so wait until it is really gone.
        await page.waitForFunction(() => getComputedStyle(document.getElementById('contact-sheet')).display === 'none');
        await page.locator('.mobile-cta-bar [data-open-sheet]').tap();
        await page.waitForFunction(() => document.getElementById('contact-sheet').open);
        await sleep(500); // let the CSS entry finish
      };
      await openSheet();
      let b = await panel.boundingBox();
      await swipe(session, { x: b.x + b.width / 2, y: b.y + 12 }, { x: b.x + b.width / 2, y: b.y + 260 }, { steps: 6, stepMs: 14 });
      await page.waitForFunction(() => !document.getElementById('contact-sheet').open, undefined, { timeout: 2000 });
      pass('contact sheet dismissed by a downward flick');
      await openSheet();
      b = await panel.boundingBox();
      await swipe(session, { x: b.x + b.width / 2, y: b.y + 12 }, { x: b.x + b.width / 2, y: b.y + 50 }, { steps: 6, stepMs: 25, holdMs: 200 });
      await sleep(900);
      assert.equal(await sheet.evaluate((el) => el.open), true, 'sheet stays open after a short pull');
      assert.equal(await panel.evaluate((el) => el.style.transform), '', 'inline transform cleared after spring-back');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('contact-sheet').open);
      pass('contact sheet springs back after a short pull');
    }

    // Lightbox: opens with a morph, photo follows the finger, pages on release, flies back on Escape.
    {
      const photo = page.locator('[data-gallery="clinic-rooms"] [data-photo]').first();
      await photo.scrollIntoViewIfNeeded();
      await sleep(200);
      await photo.tap();
      const dialog = page.locator('[data-lightbox]');
      await page.waitForFunction(() => document.querySelector('[data-lightbox]').open);
      const image = dialog.locator('[data-lightbox-image]');
      const sawAnimation = await page.waitForFunction(
        () => document.querySelector('[data-lightbox-image]').getAnimations().length > 0,
        undefined,
        { timeout: 4000 },
      ).then(() => true, () => false);
      assert.ok(sawAnimation, 'lightbox photo animates out of its thumbnail on open');
      await page.waitForFunction(() => document.querySelector('[data-lightbox-image]').complete, undefined, { timeout: 8000 });
      await sleep(500);
      const original = await image.getAttribute('src');
      const ib = await image.boundingBox();
      const iy = ib.y + ib.height / 2;
      await swipe(session, { x: ib.x + ib.width * 0.8, y: iy }, { x: ib.x + ib.width * 0.5, y: iy }, { steps: 6, stepMs: 20, lift: false });
      const live = await translateX(image);
      assert.ok(Math.abs(live) > 40, `lightbox photo follows the finger (tx=${live})`);
      await touch(session, 'touchEnd', []);
      await page.waitForFunction((src) => document.querySelector('[data-lightbox-image]').getAttribute('src') !== src, original, { timeout: 2500 });
      await waitSettled(image, 3000);
      pass('lightbox photo tracks the swipe and pages with momentum');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-lightbox]').open, undefined, { timeout: 2500 });
      pass('lightbox closes on Escape (photo flies back)');
    }

    // Typography scales with the root font size (rem), so browser text-size settings apply.
    {
      const [before, after] = await page.evaluate(() => {
        const size = () => parseFloat(getComputedStyle(document.body).fontSize);
        const a = size();
        document.documentElement.style.fontSize = '20px';
        const b = size();
        document.documentElement.style.fontSize = '';
        return [a, b];
      });
      assert.ok(Math.abs(after / before - 1.25) < 0.01, `body font scales with root (${before}px → ${after}px)`);
      pass('type sizes are rem-based');
    }
    await page.close();
  }
  await mobile.close();

  // ---------- Desktop: mouse ----------
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  {
    const page = await desktop.newPage();
    await prep(page);

    // Sticky header: slides in past 120px and slides out (is-leaving) on the way back.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() => document.querySelector('[data-header]').classList.contains('is-sticky'));
    const states = await page.evaluate(async () => {
      const header = document.querySelector('[data-header]');
      const seen = new Set();
      window.scrollTo(0, 0);
      const start = performance.now();
      while (performance.now() - start < 700) {
        seen.add(header.className.split(' ').filter((c) => c.startsWith('is-')).sort().join('+') || 'plain');
        await new Promise((r) => setTimeout(r, 10));
      }
      return [...seen];
    });
    assert.ok(states.includes('is-leaving+is-sticky'), `header played its exit (${states.join(', ')})`);
    assert.ok(states.at(-1) === 'plain' || states.includes('plain'), `header released after the exit (${states.join(', ')})`);
    pass('sticky header exits along its entry path');

    // Press feedback on a service card: pointer-down scales it (:active), moving away cancels the click.
    {
      const card = page.locator('.service-card').first();
      await card.scrollIntoViewIfNeeded();
      await sleep(300);
      const b = await card.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await sleep(250);
      const scale = await card.evaluate((el) => {
        const t = getComputedStyle(el).transform;
        return t === 'none' ? 1 : new DOMMatrixReadOnly(t).a;
      });
      await page.mouse.move(5, 5);
      await page.mouse.up();
      assert.ok(scale < 1, `service card scales on press (${scale})`);
      pass('service card gives press feedback on pointer-down');
    }

    // Nav underline animates on transform, not `right`.
    const link = page.locator('.nav > a').first();
    const before = await link.evaluate((el) => getComputedStyle(el, '::after').transform);
    await link.hover();
    await sleep(350);
    const after = await link.evaluate((el) => getComputedStyle(el, '::after').transform);
    assert.notEqual(before, after, 'underline uses a transform');
    assert.ok(/^matrix\(1,/.test(after), `underline fully grown (${after})`);
    pass('nav underline grows via scaleX');

    // Desktop galleries: mouse drag follows too.
    const gallery = page.locator('[data-gallery="clinic-team"]');
    if (await gallery.locator('.gallery-nav').isVisible()) {
      const rail = gallery.locator('[data-track]');
      const first = gallery.locator('[data-photo]').first();
      await first.scrollIntoViewIfNeeded();
      await sleep(300);
      const b = await first.boundingBox();
      const y = b.y + b.height / 2;
      await page.mouse.move(b.x + b.width * 0.8, y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(b.x + b.width * 0.8 - (b.width * 0.5 * i) / 8, y);
        await sleep(16);
      }
      const live = await translateX(rail);
      assert.ok(Math.abs(live) > b.width * 0.3, `desktop rail follows the mouse (tx=${live})`);
      await page.mouse.up();
      await waitSettled(rail);
      pass('desktop gallery drag follows the mouse and settles');
    }

    // Reduced transparency: glass goes solid.
    const session = await desktop.newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    await sleep(100);
    const filter = await page.locator('[data-header]').evaluate((el) => getComputedStyle(el).backdropFilter);
    assert.equal(filter, 'none', 'header drops its blur under prefers-reduced-transparency');
    pass('translucent chrome honours prefers-reduced-transparency');
    await page.close();
  }
  await desktop.close();
  console.log('ALL PASS');
} finally {
  await browser.close();
}
