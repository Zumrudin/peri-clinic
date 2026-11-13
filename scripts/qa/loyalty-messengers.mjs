import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:4399';
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox']});
for (const width of [375,800,1440]) {
 const context = await browser.newContext({viewport:{width,height:1000}});
 const page = await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/loyaltyprogram${base.includes("127.0.0.1") ? ".html" : ""}`,{waitUntil:'networkidle'});
 const buttons=page.locator('[data-open-loyalty]'); assert.equal(await buttons.count(),2);
 for(let i=0;i<2;i++) {
  await buttons.nth(i).click();
  assert.equal(await page.locator('#loyalty-messengers').evaluate(d=>d.open),true);
  assert.equal(await page.locator('.loyalty-messenger').nth(0).getAttribute('href'),'https://t.me/PERICLINIC_bot?start=myTFbxi0');
  assert.equal(await page.locator('.loyalty-messenger').nth(1).getAttribute('href'),'https://max.ru/id695205769103_bot');
  assert.equal(await page.locator('.loyalty-messenger__qr').first().isVisible(),width>800);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const box=await page.locator('#loyalty-messengers').boundingBox(); assert.ok(box.x>=0 && box.x+box.width<=width);
  if(i===0){
   const a11y=await new AxeBuilder({page}).include('#loyalty-messengers').analyze();
   assert.deepEqual(a11y.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
   await page.screenshot({path:`docs/qa/loyalty-messengers/dialog-${width}.png`});
   await page.keyboard.press('Escape');
  } else await page.locator('[data-close-loyalty]').click();
  assert.equal(await page.locator('#loyalty-messengers').evaluate(d=>d.open),false);
  assert.equal(await buttons.nth(i).evaluate(b=>document.activeElement===b),true);
 }
 await buttons.first().click(); await page.mouse.click(2,2);
 assert.equal(await page.locator('#loyalty-messengers').evaluate(d=>d.open),false);
 assert.deepEqual(errors,[]);
 console.log(`${width}px: both triggers, links, QR visibility, layout, axe, Escape/close/backdrop and focus passed`);
 await context.close();
}
await browser.close();
