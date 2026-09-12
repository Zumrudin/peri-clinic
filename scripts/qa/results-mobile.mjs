/** Build first. Optional second URL compares desktop screenshots with the unchanged build. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import { load } from 'cheerio';

const base = process.argv[2] || 'http://127.0.0.1:4345';
const baseline = process.argv[3];
const out = 'docs/qa/results-mobile';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync), args: ['--no-sandbox'] });
const checks = [];
async function newPage(options) {
  const context = await browser.newContext(options);
  return context.newPage();
}
async function prepare(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#results').scrollIntoViewIfNeeded();
  await page.locator('#results').evaluate(async el => {
    el.querySelectorAll('.reveal').forEach(node => node.classList.add('is-visible'));
    await Promise.all([...el.querySelectorAll('img')].map(img => { img.loading = 'eager'; return img.decode(); }));
  });
  await page.addStyleTag({ content: '.header,.mobile-cta-bar,.floating-contact { visibility:hidden!important; }' });
  await page.evaluate(() => document.fonts.ready);
}
try {
  for (const width of [320, 375, 390, 430, 800, 801, 1024, 1440]) {
    const page = await newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('peri_consent', '1'));
    await prepare(page, base);
    const section = page.locator('#results');
    const rail = section.locator('[data-results-rail]');
    const count = await rail.locator('.result-card').count();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `page overflow ${width}`);
    if (width <= 800) {
      assert.equal(await section.locator('[data-results-navigation]').isVisible(), count > 1);
      const images = await rail.locator('.result-card:nth-child(-n+10) img').evaluateAll(imgs => imgs.map(img => {
        const source = img.parentElement.querySelector('source');
        return { fit: getComputedStyle(img).objectFit, actual: img.naturalWidth / img.naturalHeight, expected: Number(source.width) / Number(source.height) };
      }));
      for (const img of images) { assert.equal(img.fit, 'contain'); assert.ok(Math.abs(img.actual - img.expected) < 0.005, 'mobile asset preserves original aspect ratio'); }
      assert.equal(await section.locator('[data-results-prev]').isDisabled(), true);
      await section.locator('[data-results-next]').click();
      await page.waitForFunction(() => document.querySelector('[data-results-current]').textContent === '02');
      if (width === 390) await section.screenshot({ path: `${out}/results-390-second.png`, animations: 'disabled' });
      await rail.focus();
      await page.keyboard.press('End');
      await page.waitForFunction(total => document.querySelector('[data-results-current]').textContent === String(total).padStart(2, '0'), Math.min(count, 10));
      assert.equal(await section.locator('[data-results-next]').isDisabled(), true);
      if (width === 390) await section.screenshot({ path: `${out}/results-390-last.png`, animations: 'disabled' });
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('[data-results-current]').textContent === '01');
      // Native scrolling (the same path as a touch swipe) must update navigation.
      await rail.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
      await page.waitForFunction(total => document.querySelector('[data-results-current]').textContent === String(total).padStart(2, '0'), Math.min(count, 10));
      await rail.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('[data-results-current]').textContent === '01');
      const axe = await new AxeBuilder({ page }).include('#results').analyze();
      assert.deepEqual(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id), []);
      await page.setViewportSize({ width: 1024, height: 1000 });
      assert.equal(await rail.getAttribute('tabindex'), null);
      assert.equal(await section.locator('[data-results-navigation]').isVisible(), false);
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await rail.getAttribute('tabindex'), '0');
      await rail.evaluate(el => el.blur());
    } else {
      assert.equal(await section.locator('[data-results-navigation]').isVisible(), false);
      if (baseline) {
        const before = await newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
        await before.addInitScript(() => localStorage.setItem('peri_consent', '1'));
        await prepare(before, baseline);
        const expected = await before.locator('#results').screenshot({ animations: 'disabled' });
        const actual = await section.screenshot({ animations: 'disabled' });
        await writeFile(`${out}/baseline-${width}.png`, expected);
        assert.ok(expected.equals(actual), `desktop screenshot changed at ${width}`);
        await before.close();
      }
    }
    await section.screenshot({ path: `${out}/results-${width}.png`, animations: 'disabled' });
    checks.push({ width, count, passed: true });
    await page.close();
  }

  // Exercise 10 and >10 records without changing published CMS content.
  for (const total of [10, 11]) {
    const page = await newPage({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce' });
    await page.route(`${base}/`, async route => {
      const response = await route.fetch();
      const $ = load(await response.text());
      const rail = $('[data-results-rail]');
      const cards = rail.children().toArray().map(el => $.html(el));
      rail.html(Array.from({ length: total }, (_, i) => cards[i % cards.length]).join(''));
      $('.results-navigation__counter').contents().last().replaceWith('10');
      await route.fulfill({ response, body: $.html() });
    });
    await prepare(page, base);
    assert.equal(await page.locator('.result-card:visible').count(), 10);
    await page.locator('[data-results-rail]').focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.querySelector('[data-results-current]').textContent === '10');
    assert.equal(await page.locator('[data-results-next]').isDisabled(), true);
    const last = await page.locator('.result-card').nth(9).boundingBox();
    assert.ok(last.x >= 0 && last.x + last.width <= 391, 'tenth card fully reachable');
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.locator('.result-card:visible').count(), total, 'mobile limit does not change desktop');
    await page.close();
    checks.push({ fixture: total, mobileVisible: 10, passed: true });
  }
  const nojs = await newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
  await nojs.goto(base);
  assert.equal(await nojs.locator('[data-results-navigation]').isVisible(), false);
  assert.equal(await nojs.locator('.result-card').first().evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await nojs.locator('#results > a').getAttribute('href'), '/result');
  await nojs.locator('[data-results-rail]').evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
  assert.ok(await nojs.locator('[data-results-rail]').evaluate(el => el.scrollLeft > 0));
  await nojs.close();
  await writeFile(`${out}/checks.json`, JSON.stringify({ checks, noJavaScript: true }, null, 2));
  console.log('Results carousel QA passed', JSON.stringify(checks));
} finally { await browser.close(); }
