/** Run against a static build: node scripts/qa/pricing-navigation.mjs http://127.0.0.1:4346 */
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:4346';
const out = process.argv[3] || 'docs/qa/pricing-navigation';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const width of [320, 375, 800, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('peri_consent', 'accepted'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/uslugi-i-ceny.html`, { waitUntil: 'networkidle' });
    const visible = page.locator('.pricing__category:visible');
    const count = await page.locator('.pricing__category').count();
    const mobile = page.locator('.pricing__mobile-categories');
    const desktop = page.locator('.pricing__navigation');
    const categoryLinks = mobile.locator('a');
    const firstId = await categoryLinks.nth(0).getAttribute('href');
    const secondId = await categoryLinks.nth(1).getAttribute('href');
    const procedureLink = desktop.locator('.pricing__nav-group').last().locator('.pricing__subnav a').last();
    const procedureId = await procedureLink.getAttribute('href');
    const lastCategoryId = await categoryLinks.last().getAttribute('href');

    if (width <= 1000) {
      assert.equal(await visible.count(), 1);
      assert.equal(await visible.getAttribute('id'), firstId.slice(1));
      const y = await page.evaluate(() => scrollY);
      await categoryLinks.nth(1).focus();
      await page.keyboard.press('Enter');
      assert.equal(await visible.getAttribute('id'), secondId.slice(1));
      assert.equal(await page.evaluate(() => scrollY), y, 'Category selection must keep the introductory screen still');
      await page.goBack();
      assert.equal(await visible.getAttribute('id'), firstId.slice(1));
      await page.goForward();
      assert.equal(await visible.getAttribute('id'), secondId.slice(1));
      await page.goto(`${base}/uslugi-i-ceny.html${procedureId}`, { waitUntil: 'networkidle' });
      assert.equal(await visible.getAttribute('id'), lastCategoryId.slice(1));
      assert(await page.locator(procedureId).evaluate((element) => element.open));
      await page.waitForTimeout(150);
      assert((await page.locator(procedureId).boundingBox()).y >= 140, 'Deep links must clear the sticky header and category navigation');
      await categoryLinks.nth(0).click();
      await page.waitForTimeout(150);
      assert.equal(await visible.getAttribute('id'), firstId.slice(1));
      assert((await page.locator(firstId).boundingBox()).y >= 140);
      await page.setViewportSize({ width: 1440, height: 1000 });
      assert.equal(await visible.count(), count);
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await visible.count(), 1);
    } else {
      assert.equal(await visible.count(), count);
      assert.equal(await mobile.isVisible(), false);
      await desktop.locator('.pricing__nav-group').last().locator('summary').click();
      await procedureLink.click();
      await page.waitForTimeout(150);
      assert(await page.locator(procedureId).evaluate((element) => element.open));
      await page.locator(`${procedureId} > summary`).click();
      await procedureLink.click();
      await page.waitForTimeout(150);
      assert(await page.locator(procedureId).evaluate((element) => element.open), 'Repeated selection must reopen a closed procedure');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    const axe = await new AxeBuilder({ page }).include('.pricing').analyze();
    assert.deepEqual(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)), []);
    await page.goto(`${base}/uslugi-i-ceny.html`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${out}/pricing-${width}.png` });
    if (width === 375) {
      await categoryLinks.nth(1).click();
      await page.screenshot({ path: `${out}/pricing-375-injection.png` });
    }
    await context.close();
    console.log(`${width}px: navigation, history, deep links, keyboard, overflow, accessibility OK`);
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${base}/uslugi-i-ceny.html`);
  assert.equal(await page.locator('.pricing__category:visible').count(), await page.locator('.pricing__category').count());
  await page.locator('.pricing__item > summary').first().click();
  assert(await page.locator('.pricing__item').first().evaluate((element) => element.open));
  await context.close();
  console.log('No JavaScript: all prices and native accordions remain available');
} finally {
  await browser.close();
}
