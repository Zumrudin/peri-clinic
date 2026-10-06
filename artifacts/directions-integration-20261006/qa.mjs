import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='artifacts/directions-integration-20261006';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const results=[];
for(const version of ['ivory-home-mobile-20261006-v15','ivory-home-20261006-v5']){
for(const width of (version.includes('mobile')?[320,375,390,430,600,800,1440]:[390,820,1024,1440,1920])){
 const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});
 const errors=[];
 await context.route(`https://dev.zumrudin.ru/peri-concepts/${version}/**`,async route=>{
  const rel=new URL(route.request().url()).pathname.split(`/${version}/`)[1];
  const types={html:'text/html',css:'text/css',js:'text/javascript',woff2:'font/woff2',svg:'image/svg+xml',webp:'image/webp',png:'image/png',jpg:'image/jpeg',mp4:'video/mp4'};
  try{await route.fulfill({body:await fs.readFile(`artifacts/${version}/site/${rel}`),contentType:types[rel.split('.').pop()]||'application/octet-stream'});}catch{errors.push(rel);await route.fulfill({status:404,body:'Missing'});}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`https://dev.zumrudin.ru/peri-concepts/${version}/index.html`,{waitUntil:'networkidle'});
 const reject=page.getByRole('button',{name:'Отказаться',exact:true});if(await reject.isVisible())await reject.click();
 await page.locator('#services').scrollIntoViewIfNeeded();
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#services img')].map(i=>i.decode()));});
 const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,images:[...document.querySelectorAll('#services img')].map(e=>({src:e.currentSrc,width:e.naturalWidth,height:e.naturalHeight,displayWidth:e.clientWidth})),cards:[...document.querySelectorAll('.direction-card')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,href:e.href}}),textOverflow:[...document.querySelectorAll('#services h2,#services h3,#services p')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),specialistLinks:[...document.querySelectorAll('.portraits .gallery-photo')].map(e=>({href:e.getAttribute('href'),lightbox:e.hasAttribute('data-photo')}))}));
 assert.equal(metrics.scrollWidth,width,`${version} overflow ${width}`);assert.equal(metrics.images.length,3);assert.deepEqual(metrics.textOverflow,[]);
 assert(metrics.images.every(i=>i.width>=1122));assert(metrics.cards.every(c=>c.href.startsWith('https://www.peri-clinic.ru/')));
 if(width<=800){assert.equal(metrics.cards[1].y,metrics.cards[2].y);assert(metrics.cards[0].y<metrics.cards[1].y);}else assert(metrics.cards.every(c=>c.y===metrics.cards[0].y));
 if(version.includes('mobile'))assert(metrics.specialistLinks.every(x=>x.href&&!x.lightbox));
 if((version.includes('mobile')&&width===390)||(!version.includes('mobile')&&width===1440)){
  await page.locator('#services').screenshot({path:`${root}/${version.includes('mobile')?'mobile':'desktop'}-directions.png`,style:'.header,.mobile-cta-bar{visibility:hidden!important}'});
  const axe=await new AxeBuilder({page}).include('#services').analyze();assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
 }
 const booking=page.locator(width<=800?'.mobile-cta-bar [data-open-sheet]':'.hero [data-open-sheet]').first();
 if(await booking.isVisible()){await booking.click();await page.waitForSelector('#contact-sheet[open]');await page.keyboard.press('Escape');}
 assert.deepEqual(errors,[]);results.push({version,width,...metrics});console.log('PASS',version,width);
 await context.close();
}}
await browser.close();await fs.writeFile(`${root}/qa.json`,JSON.stringify(results,null,2));
