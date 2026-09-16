import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const url = process.argv[2] || 'http://127.0.0.1:4322';
const out = 'docs/qa/home-design-system';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const measurements = [];
try {
for (const width of [320,375,390,430,768,800,801,1024,1440,1920]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (width === 375) await page.screenshot({path:`${out}/first-visit-375.png`});
  await page.locator('[data-cookie-accept]').click();
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(e => e.loading = 'eager');
    await Promise.all([...document.images].map(e => e.decode().catch(() => {})));
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible'));
  });
  const geometry = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('.home-section')];
    return {
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      h1: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
      sections: sections.map(e => ({ name: e.className, edge: parseFloat(getComputedStyle(e).paddingLeft), h2: parseFloat(getComputedStyle(e.querySelector('h2')).fontSize), padding: getComputedStyle(e).paddingTop })),
      brokenImages: [...document.images].filter(e => (e.currentSrc || e.getAttribute('src')) && !e.naturalWidth).length,
      reviewFits: document.querySelector('.review-list').getBoundingClientRect().right <= innerWidth + 1,
      // Check ordinary words with ranges: overflow-wrap can mask a broken layout by slicing words.
      splitWords: [...document.querySelectorAll('.service-card h3')].flatMap(e => {
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); const broken=[];
        while(walker.nextNode()) { const n=walker.currentNode; for(const m of n.textContent.matchAll(/[А-Яа-яЁё]+/g)) {const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length); if(r.getClientRects().length>1) broken.push(m[0]);} }
        return broken;
      }),
    };
  });
  assert.equal(geometry.scrollWidth,width,`page overflow ${width}`);
  assert.equal(geometry.brokenImages,0,`broken images ${width}`);
  assert.equal(new Set(geometry.sections.map(s=>s.edge)).size,1,`section alignment ${width}`);
  assert.equal(new Set(geometry.sections.map(s=>s.h2)).size,1,`heading scale ${width}`);
  assert.equal(geometry.reviewFits,true,`reviews overflow ${width}`);
  assert.deepEqual(geometry.splitWords,[],`broken words ${width}`);
  assert.deepEqual(errors,[],`browser errors ${width}`);
  measurements.push(geometry);
  if ([375,800,1440,1920].includes(width)) await page.screenshot({path:`${out}/index-${width}.png`,fullPage:true,animations:'disabled'});
  // Results can reach the last item, rather than just appearing scrollable.
  const results = page.locator('#results');
  await results.scrollIntoViewIfNeeded();
  await results.locator('[data-results-rail]').focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(100);
  assert.equal(await results.locator('[data-results-current]').textContent(),'03');
  assert.equal(await results.locator('[data-results-next]').isDisabled(),true);
  if (width <= 800) {
    const reviews = page.locator('#reviews');
    await reviews.locator('[data-rail-next]').click();
    await page.waitForTimeout(100);
    assert.ok(await reviews.locator('[data-rail]').evaluate(e=>e.scrollLeft>0));
  }
  await page.close();
  console.log(`OK ${width}`);
}
assert.ok(Math.abs(measurements.find(x=>x.width===800).h1-measurements.find(x=>x.width===801).h1)<1,'H1 discontinuity');
writeFileSync(`${out}/measurements.json`,JSON.stringify(measurements,null,2));
} finally { await browser.close(); }
