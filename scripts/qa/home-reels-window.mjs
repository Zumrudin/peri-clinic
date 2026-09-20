import { chromium } from 'playwright-core';
import { load } from 'cheerio';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:4322';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true});
 await page.route(base+'/',async route=>{
  const response=await route.fetch();const $=load(await response.text());
  const cards=$('[data-reel]').toArray();const rail=$('[data-reels-rail]');
  // Synthetic long feed exercises eviction with six cards and the two actual CMS sources.
  for(let i=2;i<6;i++){const card=$(cards[i%2]).clone();card.attr('id',`qa-reel-${i}`);rail.append(card);}
  await route.fulfill({response,body:$.html()});
 });
 await page.goto(base+'/');
 if(await page.locator('[data-cookie-accept]').isVisible())await page.locator('[data-cookie-accept]').click();
 await page.locator('[data-home-reels]').scrollIntoViewIfNeeded();
 const positions=new Map();
 for(const index of [0,1,2,3,4,5,4,3,2,1,0]) {
  await page.evaluate(index=>{const r=document.querySelector('[data-reels-rail]'),c=document.querySelectorAll('[data-reel]')[index];r.scrollTo({left:r.scrollLeft+c.getBoundingClientRect().left-r.getBoundingClientRect().left,behavior:'instant'});},index);
  await page.waitForFunction(({index,previous})=>{const v=document.querySelectorAll('[data-reel-video]')[index];return !v.paused&&v.currentTime>previous+.1;},{index,previous:positions.get(index)||0});
  const state=await page.locator('[data-reel-video]').evaluateAll(vs=>vs.map(v=>({time:v.currentTime,attached:!!v.dataset.streamMode,playing:!v.paused})));
  assert.ok(state.filter(s=>s.attached).length<=4,'only previous, active and next two retained');
  assert.equal(state.filter(s=>s.playing).length,1);
  positions.set(index,state[index].time);
 }
 console.log('Six-card window: bounded players, eviction, restored positions PASS');
} finally {await browser.close();}
