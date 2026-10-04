// One-glance review sheet for the phone: the final PNGs exactly as uploaded, plus the two-up view.
// Rendered at 1x so zooming shows the real banner pixels.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('./', import.meta.url);
const FONTS = pathToFileURL('/root/peri-clinnic.ru/public/fonts/').href;
const OUT = new URL('out/', ROOT).href;
const img = (n) => `${OUT}${n}.png`;

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
@font-face{font-family:'Cormorant Garamond';src:url('${FONTS}cormorant-garamond.woff2') format('woff2');font-weight:300 700;font-style:normal}
@font-face{font-family:'Cormorant Garamond';src:url('${FONTS}cormorant-garamond-italic.woff2') format('woff2');font-weight:300 700;font-style:italic}
@font-face{font-family:'Golos Text';src:url('${FONTS}golos-text.woff2') format('woff2');font-weight:400 900}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#ECE6DA;color:#35322A;font-family:'Golos Text',Arial,sans-serif;padding:52px 48px 56px;-webkit-font-smoothing:antialiased}
header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:44px}
h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:48px;line-height:1.05}
h1 em{font-style:italic;color:#7C5F27}
.sub{margin-top:10px;font-size:15px;color:#5F594C}
.sw{display:flex;gap:22px}
.sw div{text-align:center;font-family:'Cormorant Garamond',serif;font-size:13px;letter-spacing:.2em;color:#7C5F27}
.sw i{display:block;width:58px;height:78px;border-radius:999px 999px 0 0;margin:0 auto 10px}
.sw small{display:block;font-family:'Golos Text',sans-serif;letter-spacing:.06em;font-size:11px;color:#5F594C;margin-top:3px}
.lab{font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#7C5F27;margin:0 0 12px}
section{margin-bottom:38px}
.card{display:block;border-radius:20px;box-shadow:0 18px 40px -20px rgba(53,50,42,.4)}
.panel{background:#DDE7DF;border-radius:26px;padding:22px;display:flex;gap:14px}
.panel .card{width:523px;height:auto;border-radius:12px;box-shadow:none}
.stack{display:flex;flex-direction:column;gap:30px}
.row{display:flex;gap:24px}
.row .card{width:540px;height:auto}
footer{margin-top:6px;font-size:14px;line-height:1.5;color:#5F594C;max-width:900px}
</style></head><body>
<header>
  <div><h1>Баннеры для ПроДокторов — <em>новость клиники в арке</em></h1>
  <p class="sub">Палитра бренда: Mint · Brass · Ivory. Тексты и фото — пример: подставьте реальную новость клиники.</p></div>
  <div class="sw">
    <div><i style="background:#B7C9B8"></i>MINT<small>#B7C9B8</small></div>
    <div><i style="background:#C9A96B"></i>BRASS<small>#C9A96B</small></div>
    <div><i style="background:#F4EFE6;box-shadow:inset 0 0 0 1px #C9A96B"></i>IVORY<small>#F4EFE6</small></div>
  </div>
</header>
<section><p class="lab">Два баннера рядом, как в блоке на странице клиники (≈ 50 %)</p>
  <div class="panel"><img class="card" src="${img('banner1-specialist-desktop-1104x308')}"><img class="card" src="${img('banner2-service-desktop-1104x308')}"></div></section>
<section><p class="lab">Версия для ПК · 1104 × 308 · 100 %</p>
  <div class="stack"><img class="card" src="${img('banner1-specialist-desktop-1104x308')}"><img class="card" src="${img('banner2-service-desktop-1104x308')}"></div></section>
<section><p class="lab">Мобильная версия · 700 × 480</p>
  <div class="row"><img class="card" src="${img('banner1-specialist-mobile-700x480')}"><img class="card" src="${img('banner2-service-mobile-700x480')}"></div></section>
</body></html>`;

const htmlUrl = new URL('html/overview.html', ROOT);
writeFileSync(htmlUrl, html);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await page.goto(htmlUrl.href);
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
await page.screenshot({ path: new URL('out/00-overview.png', ROOT).pathname, fullPage: true });
await browser.close();
console.log('ok');
