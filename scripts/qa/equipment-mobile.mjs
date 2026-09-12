/** Functional and visual QA for the equipment grid; run after build and preview. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const base = process.argv[2] || 'http://127.0.0.1:4332';
const out = process.argv[3] || 'docs/qa/equipment-mobile';
await mkdir(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const results = [];
try {
  for (const width of [320,375,390,430,800,801,1024,1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('peri_consent','1'));
    await page.goto(base, { waitUntil: 'networkidle' });
    const equipment = page.locator('.equipment');
    await equipment.scrollIntoViewIfNeeded();
    await equipment.evaluate(async el => {
      el.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible'));
      el.querySelectorAll('img').forEach(img => img.loading = 'eager');
      await Promise.all([...el.querySelectorAll('img')].map(img => img.decode()));
    });
    const total = await equipment.locator('.machine-card').count();
    const visible = await equipment.locator('.machine-card:visible').count();
    assert.equal(visible, width <= 800 ? Math.min(4,total) : total);
    const overflow = await equipment.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    assert.equal(overflow, false, `equipment overflows at ${width}`);
    assert.equal(await equipment.locator('.equipment__all').isVisible(), width <= 800);
    if (width <= 800) {
      assert.equal(await equipment.locator('[data-rail]').getAttribute('tabindex'), null);
      assert.equal(await equipment.locator('.slider-controls').isVisible(), false);
      const bounds = await equipment.locator('.machine-card:visible').evaluateAll(cards => cards.map(c => { const r=c.getBoundingClientRect();return {x:r.x,y:r.y}; }));
      if(bounds.length >= 2) {assert.equal(bounds[0].y,bounds[1].y);assert.ok(bounds[1].x>bounds[0].x);}
      await equipment.locator('[data-open-sheet]').click();
      assert.equal(await page.locator('#contact-sheet').evaluate(el => el.open),true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#contact-sheet').evaluate(el => el.open),false);
      assert.equal(await equipment.locator('[data-open-sheet]').evaluate(el => el === document.activeElement),true);
      const axe = await new AxeBuilder({page}).include('.equipment').analyze();
      assert.deepEqual(axe.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => v.id),[]);
      await page.setViewportSize({width:1024,height:900});
      assert.equal(await equipment.locator('[data-rail]').getAttribute('tabindex'),'0');
      await page.setViewportSize({width,height:900});
      await equipment.locator('.equipment__all').click();
      await page.waitForURL('**/apparaty');
      assert.ok(await page.locator('.catalog__card').count() >= total);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      await page.goBack({ waitUntil:'networkidle' });
      await equipment.scrollIntoViewIfNeeded();
      await equipment.evaluate(el => el.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible')));
    }
    // Isolated section capture avoids the unrelated sticky header covering its title.
    await page.addStyleTag({content: '.header, .mobile-cta-bar, .floating-contact { visibility: hidden !important; }'});
    await equipment.screenshot({path:`${out}/equipment-${width}.png`,animations:'disabled'});
    results.push({width,total,visible,overflow});
    await context.close();
  }
  const nojs = await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:900}});
  await nojs.goto(base);
  assert.equal(await nojs.locator('.equipment__all').getAttribute('href'),'/apparaty');
  await nojs.goto(base+'/apparaty');
  const entries = await nojs.locator('.catalog__card').count();
  assert.ok(entries > 4);
  for (const href of await nojs.locator('.catalog__card[href]').evaluateAll(els => els.map(el => el.getAttribute('href')))) {
    assert.equal((await nojs.request.get(base+href)).status(),200);
  }
  await nojs.close();
  const catalog = await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});
  await catalog.addInitScript(() => localStorage.setItem('peri_consent','1'));
  await catalog.goto(base+'/apparaty',{waitUntil:'networkidle'});
  await catalog.locator('.catalog img').evaluateAll(async imgs => {for(const img of imgs)img.loading='eager';await Promise.all(imgs.map(img=>img.decode()));});
  await catalog.addStyleTag({content: '.mobile-cta-bar, header, .floating-contact { visibility: hidden !important; }'});
  await catalog.locator('.catalog').screenshot({path:`${out}/catalog-390.png`});
  await catalog.close();
  await writeFile(`${out}/checks.json`,JSON.stringify({results,catalogEntries:entries},null,2));
  console.log('Equipment QA passed',JSON.stringify({results,catalogEntries:entries}));
} finally {
  await browser.close();
}
