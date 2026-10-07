import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = (process.argv[2] || 'http://127.0.0.1:4322').replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of [375, 800, 801, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
    if (await reject.isVisible()) await reject.click();
    const profiles = await page.locator('.portraits .gallery-photo').evaluateAll(links => links.map(link => link.getAttribute('href')));
    assert.equal(profiles.length, 4);
    assert(profiles.every(href => href.startsWith('/specialisty/')));
    for (const href of profiles) {
      const photo = page.locator(`.portraits .gallery-photo[href="${href}"]`);
      // Bring a rotated card into view with the same carousel controls used by visitors.
      for (let n = 0; n < profiles.length && await page.locator('.portraits [data-next]').isVisible() && await page.locator('.portraits .gallery-photo').first().getAttribute('href') !== href; n++) {
        await page.locator('.portraits [data-next]').click();
        await page.waitForTimeout(150);
      }
      await photo.click();
      await page.waitForURL(base + href);
      await checkShell(page);
      await page.locator('header .logo').click();
      await page.waitForURL(base + '/');
      await checkShell(page);
    }
    await page.locator('[data-gallery="clinic-rooms"] .gallery-photo').first().click();
    assert(await page.locator('[data-lightbox]').isVisible());
    await page.keyboard.press('Escape');
    for (const href of ['/kontakty', '/uslugi-i-ceny', ...profiles]) {
      const response = await page.goto(base + href);
      assert.equal(response.status(), 200);
      await checkShell(page);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}: 4 photo links, client navigation, direct loads, single logo, relief, room lightbox`);
    await page.close();
  }
  const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await page.goto(base);
  const photo = page.locator('.portraits .gallery-photo').first();
  const href = await photo.getAttribute('href');
  await photo.click();
  await page.waitForURL(base + href);
  console.log('PASS profile link without JavaScript');
} finally { await browser.close(); }
async function checkShell(page) {
  assert.equal(await page.locator('header .logo img').count(), 1);
  assert(await page.locator('header .mobile-brand-logo').isVisible());
  assert.equal(await page.locator('.footer__logo img').count(), 1);
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    texture: getComputedStyle(document.querySelector('.page-texture')).display,
    relief: getComputedStyle(document.querySelector('.page-texture span')).backgroundImage,
    paper: getComputedStyle(document.querySelector('.page')).backgroundColor,
  }));
  assert.equal(state.overflow, false);
  assert.notEqual(state.texture, 'none');
  assert(state.relief.includes('relief.jpg'));
  assert.equal(state.paper, 'rgba(0, 0, 0, 0)');
}
