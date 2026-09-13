import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {load} from 'cheerio';
const base=process.argv[2] || 'http://127.0.0.1:4340';
const baseline=process.argv[3] || 'https://peri.zumrudin.ru';
const out='docs/qa/about-desktop-grid';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const hide='header,.cookie-notice,.floating-contact,.mobile-cta-bar{visibility:hidden!important}';
async function ready(page,url){await page.goto(url,{waitUntil:'networkidle'});const cookie=page.locator('[data-cookie-accept]');if(await cookie.isVisible())await cookie.click();await page.locator('#approach img').evaluateAll(async imgs=>{await Promise.all(imgs.map(async img=>{img.loading='eager';await img.decode();}));});await page.evaluate(()=>document.fonts.ready);}
const results=[];
try{
 const page=await browser.newPage({reducedMotion:'reduce'});await ready(page,base);
 await page.locator('header a[href="/#approach"]').click();
 await page.waitForFunction(()=>{const top=document.querySelector('#approach').getBoundingClientRect().top;return top>=70 && top<=90;});
 console.log('PASS header anchor offset');
 for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768],[1600,600]]){
  await page.setViewportSize({width,height});
  await page.evaluate(async()=>{const el=document.querySelector('#approach');for(let pass=0;pass<3;pass++){for(let i=0;i<6;i++)await new Promise(r=>requestAnimationFrame(r));window.scrollTo({top:el.getBoundingClientRect().top+scrollY-86,behavior:'instant'});}});
  const metrics=await page.locator('#approach').evaluate(el=>{const box=el.getBoundingClientRect(),last=el.lastElementChild.getBoundingClientRect();const reference=document.querySelector('#services').getBoundingClientRect();const style=getComputedStyle(el),referenceStyle=getComputedStyle(document.querySelector('#services'));return{left:box.left,width:box.width,referenceLeft:reference.left,referenceWidth:reference.width,padding:style.paddingLeft,referencePadding:referenceStyle.paddingLeft,top:box.top,bottom:box.bottom,height:box.height,footer:last.bottom,overflow:el.scrollHeight>el.clientHeight+1,photos:[...el.querySelectorAll('.portraits img')].map(img=>({height:img.getBoundingClientRect().height,width:img.getBoundingClientRect().width})),pageOverflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.ok(Math.abs(metrics.left-metrics.referenceLeft)<1);assert.ok(Math.abs(metrics.width-metrics.referenceWidth)<1);assert.equal(metrics.padding,metrics.referencePadding);assert.equal(metrics.overflow,false);assert.equal(metrics.pageOverflow,false);
  await page.screenshot({path:`${out}/desktop-${width}x${height}.png`,style:'.cookie-notice{visibility:hidden!important}'});
  results.push({width,height,...metrics});console.log('PASS shared desktop grid',width,height);
 }
 await page.close();
 for(const width of [375,430,800]){
  const images=[];
  for(const url of [baseline,base]){const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});await ready(p,url);images.push(await p.locator('#approach').screenshot({style:hide}));await p.close();}
  assert.ok(images[0].equals(images[1]),`Mobile screenshot changed at ${width}px`);
  console.log('PASS unchanged mobile pixels',width);
 }
 for(const javaScriptEnabled of [true,false]){
  const p=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce',javaScriptEnabled});
  await p.route(base+'/',async route=>{const response=await route.fetch();const $=load(await response.text());const rail=$('[data-gallery="clinic-team"] [data-rail]');const card=rail.find('[data-card]').first();for(let i=3;i<7;i++){const clone=card.clone();clone.find('[data-photo]').attr('data-id',`qa-extra-${i}`);rail.append(clone);}await route.fulfill({response,body:$.html()});});
  await ready(p,base);
  const team=p.locator('[data-gallery="clinic-team"]');
  if(javaScriptEnabled){const initial=await team.locator('[data-photo]').first().getAttribute('data-id');await team.locator('[data-next]').click();assert.notEqual(await team.locator('[data-photo]').first().getAttribute('data-id'),initial);}
  else {assert.ok(await team.locator('[data-rail]').evaluate(rail=>rail.firstElementChild.getBoundingClientRect().left>=rail.getBoundingClientRect().left-1));await team.locator('[data-rail]').evaluate(rail=>{rail.scrollLeft=rail.scrollWidth;});assert.ok(await team.locator('[data-rail]').evaluate(rail=>rail.lastElementChild.getBoundingClientRect().right<=rail.getBoundingClientRect().right+1));}
  await p.close();console.log('PASS seven specialists, JS:',javaScriptEnabled);
 }
 writeFileSync(`${out}/checks.json`,JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
