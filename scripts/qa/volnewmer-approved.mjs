import {chromium} from 'playwright-core';
import {load} from 'cheerio';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:8767';
const publicRun=base.startsWith('https:');
const ref=load(await readFile('artifacts/volnewmer-review-20261012-v19/site/index.html','utf8'));
const expected=ref('main');const norm=s=>s.replace(/\s+/g,'').trim();
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const report=[];
try{
 for(const width of [375,800,1440]){
  const page=await browser.newPage({viewport:{width,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const res=await page.goto(base+'/volnewmer'+(publicRun?'':'.html'),{waitUntil:'networkidle'});
  const decline=page.getByRole('button',{name:'Отказаться',exact:true});if(await decline.isVisible())await decline.click();
  for(const selector of ['.treatment-hero','.treatment-nav','#prices','#doctors','#about','#results','#expectations','#contraindications','#visit','#recovery','#comparison','.faq','#booking']){
   const actual=norm(await page.locator('.approved-treatment '+selector).innerText());
   // Closed details hide answers; compare DOM text for FAQ.
   const value=norm(await page.locator('.approved-treatment '+selector).evaluate(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('script').forEach(s=>s.remove());return copy.textContent;}));
   const wanted=norm(expected.find(selector).text());
   if(value!==wanted)throw Error('Content mismatch '+selector+'\n'+value+'\n'+wanted);
  }
  if(await page.locator('#videos video').count()!==6)throw Error('Expected six videos');
  for(const img of await page.locator('.approved-treatment img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
  for(const section of ['.treatment-hero','#results','#visit','#doctors']){await page.locator(section).scrollIntoViewIfNeeded();await page.locator(section).screenshot({path:`docs/qa/volnewmer-approved/${publicRun?'public':'local'}-${section.replace(/[.#]/g,'')}-${width}.png`});}
  await page.locator('.treatment-hero [data-open-sheet]').click();
  if(!await page.locator('#contact-sheet').evaluate(d=>d.open))throw Error('Booking did not open');
  await page.keyboard.press('Escape');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow||errors.length||res.status()!==200)throw Error(JSON.stringify({overflow,errors,status:res.status()}));
  report.push({width,status:res.status(),contentMatches:true,imagesLoaded:true,booking:true,videos:6,overflow,errors});await page.close();
 }
 console.log(JSON.stringify(report,null,2));await writeFile(`docs/qa/volnewmer-approved/${publicRun?'public':'local'}-report.json`,JSON.stringify(report,null,2));
}finally{await browser.close();}
