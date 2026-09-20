import { webkit } from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4322';
const browser=await webkit.launch();
try{
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const media=[];page.on('request',r=>{if(r.url().includes('/media/'))media.push(r.url())});
 await page.goto(base,{waitUntil:'load'});await page.waitForTimeout(500);
 assert.equal(media.length,0,'no videos requested at top of home page');
 if(await page.locator('[data-cookie-accept]').isVisible())await page.locator('[data-cookie-accept]').click();
 await page.locator('[data-home-reels]').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-reel-video]').currentTime>1.5).catch(async error=>{ console.log(await page.locator('[data-reel-video]').evaluateAll(vs=>vs.map(v=>({src:v.src,paused:v.paused,time:v.currentTime,ready:v.readyState,error:v.error?.message,rect:v.getBoundingClientRect().toJSON(),buffered:[...Array(v.buffered.length)].map((_,i)=>[v.buffered.start(i),v.buffered.end(i)])}))));throw error;});
 await page.waitForFunction(()=>document.querySelectorAll('[data-reel-video]')[1].buffered.length>0,{},{timeout:60000});
 // WebKit may defer offscreen decoding; test actual playback after selection.
 const firstTime=await page.locator('video[data-reel-video]').first().evaluate(v=>v.currentTime);
 await page.locator('[data-reels-dot]').nth(1).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-reel-video]')[1].currentTime>.25);
 const secondTime=await page.locator('video[data-reel-video]').nth(1).evaluate(v=>v.currentTime);
 await page.locator('[data-reels-dot]').first().click();
 await page.waitForFunction(t=>{const v=document.querySelector('[data-reel-video]');return !v.paused&&v.currentTime>=t},firstTime);
 await context.setOffline(true);
 await page.locator('[data-reels-dot]').nth(1).click();
 await page.waitForFunction(t=>{const v=document.querySelectorAll('[data-reel-video]')[1];return !v.paused&&v.currentTime>t+.1},secondTime);
 // This warning also reproduces with the Reels script disabled (existing gallery layout).
 assert.deepEqual(errors.filter(e=>e!=='ResizeObserver loop completed with undelivered notifications.'),[]);
 const result={engine:'WebKit (Linux, mobile viewport; not physical iPhone)',noVideoAboveFold:true,firstAutoplay:true,nextHlsBuffered:true,offlineReturn:true,positionsPreserved:true,existingLayoutWarnings:errors};
 writeFileSync('docs/qa/home-reels/webkit-results.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close()}
