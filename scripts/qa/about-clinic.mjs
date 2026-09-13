import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:4332';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
mkdirSync('docs/qa/about-clinic', { recursive: true });
try {
  for (const width of [1440, 1024, 800, 375]) {
    const page = await browser.newPage({ viewport: {width,height:1000}, reducedMotion:'reduce' });
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    await page.goto(base, {waitUntil:'networkidle'});
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    if (width === 375) {
      const nextResult = page.locator('[data-results-next]');
      const before = await page.locator('[data-results-current]').textContent();
      await nextResult.click();
      await page.waitForFunction(previous => document.querySelector('[data-results-current]')?.textContent !== previous, before);
    }
    await page.locator('#approach').scrollIntoViewIfNeeded();
    await page.locator('#approach img').evaluateAll(async imgs => { await Promise.all(imgs.map(async img => { img.loading = 'eager'; await img.decode(); })); });
    const team=page.locator('[data-gallery="clinic-team"]');
    const photo=team.locator('[data-photo]').first();
    const original=await photo.getAttribute('data-id');
    const photoCount=await team.locator('[data-photo]').count();
    if (await team.locator('.gallery-nav').isVisible()) {
    await team.locator('[data-next]').click();
    assert.notEqual(await team.locator('[data-photo]').first().getAttribute('data-id'),original);
    await team.locator('[data-prev]').click();
    assert.equal(await team.locator('[data-photo]').first().getAttribute('data-id'),original);
    }
    await photo.click();
    const dialog=page.locator('[data-lightbox]');
    assert.equal(await dialog.evaluate(d=>d.open),true);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await dialog.locator('[data-lightbox-count]').textContent(),`${photoCount} / ${photoCount}`);
    await page.keyboard.press('ArrowRight');
    assert.equal(await dialog.locator('[data-lightbox-count]').textContent(),`1 / ${photoCount}`);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    assert.equal(await dialog.evaluate(d=>d.open),false);
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-id')),original);
    assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
    // Drag must rotate without opening a photo, following the finger live and looping.
    const rail=team.locator('[data-rail]');
    const box=await team.locator('[data-photo]').first().boundingBox();
    const overflowing=await team.locator('.gallery-nav').isVisible();
    const beforeDragId=await team.locator('[data-photo]').first().getAttribute('data-id');
    await page.mouse.move(box.x+box.width*.7,box.y+100);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.45,box.y+100,{steps:8});
    if (overflowing) assert.notEqual(await rail.evaluate(el=>getComputedStyle(el).transform),'none'); // live-follow mid-drag
    await page.mouse.move(box.x+box.width*.2,box.y+100,{steps:8});
    await page.mouse.up();
    assert.equal(await dialog.evaluate(d=>d.open),false);
    if (overflowing) {
      assert.notEqual(await team.locator('[data-photo]').first().getAttribute('data-id'),beforeDragId); // committed rotate
      assert.equal(await rail.evaluate(el=>getComputedStyle(el).transform),'none'); // settled, no leftover transform
      // Short drag below the commit threshold must spring back without rotating.
      const beforeShortDragId=await team.locator('[data-photo]').first().getAttribute('data-id');
      await page.mouse.move(box.x+box.width*.5,box.y+100);
      await page.mouse.down();
      await page.mouse.move(box.x+box.width*.35,box.y+100,{steps:4});
      await page.mouse.up();
      await page.waitForFunction(()=>{
        const el=document.querySelector('[data-gallery="clinic-team"] [data-rail]');
        return el && getComputedStyle(el).transform==='none';
      });
      assert.equal(await team.locator('[data-photo]').first().getAttribute('data-id'),beforeShortDragId);
    }
    const rooms=page.locator('[data-gallery="clinic-rooms"]');
    const firstRoomCaption=await rooms.locator('[data-photo]').first().getAttribute('data-caption');
    const lastRoomCaption=await rooms.locator('[data-photo]').last().getAttribute('data-caption');
    await rooms.locator('[data-photo]').first().click();
    assert.equal(await dialog.locator('[data-lightbox-caption]').textContent(),firstRoomCaption);
    await dialog.locator('[data-lightbox-prev]').click();
    assert.equal(await dialog.locator('[data-lightbox-caption]').textContent(),lastRoomCaption);
    await dialog.locator('[data-close]').click();
    await page.locator('#approach').screenshot({style:'header, .cookie-notice, .floating-contact, .mobile-cta-bar { visibility:hidden !important; }', path:`docs/qa/about-clinic/about-${width}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await team.locator('.person-more').first().click();
    assert.match(page.url(),/\/specialisty\/demo-specialist-/);
    const img=page.locator('.specialist-portrait');
    const body=page.locator('.specialist-description');
    const portraitBox = await img.boundingBox(), descriptionBox = await body.boundingBox();
    if (width <= 800) assert.ok(descriptionBox.y >= portraitBox.y + portraitBox.height);
    else assert.ok(descriptionBox.x >= portraitBox.x + portraitBox.width);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
    await img.click(); assert.equal(await dialog.evaluate(d=>d.open),true);
    await dialog.locator('[data-lightbox-next]').click();
    await dialog.locator('[data-lightbox-image]').evaluate(img => img.decode());
    await dialog.screenshot({path:`docs/qa/about-clinic/lightbox-${width}.png`});
    await page.keyboard.press('Escape');
    await page.locator('.specialist-page').screenshot({path:`docs/qa/about-clinic/specialist-${width}.png`});
    assert.deepEqual(errors,[]); await page.close(); console.log(`PASS ${width}px: carousel, wrap, drag, lightbox, separate groups, profile, focus, bounds`);
  }
  const page=await browser.newPage({javaScriptEnabled:false});
  await page.goto(base);
  assert.ok(await page.locator('[data-photo]').first().getAttribute('href'));
  await page.locator('.person-more').first().click(); assert.match(page.url(),/specialisty/);
  assert.ok(!readFileSync('dist/sitemap.xml','utf8').includes('demo-specialist'));
  console.log('PASS no-JS navigation and demo sitemap exclusion');
} finally {await browser.close();}
