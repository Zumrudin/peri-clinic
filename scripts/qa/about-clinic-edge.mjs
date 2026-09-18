import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import { load } from 'cheerio';
const base=process.argv[2] || 'http://127.0.0.1:4332';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
  const context=await browser.newContext({viewport:{width:375,height:900},hasTouch:true,isMobile:true});
  for (const size of [1,2]) {
    const page=await context.newPage();
    await page.route(base+'/',async route=>{
      const response=await route.fetch(); const $=load(await response.text());
      $('[data-gallery="clinic-team"] [data-card]').slice(size).remove();
      await route.fulfill({response,body:$.html()});
    });
    await page.goto(base,{waitUntil:'networkidle'});
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    const team=page.locator('[data-gallery="clinic-team"]');
    assert.equal(await team.locator('.gallery-nav').isVisible(),false); // Both cards fit in the compact mobile layout.
    await team.locator('[data-photo]').first().click();
    const dialog=page.locator('[data-lightbox]');
    assert.equal(await dialog.locator('[data-lightbox-next]').isVisible(),size>1);
    if(size>1) {
      const original=await dialog.locator('[data-lightbox-image]').getAttribute('src');
      const session=await context.newCDPSession(page);
      const rect=await dialog.locator('[data-lightbox-image]').boundingBox();
      const x=rect.x+rect.width*.8,y=rect.y+rect.height*.5;
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-100,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.notEqual(await dialog.locator('[data-lightbox-image]').getAttribute('src'),original);
      await dialog.locator('[data-lightbox-next]').click();
      assert.equal(await dialog.locator('[data-lightbox-image]').getAttribute('src'),original);
    }
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('[data-lightbox]')),true);
    await page.keyboard.press('Escape'); await page.close();
    console.log(`PASS ${size} photo(s): navigation visibility, touch/wrap, focus trap`);
  }
  {
    const page=await context.newPage();
    await page.goto(base,{waitUntil:'networkidle'});
    const cookie = page.locator('[data-cookie-accept]');
    if (await cookie.isVisible()) await cookie.click();
    const session=await context.newCDPSession(page);
    let tested=0;
    for (const id of ['clinic-team','clinic-rooms']) {
      const gallery=page.locator(`[data-gallery="${id}"]`);
      if (!(await gallery.locator('.gallery-nav').isVisible())) continue; // not overflowing at this viewport, nothing to drag
      tested++;
      const rail=gallery.locator('[data-rail]');
      await gallery.locator('[data-photo]').first().scrollIntoViewIfNeeded(); // CDP touch coords are viewport-relative; this section starts below the fold
      const box=await gallery.locator('[data-photo]').first().boundingBox();
      const beforeId=await gallery.locator('[data-photo]').first().getAttribute('data-id');
      const y=box.y+box.height*.5, startX=box.x+box.width*.8;
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX-box.width*.4,y}]});
      assert.notEqual(await rail.evaluate(el=>getComputedStyle(el).transform),'none'); // live-follow mid-touch
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX-box.width*.8,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      // The release hands the finger's velocity to a spring, so the rail settles over a few
      // hundred ms instead of snapping: poll for the resting state.
      await page.waitForFunction(el=>getComputedStyle(el).transform==='none',await rail.elementHandle(),{timeout:2000});
      assert.notEqual(await gallery.locator('[data-photo]').first().getAttribute('data-id'),beforeId); // committed rotate, loops
    }
    assert.ok(tested>0,'expected at least one overflowing gallery to be drag-tested at this viewport');
    await page.close();
    console.log(`PASS real-touch live drag follows finger and loops on ${tested} overflowing rail(s)`);
  }
  const page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});
  const cookie = page.locator('[data-cookie-accept]');
  if (await cookie.isVisible()) await cookie.click();
  const section=await new AxeBuilder({page}).include('#approach').analyze();
  assert.deepEqual(section.violations.map(v=>v.id),[]);
  await page.locator('[data-photo]').first().click();
  const modal=await new AxeBuilder({page}).include('[data-lightbox]').analyze();
  assert.deepEqual(modal.violations.map(v=>v.id),[]);
  console.log('PASS axe accessibility: about section and lightbox');
} finally {await browser.close();}
