/** Build first; optionally supply a baseline preview to compare desktop geometry. */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { load } from 'cheerio';
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:4366';
const baseline = process.argv[3];
const paths = readdirSync('dist').filter(f => f.endsWith('.html') && load(readFileSync(`dist/${f}`, 'utf8'))('.treatment-cases').length).map(f => `/${f.replace('.html', '')}`);
assert.ok(paths.length, 'Expected treatment pages with results');
mkdirSync('docs/qa/services-results-mobile', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const geometry = page => page.locator('.treatment-cases').evaluate(el => [el, ...el.querySelectorAll('article, img, h3')].map(node => {
  const r = node.getBoundingClientRect();
  return { width: Math.round(r.width), height: Math.round(r.height), fit: getComputedStyle(node).objectFit, display: getComputedStyle(node).display };
}));
try {
  for (const width of (process.env.QA_WIDTHS || '320,375,390,430,800,801,1440').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('peri_consent', '1'));
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const section = page.locator('.treatment-results');
      const rail = section.locator('[data-results-rail]');
      await section.scrollIntoViewIfNeeded();
      await section.evaluate(async el => {
        el.classList.add('is-visible');
        el.querySelectorAll('.reveal').forEach(n => n.classList.add('is-visible'));
        await Promise.all([...el.querySelectorAll('img')].map(img => { img.loading = 'eager'; return img.decode(); }));
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path}: overflow at ${width}`);
      if (width <= 800) {
        const cards = rail.locator('.case-card');
        const n = await cards.count();
        const metrics = await cards.first().evaluate(el => {
          const photo = el.querySelector('.case-card__image, .case-card__pair').getBoundingClientRect();
          return { width: el.getBoundingClientRect().width, photoWidth: photo.width, photoHeight: photo.height, fit: getComputedStyle(el.querySelector('img')).objectFit };
        });
        assert.ok(Math.abs(metrics.width - Math.min(width * .7, 280, 844 * .32)) < 1);
        assert.ok(Math.abs(metrics.photoWidth - metrics.photoHeight) < 1);
        assert.equal(metrics.fit, 'contain');
        if (n > 1) {
          assert.ok(await section.locator('[data-results-navigation]').isVisible());
          await section.locator('[data-results-next]').click();
          await page.waitForFunction(() => document.querySelector('[data-results-current]').textContent === '02');
          await rail.focus();
          await page.keyboard.press('End');
          await page.waitForFunction(n => document.querySelector('[data-results-current]').textContent === String(n).padStart(2, '0'), n);
          assert.ok(await section.locator('[data-results-next]').isDisabled());
          await page.keyboard.press('Home');
          await page.waitForFunction(() => document.querySelector('[data-results-current]').textContent === '01');
          await rail.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
          await page.waitForFunction(n => document.querySelector('[data-results-current]').textContent === String(n).padStart(2, '0'), n);
          await rail.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }));
        }
        if (width === 390) {
          await rail.evaluate(el => el.blur());
          const chrome = await page.addStyleTag({ content: '.header, .mobile-cta-bar, .floating-contact { visibility: hidden !important; }' });
          await section.screenshot({ path: `docs/qa/services-results-mobile${path}-390.png`, animations: 'disabled' });
          await chrome.evaluate(el => el.remove());
        }
      } else {
        assert.equal(await section.locator('[data-results-navigation]').isVisible(), false);
        assert.equal(await rail.getAttribute('tabindex'), null);
        if (baseline) {
          const before = await browser.newPage({ viewport: { width, height: 844 } });
          await before.goto(baseline + path + '.html', { waitUntil: 'networkidle' });
          await before.locator('.treatment-results').scrollIntoViewIfNeeded();
          await before.locator('.treatment-results img').evaluateAll(imgs => Promise.all(imgs.map(img => { img.loading = 'eager'; return img.decode(); })));
          assert.deepEqual(await geometry(page), await geometry(before), `Desktop changed: ${path} at ${width}`);
          await before.close();
        }
      }
    }
    console.log(`${width}px: ${paths.length} pages passed`);
    await page.close();
  }
} finally { await browser.close(); }
