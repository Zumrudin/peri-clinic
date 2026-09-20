import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,deviceScaleFactor:3});
 const high=[];page.on('request',r=>{if(r.url().includes('/high/segment-')) high.push(r.url());});
 await page.goto(process.argv[2]||'https://peri.zumrudin.ru');
 if(await page.locator('[data-cookie-accept]').isVisible())await page.locator('[data-cookie-accept]').click();
 await page.locator('[data-home-reels]').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-reel-video]').currentTime>12,{},{timeout:45000});
 const state=await page.locator('[data-reel-video]').first().evaluate(v=>({time:v.currentTime,mode:v.dataset.streamMode,width:v.videoWidth,height:v.videoHeight,error:v.error?.message}));
 assert.equal(state.mode,'hls');assert.equal(state.error,undefined);assert.ok(high.length>0,'adaptive high rendition fetched on a high density display');assert.equal(state.width,540);
 console.log({continuousAcrossSixSegments:state,highSegments:high.length});
}finally{await browser.close()}
