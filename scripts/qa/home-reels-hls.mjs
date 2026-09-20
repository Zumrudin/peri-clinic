import { chromium, webkit } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4322';
const results = [];
const output = process.argv[3] || 'docs/qa/home-reels/hls-results.json';
for (const engine of (process.env.REELS_ENGINE ? [process.env.REELS_ENGINE] : ['chromium', 'webkit'])) {
 const browser = await (engine === 'webkit' ? webkit.launch() : chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}));
 try {
 const page = await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 const requests=[], errors=[];
 page.on('request', r=>{if(r.url().includes('/media/')) requests.push({url:r.url(),at:Date.now()});});
 page.on('pageerror', e=>{if(!e.message.includes('ResizeObserver loop')) errors.push(e.message);});
 if(engine==='chromium') {
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:100000});
 }
 await page.goto(base,{waitUntil:'load'}); await page.waitForTimeout(300);
 assert.equal(requests.length,0,'no above-fold video requests');
 const top=await page.evaluate(()=>({loadMs:Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd),resourceBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.transferSize,0),streamingLibraryLoaded:performance.getEntriesByType('resource').some(r=>/\/hls\.[^/]+\.js/.test(r.name))}));
 assert.equal(top.streamingLibraryLoaded,false);
 const cookie=page.locator('[data-cookie-accept]');if(await cookie.isVisible()) await cookie.click();
 const start=Date.now();await page.locator('[data-home-reels]').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-reel-video]').currentTime>.1,{}, {timeout:60000});
 const firstStart=Date.now()-start;
 if(engine==='chromium') writeFileSync('/tmp/reels-start-resources.json',JSON.stringify(await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,start:r.startTime,duration:r.duration,bytes:r.transferSize,encoded:r.encodedBodySize}))),null,2));
 await page.waitForFunction(()=>{const v=document.querySelectorAll('[data-reel-video]')[1];return v.buffered.length && v.buffered.end(0)>=1.9;}, {}, {timeout:30000});
 const startupUrls=requests.filter(r=>r.url.endsWith('/master.m3u8')||r.url.endsWith('/low/segment-0000.m4s')).map(r=>r.url);
 assert.equal(new Set(startupUrls).size,startupUrls.length,'startup requests shared between prefetch and player');
 const initial=await page.locator('[data-reel-video]').evaluateAll(vs=>vs.map(v=>({mode:v.dataset.streamMode,buffer:v.buffered.length?v.buffered.end(0):0,paused:v.paused})));
 const switches=[];
 for(const index of [1,0,1,0,1,0]) {
  console.log('Switch',engine,index);
  const sample=await page.evaluate(async index=>{
   const rail=document.querySelector('[data-reels-rail]'),cards=[...document.querySelectorAll('[data-reel]')],v=cards[index].querySelector('video');
   const before=v.currentTime, start=performance.now();
   return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('No decoded frame after switching')),6000);
    const onFrame=()=>{if(v.currentTime<=before+.015){v.requestVideoFrameCallback(onFrame);return;}clearTimeout(timer);resolve({index,ms:Math.round(performance.now()-start),before,after:v.currentTime});};
    v.requestVideoFrameCallback(onFrame);
    rail.scrollTo({left:rail.scrollLeft+cards[index].getBoundingClientRect().left-rail.getBoundingClientRect().left,behavior:'instant'});
   });
  },index).catch(async error=>{console.log(await page.locator('[data-reel-video]').evaluateAll(vs=>vs.map(v=>({time:v.currentTime,paused:v.paused,ready:v.readyState,error:v.error?.message,buffer:[...Array(v.buffered.length)].map((_,i)=>[v.buffered.start(i),v.buffered.end(i)])}))));throw error;});
  assert.ok(sample.after>=sample.before-.15,'position preserved');switches.push(sample);
  assert.equal(await page.locator('[data-reel-video]').evaluateAll(vs=>vs.filter(v=>!v.paused).length),1);
  await page.waitForTimeout(200);
 }
 assert.ok(!requests.some(r=>r.url.includes('mobile-v1.mp4')),'no whole MP4 download');
 assert.deepEqual(errors,[]);
 results.push({engine,network:engine==='chromium'?'1.6 Mbps / 100ms, cold HTTP cache':'unthrottled',top,firstStart,initial,switches,requests:requests.length});
 console.log(JSON.stringify(results.at(-1),null,2));
 } finally {await browser.close();}
}
writeFileSync(output,JSON.stringify(results,null,2));
