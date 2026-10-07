import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const base=process.argv[2] || 'http://127.0.0.1:4322';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
for(const width of [375,390,430,800,1440]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<=800,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 const reject=page.getByRole('button',{name:'Отказаться',exact:true});if(await reject.isVisible())await reject.click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 if(width<=800){
  assert.equal(await page.locator('.logo .mobile-brand-logo').isVisible(),true);
  assert((await page.locator('.hero__photo img').evaluate(e=>e.currentSrc)).includes('hero-final-badge'));
  await page.locator('[data-menu-toggle]').click();assert(await page.locator('#main-nav').isVisible());await page.locator('[data-menu-toggle]').click();
  const rail=page.locator('.portraits [data-rail]');const track=rail.locator('[data-track]');await rail.scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  const order=await track.locator('.person-more').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
  const cdp=await context.newCDPSession(page);
  for(const [n,direction] of [1,1,-1].entries()){
   const box=await rail.boundingBox();const x=direction>0?width-35:35;const y=Math.max(140,Math.min(600,box.y+100));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-direction*(width-70)*i/6,y}]});await page.waitForTimeout(10);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(850);
   assert.equal(await track.locator('.person-more').first().getAttribute('href'),order[[1,2,1][n]],`single card swipe ${width}`);
  }
  const reels=page.locator('[data-home-reels]');await reels.scrollIntoViewIfNeeded();await page.waitForTimeout(1800);
  assert(await page.locator('[data-reels-scroll-navigation]').isVisible());
  assert.equal(await page.locator('[data-reels-scroll-total]').textContent(),String(await page.locator('[data-reel]').count()).padStart(2,'0'));
  await page.locator('[data-reels-scroll-next]').click();await page.waitForTimeout(900);assert.equal(await page.locator('[data-reels-scroll-current]').textContent(),'02');
  assert.equal(await page.locator('.reel-error:visible').count(),0);
  const booking=page.locator('.mobile-cta-bar [data-open-sheet]');await booking.click();assert(await page.locator('dialog[open]').isVisible());await page.keyboard.press('Escape');
  if(width===390){const a11y=await new AxeBuilder({page}).analyze();const bad=a11y.violations.filter(v=>['serious','critical'].includes(v.impact));assert.deepEqual(bad.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);await page.screenshot({path:'/tmp/peri-mobile-brand.png',fullPage:true});}
  const profile=await track.locator('.person-more').first().getAttribute('href');await rail.scrollIntoViewIfNeeded();await track.locator('.gallery-photo').first().tap();await page.waitForURL(base.replace(/\/$/,'')+profile);assert(await page.locator('h1').isVisible());
  await page.locator('.logo').click();await page.waitForURL(base.replace(/\/$/,'')+'/');assert(await page.locator('.logo .mobile-brand-logo').isVisible());assert(await page.locator('.hero__photo img').isVisible());
 } else {assert(await page.locator('.logo .legacy-logo').isVisible());assert.equal(await page.locator('.logo .mobile-brand-logo').isVisible(),false);}
 assert.deepEqual(errors,[]);console.log('PASS',width);await context.close();
}
} finally {await browser.close();}
