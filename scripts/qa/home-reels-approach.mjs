import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:100000});
 await page.goto(process.argv[2]||'https://peri.zumrudin.ru');
 if(await page.locator('[data-cookie-accept]').isVisible())await page.locator('[data-cookie-accept]').click();
 await page.locator('[data-home-reels]').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-innerHeight-700));
 const prep=Date.now();
 await page.waitForFunction(()=>{const v=document.querySelector('[data-reel-video]');return v.buffered.length&&v.buffered.end(0)>=1.9;},{},{timeout:30000});
 const preparationMs=Date.now()-prep;
 assert.equal(await page.locator('[data-reel-video]').first().evaluate(v=>v.paused),true);
 assert.equal(await page.locator('[data-reel-video]').first().evaluate(v=>v.currentTime),0);
 const start=Date.now();await page.locator('[data-home-reels]').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-reel-video]').currentTime>.1);
 console.log({network:'1.6 Mbps / 100ms',preparationBeforeVisibilityMs:preparationMs,preparedFirstStartMs:Date.now()-start});
}finally{await browser.close()}
