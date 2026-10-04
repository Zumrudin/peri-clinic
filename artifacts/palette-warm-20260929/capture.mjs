import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./', import.meta.url);
const css = readFileSync(new URL('palette.css', dir), 'utf8');
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox']});
const checks = [];
for (const [label, width, height] of [['desktop',1440,1000], ['mobile',390,844]]) {
  const page = await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
  await page.goto('https://www.peri-clinic.ru/', {waitUntil:'domcontentloaded'});
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading='eager');
    for (let y=0;y<document.documentElement.scrollHeight;y+=700) {
      window.scrollTo(0,y);
      await new Promise(r=>setTimeout(r,80));
    }
    document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible'));
    document.querySelectorAll('video').forEach(v=>v.pause());
    window.scrollTo(0,0);
    await Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,15000))]);
  });
  await page.waitForTimeout(1200);
  await page.addStyleTag({content:'*,*::before,*::after{animation-play-state:paused!important;transition:none!important}'});
  const geometry = () => [...document.querySelectorAll('h1,h2,.home-section,.hero,.service-card')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim().slice(0,90),x:r.x,y:r.y,w:r.width,h:r.height}});
  const before = await page.evaluate(geometry);
  await page.screenshot({path:new URL(`${label}-before.png`,dir).pathname,fullPage:true});
  await page.addStyleTag({content:css});
  await page.screenshot({path:new URL(`${label}-after.png`,dir).pathname,fullPage:true});
  const after = await page.evaluate(geometry);
  const colors = await page.evaluate(()=>Object.fromEntries(['header.header','.service-card','.button','.reviews'].map(s=>[s,getComputedStyle(document.querySelector(s)).backgroundColor])));
  checks.push({label,geometryUnchanged:JSON.stringify(before)===JSON.stringify(after),colors});
  await page.close();
}
await browser.close();
writeFileSync(new URL('checks.json',dir),JSON.stringify(checks,null,2));
console.log(JSON.stringify(checks,null,2));
