import{chromium}from'playwright-core';import AxeBuilder from'@axe-core/playwright';import fs from'node:fs/promises';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const errors=[];const results=[];
for(const width of[390,320,375,430,600,800,1440]){
const context=await b.newContext({viewport:{width,height:844},isMobile:width<=800,hasTouch:width<=800,reducedMotion:'reduce'});await context.route('https://dev.zumrudin.ru/peri-concepts/ivory-home-mobile-20261006-v14/**',async route=>{const rel=new URL(route.request().url()).pathname.split('/ivory-home-mobile-20261006-v14/')[1];const file='artifacts/ivory-home-mobile-20261006-v14/site/'+rel;const ext=rel.split('.').pop();const types={html:'text/html',css:'text/css',js:'text/javascript',woff2:'font/woff2',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',avif:'image/avif',mp4:'video/mp4'};try{await route.fulfill({body:await fs.readFile(file),contentType:types[ext]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Missing local asset'});}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
await p.goto('https://dev.zumrudin.ru/peri-concepts/ivory-home-mobile-20261006-v14/index.html',{waitUntil:'networkidle'});
const reject=p.getByRole('button',{name:'Отказаться',exact:true});if(await reject.isVisible())await reject.click();
await p.evaluate(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
const layout=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,headerHeight:document.querySelector('header').offsetHeight,buttonHeight:document.querySelector('.header-book').offsetHeight,textureHeight:document.querySelector('.page-texture').offsetHeight,pageHeight:document.body.offsetHeight,removedStripCount:document.querySelectorAll('.hero-location,.ticker,#services .services__hint').length,heroFactsBelowPhoto:(()=>{const f=document.querySelector('.hero__facts').getBoundingClientRect(),m=document.querySelector('.hero__media').getBoundingClientRect();return Math.abs(f.top-m.bottom)<1 && f.bottom>m.bottom;})(),heroButtonHidden:getComputedStyle(document.querySelector('.hero__actions .button')).display==='none',heroActionsHidden:getComputedStyle(document.querySelector('.hero__actions')).display==='none',heroLeadHidden:getComputedStyle(document.querySelector('.hero__lead')).display==='none',textureCoversPage:document.querySelector('.page-texture span:last-child').getBoundingClientRect().bottom >= document.body.getBoundingClientRect().bottom,cutoutBackgrounds:[...document.querySelectorAll('#approach .portraits .gallery-card,#approach .portraits .gallery-photo,#equipment .machine-card,#equipment .machine-card__photo')].map(e=>getComputedStyle(e).backgroundColor),staffAlignment:[...document.querySelectorAll('.portraits .person-caption')].map(e=>getComputedStyle(e).textAlign),staffLinks:[...document.querySelectorAll('.portraits .gallery-card')].map(e=>({correct:e.querySelector('.gallery-photo').href===e.querySelector('.person-more').href,plus:!!e.querySelector('.photo-expand'),lightbox:e.querySelector('.gallery-photo').hasAttribute('data-photo'),gap:e.querySelector('.person-more').getBoundingClientRect().top-e.querySelector('.person-caption p').getBoundingClientRect().bottom})),deviceAlignment:[...document.querySelectorAll('.machine-card__body')].map(e=>getComputedStyle(e).textAlign),sectionSpacing:[...document.querySelectorAll('#home-page>.home-section')].map(e=>({id:e.id,top:getComputedStyle(e).paddingTop,bottom:getComputedStyle(e).paddingBottom})),sectionBackgrounds:[...document.querySelectorAll('#home-page>section')].map(e=>getComputedStyle(e).backgroundColor),venetianLoaded:document.fonts.check('23px \"Venetian 301\"'),broken:[...document.images].filter(i=>i.getAttribute('src')&&!i.naturalWidth).map(i=>i.src)}));
await p.locator(width<=800 ? '.mobile-cta-bar [data-open-sheet]' : '.hero [data-open-sheet]').click();await p.waitForSelector('#contact-sheet[open]');const booking=await p.locator('#contact-sheet').innerText();await p.keyboard.press('Escape');
if(width<=800){
const root=p.locator('[data-home-reels]').first();
await root.scrollIntoViewIfNeeded();
await root.locator('[data-reels-scroll-next]').click();
await p.waitForFunction(()=>document.querySelector('[data-reels-scroll-current]').textContent==='02');
await root.locator('[data-reels-scroll-prev]').click();
await p.waitForFunction(()=>document.querySelector('[data-reels-scroll-current]').textContent==='01');
await root.locator('[data-reels-rail]').evaluate(e=>e.scrollTo({left:e.scrollWidth,behavior:'instant'}));
await p.waitForFunction(()=>document.querySelector('[data-reels-scroll-current]').textContent===document.querySelector('[data-reels-scroll-total]').textContent);
const complete=await root.locator('[data-reels-scroll-progress]').evaluate(e=>e.style.transform==='scaleX(1)');
if(!complete || !await root.locator('[data-reels-scroll-next]').isDisabled()) throw new Error('Reels end progress failed');
await root.locator('[data-reels-rail]').focus();await p.keyboard.press('Home');
await p.waitForFunction(()=>document.querySelector('[data-reels-scroll-current]').textContent==='01');
if(width===390)await root.screenshot({path:'artifacts/ivory-home-mobile-20261006-v14/reels-navigation.png'});
}
if(width===390){await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=650){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));}window.scrollTo(0,0);});await p.waitForTimeout(500);await p.locator('.hero h1').click();await p.screenshot({path:'artifacts/ivory-home-mobile-20261006-v14/mobile-top.png'});await p.screenshot({path:'artifacts/ivory-home-mobile-20261006-v14/mobile-full.png',fullPage:true});await p.locator('.portraits').screenshot({path:'artifacts/ivory-home-mobile-20261006-v14/specialists-transparent.png',style:'.header,.mobile-cta-bar{visibility:hidden!important}'});await p.locator('#equipment').screenshot({path:'artifacts/ivory-home-mobile-20261006-v14/mobile-equipment.png',style:'.header,.mobile-cta-bar{visibility:hidden!important}'});await p.locator('.gallery-photo').first().click();await p.waitForTimeout(300);console.log('Lightbox',await p.locator('[role=dialog],dialog').evaluateAll(es=>es.map(e=>({id:e.id,open:e.open,visible:e.getBoundingClientRect().height>0}))));await p.keyboard.press('Escape');const axe=await new AxeBuilder({page:p}).analyze();results.push({axe:axe.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});}
if(width <= 800){await p.locator('[data-menu-toggle]').click();await p.waitForSelector('.nav.is-open');await p.screenshot({path:`artifacts/ivory-home-mobile-20261006-v14/menu-${width}.png`});await p.locator('.nav a[href="#services"]').click();await p.waitForSelector('.nav.is-open',{state:'hidden'});}
if(width===390){
const photo=p.locator('.portraits .gallery-photo').first();const target=await photo.getAttribute('href');
await context.route(target,route=>route.fulfill({contentType:'text/html',body:'<title>Specialist destination</title>'}));
await photo.click();await p.waitForURL(target);
}
results.push({width,layout,bookingWorks:booking.includes('Позвонить')});await context.close();}
await fs.writeFile('artifacts/ivory-home-mobile-20261006-v14/qa.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results},null,2));await b.close();

if(errors.length || results.some(r=>r.axe?.length || (r.layout && (r.layout.scroll !== r.width || r.layout.broken.length || !r.bookingWorks)))) throw new Error('Mobile QA failed; see qa.json');

if(results.some(r=>r.width<=800 && (!r.layout.heroFactsBelowPhoto || !r.layout.heroButtonHidden || !r.layout.heroLeadHidden || !r.layout.heroActionsHidden || !r.layout.textureCoversPage))) throw new Error('Requested mobile layout failed');

if(results.some(r=>r.layout?.removedStripCount)) throw new Error('Address/ticker strips still present');

if(results.some(r=>r.width<=800 && r.layout.sectionSpacing.some(s=>s.bottom!=='24px' || s.top!==(s.id==='services'?'48px':'24px')))) throw new Error('Inconsistent section spacing');

if(results.some(r=>r.width<=800 && r.layout.cutoutBackgrounds.some(c=>c!=='rgba(0, 0, 0, 0)'))) throw new Error('Photo wrapper is not transparent');

if(results.some(r=>r.width<=800 && r.layout.staffAlignment.some(a=>a!=='center'))) throw new Error('Staff text alignment failed');

if(results.some(r=>r.layout?.staffLinks.some(s=>!s.correct || s.plus || s.lightbox) || (r.width<=800 && (r.layout.staffLinks.some(s=>s.gap>8) || r.layout.deviceAlignment.some(a=>a!=='center'))))) throw new Error('Card changes failed');
