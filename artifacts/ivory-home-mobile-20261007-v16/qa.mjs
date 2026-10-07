import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='artifacts/ivory-home-mobile-20261007-v16';
const version='ivory-home-mobile-20261007-v16';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const results=[];
for(const [width,reduced]of [[375,false],[390,false],[430,false],[800,false],[390,true]]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
 const errors=[];
 await context.route(`https://dev.zumrudin.ru/peri-concepts/${version}/**`,async route=>{
  const rel=new URL(route.request().url()).pathname.split(`/${version}/`)[1];
  // Isolate staff gestures from pre-existing missing lazy video assets in the snapshot.
  if(rel.includes('hls.light.')||rel.includes('reel-streams.')||rel.startsWith('media/reels/'))return route.abort();
  const types={html:'text/html',css:'text/css',js:'text/javascript',woff2:'font/woff2',webp:'image/webp',jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml',mp4:'video/mp4'};
  try{await route.fulfill({body:await fs.readFile(`${root}/site/${rel}`),contentType:types[rel.split('.').pop()]||'application/octet-stream'});}catch{errors.push(rel);await route.fulfill({status:404,body:'Missing'});}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`https://dev.zumrudin.ru/peri-concepts/${version}/index.html`,{waitUntil:'networkidle'});
 const reject=page.getByRole('button',{name:'Отказаться',exact:true});if(await reject.isVisible())await reject.click();
 const rail=page.locator('.portraits [data-rail]');const track=rail.locator('[data-track]');
 await rail.scrollIntoViewIfNeeded();await page.waitForTimeout(600);
 const order=await track.locator('.gallery-photo').evaluateAll(es=>es.map(e=>e.href));
 const first=()=>track.locator('.gallery-photo').first().getAttribute('href');
 const cdp=await context.newCDPSession(page);
 async function swipe(dx,dy=0,duration=60){
  const box=await rail.boundingBox();const x=dx<0?width-35:35;const y=Math.max(140,Math.min(600,box.y+100));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6}]});await page.waitForTimeout(duration/6);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 let index=0;
 for(const direction of [1,1,1,-1,-1]){
  await swipe(-direction*(width-70));await page.waitForTimeout(850);
  index=(index+direction+order.length)%order.length;
  assert.equal(await first(),order[index],`one adjacent card width ${width}`);
  assert.equal(await track.evaluate(e=>e.style.transform),'');
 }
 // Small movements return to the current specialist, not a velocity-projected card.
 await swipe(-22,0,240);await page.waitForTimeout(850);assert.equal(await first(),order[index]);
 const beforeScroll=await page.evaluate(()=>scrollY);await swipe(0,-170,150);await page.waitForTimeout(350);
 assert(await page.evaluate(()=>scrollY)>beforeScroll+30,'vertical page scrolling preserved');
 await rail.scrollIntoViewIfNeeded();await page.waitForTimeout(400);
 const current=await first();await context.route(current,r=>r.fulfill({body:'<title>Specialist</title>',contentType:'text/html'}));
 await track.locator('.gallery-photo').first().tap();await page.waitForURL(current);
 assert.deepEqual(errors,[]);results.push({width,reduced,swipes:5,smallSwipeReturns:true,verticalScroll:true,profileTap:true});await context.close();console.log('PASS',width,reduced);
}
await browser.close();await fs.writeFile(`${root}/qa.json`,JSON.stringify(results,null,2));
