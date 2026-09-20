import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:4322';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:393,height:852}});
 await page.route('**/*.m3u8',r=>r.abort());
 await page.goto(base);
 if(await page.locator('[data-cookie-accept]').isVisible())await page.locator('[data-cookie-accept]').click();
 await page.locator('[data-home-reels]').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const v=document.querySelector('[data-reel-video]');return v.dataset.streamMode==='mp4'&&v.currentTime>.1;},{},{timeout:45000});
 assert.equal(await page.locator('[data-reel-error]').first().isVisible(),false);
 console.log('Failed HLS falls back to playable MP4 PASS');
}finally{await browser.close()}
