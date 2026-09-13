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
    const team=page.locator('[data-gallery="clinic-team"]');
    assert.equal(await team.locator('.gallery-nav').isVisible(),size>1);
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
  const page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});
  const section=await new AxeBuilder({page}).include('#approach').analyze();
  assert.deepEqual(section.violations.map(v=>v.id),[]);
  await page.locator('[data-photo]').first().click();
  const modal=await new AxeBuilder({page}).include('[data-lightbox]').analyze();
  assert.deepEqual(modal.violations.map(v=>v.id),[]);
  console.log('PASS axe accessibility: about section and lightbox');
} finally {await browser.close();}
