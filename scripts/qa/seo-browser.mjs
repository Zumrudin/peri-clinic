import {chromium} from 'playwright-core';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4322';
const pages=JSON.parse(readFileSync('docs/seo/after/audit.json','utf8')).pages;
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const errors=[],results=[];
for(const width of [390,1440]){
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}});
 const page=await context.newPage();
 for(const p of pages.filter(p=>!p.noindex)){
  await page.goto(base+p.path,{waitUntil:'load'});
  const result=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+2,hiddenText:[...document.querySelectorAll('main h1,main h2,main .prose,main .reveal')].filter(e=>getComputedStyle(e).opacity==='0'||getComputedStyle(e).visibility==='hidden').length}));
  results.push({path:p.path,width,...result});if(!result.h1||result.overflow||result.hiddenText)errors.push({path:p.path,width,...result});
 }
 await context.close();
}
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto(base,{waitUntil:'networkidle'});
await page.locator('a[href="/apparaty"]').first().click();await page.waitForURL('**/apparaty');
if(!await page.locator('a[href="/microtoki"]').count())errors.push({issue:'Missing formerly orphaned service link'});
await page.locator('a[href="/microtoki"]').first().click();await page.waitForURL('**/microtoki');
await page.getByRole('button',{name:/Записаться на консультацию/}).first().click();
if(!await page.locator('dialog[open]').count())errors.push({issue:'Booking dialog failed'});
await browser.close();
mkdirSync('docs/seo/after',{recursive:true});writeFileSync('docs/seo/after/browser.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({checks:results.length,errors},null,2));process.exitCode=errors.length?1:0;
