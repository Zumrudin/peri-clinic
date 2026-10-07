import{chromium}from'playwright-core';import assert from'node:assert/strict';import fs from'node:fs/promises';
const root='artifacts/ivory-home-desktop-20261007-v6';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const results=[];
for(const width of [820,1440,1920]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 await page.goto('https://dev.zumrudin.ru/peri-concepts/ivory-home-desktop-20261007-v6/index.html',{waitUntil:'networkidle'});
 const reject=page.getByRole('button',{name:'Отказаться',exact:true});if(await reject.isVisible())await reject.click();
 for(const selector of ['#approach .portraits','#equipment']){
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.locator(`${selector} img`).evaluateAll(imgs=>Promise.all(imgs.map(i=>{i.loading='eager';return i.decode()})));
 }
 const state=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,backgrounds:[...document.querySelectorAll('#approach .portraits .gallery-card,#approach .portraits .gallery-photo,#approach .portraits picture,#approach .portraits img,#equipment .machine-card,#equipment .machine-card__photo,#equipment .machine-card__photo picture,#equipment .machine-card__photo img')].map(e=>({color:getComputedStyle(e).backgroundColor,image:getComputedStyle(e).backgroundImage})),images:[...document.querySelectorAll('#approach .portraits img,#equipment img')].every(e=>e.naturalWidth>0)}));
 assert.equal(state.scroll,width);assert(state.backgrounds.length>0);assert(state.images);assert(state.backgrounds.every(b=>b.color==='rgba(0, 0, 0, 0)'&&b.image==='none'));
 if(width===1440){for(const [selector,name] of [['#approach .portraits','staff'],['#equipment','equipment']])await page.locator(selector).screenshot({path:`${root}/${name}-qa.png`,style:'.header{visibility:hidden!important}'});}
 results.push({width,...state});await page.close();console.log('PASS',width);
}
await browser.close();await fs.writeFile(`${root}/qa.json`,JSON.stringify(results,null,2));
