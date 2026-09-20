import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.argv[2] || 'https://peri.zumrudin.ru';
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:375,height:900}});
 const page=await context.newPage();
 await page.goto(base);
 const cookie=page.locator('[data-cookie-accept]');
 if(await cookie.isVisible())await cookie.click();
 const root=page.locator('[data-home-reels]');
 await root.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelectorAll('[data-reel-video]')[1].buffered.length>0).catch(async error=>{console.log(await root.locator('video').evaluateAll(vs=>vs.map(v=>({time:v.currentTime,paused:v.paused,mode:v.dataset.streamMode,ready:v.readyState,rect:v.getBoundingClientRect().toJSON(),error:v.error?.message}))));throw error;});
 assert.equal(await root.locator('video').nth(1).evaluate(v=>v.paused),true);
 // Wait for playable buffered segments, then remove the network to verify reuse.
 // Neighbours intentionally retain only the first short HLS segment(s).
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-reel-video]')].every(v=>v.buffered.length && v.buffered.end(v.buffered.length-1)-v.currentTime>=1.9),{},{timeout:60000});
 await context.setOffline(true);
 const timings=[];
 for(let n=0;n<6;n++){
  const target=(n+1)%2;
  const before=await root.locator('video').nth(target).evaluate(v=>v.currentTime);
  const start=Date.now();
  await root.locator('[data-reels-rail]').focus();
  await page.keyboard.press(target?'End':'Home');
  await page.waitForFunction(({target,before})=>{const v=document.querySelectorAll('[data-reel-video]')[target];return !v.paused&&v.currentTime>before+.1;},{target,before},{timeout:2000});
  const after=await root.locator('video').nth(target).evaluate(v=>v.currentTime);
  assert.ok(after>=before,'position must not reset');
  assert.equal(await root.locator('video').nth(1-target).evaluate(v=>v.paused),true);
  timings.push({target,before,after,resumeMs:Date.now()-start});
 }
 const result={base,neighbourBufferedBeforeSwipe:true,offlineRoundTrips:6,timings};
 writeFileSync('docs/qa/home-reels/cache-results.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
