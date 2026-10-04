// Final Lumecca banner for ProDoctorov: «Фотоомоложение на аппарате Lumecca InMode» + 4 benefits.
// Design is the approved banner2-lumecca-photo (mint field, brass pillar, ivory-matted photo arch, same
// arch geometry and fonts as build.mjs); only the copy block changed. HTML → Chrome @2x → Lanczos to exact size.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('./', import.meta.url);
const FONTS = pathToFileURL('/root/peri-clinnic.ru/public/fonts/').href;
const ASSETS = new URL('assets/', ROOT).href;
mkdirSync(new URL('html/', ROOT), { recursive: true });
mkdirSync(new URL('out/', ROOT), { recursive: true });

const T = {
  bg: '#B7C9B8', bgHi: '#C3D3C4', ink: '#26312A', soft: '#44503F', accent: '#55401A', logo: 'logo-deep.png',
  brass: '#C9A96B', ivory: '#F4EFE6', lineFill: 'rgba(244,239,230,.22)', shadow: 'rgba(38,49,42,.34)',
};

const LAYOUTS = {
  desktop: {
    w: 1104, h: 308, padX: 46, copyW: 700, inline: true, mat: 6,
    front: { left: 836, w: 216, h: 288 }, side: { left: 758, w: 136, h: 206 }, line: { left: 974, w: 150, h: 252 },
    logoH: 28, gapLogo: 12, title: 34, ruleGap: 8, item: 19.5, icon: 19, gap: 10, colGap: 30, rowGap: 4, listW: 660,
    note: 13, noteBottom: 16, noteW: 660, noteArea: 50,
  },
  mobile: {
    w: 700, h: 480, padX: 38, copyW: 410, inline: false, mat: 6,
    front: { left: 474, w: 206, h: 420 }, side: { left: 442, w: 100, h: 170 }, line: { left: 632, w: 130, h: 330 },
    logoH: 28, gapLogo: 14, title: 35, ruleGap: 13, item: 20, icon: 21, gap: 10, colGap: 0, rowGap: 8, listW: 384,
    note: 14.5, noteBottom: 20, noteW: 396, noteArea: 80,
  },
};

const NOTE = ['Изображение носит иллюстративный характер. Результат индивидуален.', 'Возможность процедуры определяет врач после осмотра.'];
const TITLE = ['<em>Фотоомоложение</em> на аппарате', 'Lumecca InMode'];

const VARIANTS = {
  // main: the four benefits as agreed with the user
  'banner2-lumecca-benefits': {
    marker: 'check',
    items: ['Более ровный тон кожи', 'Менее заметные пигментные пятна', 'Менее заметные сосуды и покраснения', 'Параметры света подбирает врач под вашу кожу и зону'],
  },
  // fallback if moderation rejects result claims: same four points phrased as indications
  'banner2-lumecca-benefits-safe': {
    marker: 'dot',
    grid: true,
    label: 'Применяется при:',
    items: ['пигментных пятнах', 'видимых сосудах и покраснении', 'неоднородном тоне кожи', 'изменениях кожи после<br>воздействия солнца'],
  },
};

function html(v, L, layoutName) {
  const lh = Math.round(L.item * 1.22);
  const check = `<i class="ic"><svg viewBox="0 0 12 12"><path d="M2.5 6.4l2.3 2.3 4.7-4.9" fill="none" stroke="${T.ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></i>`;
  const mark = v.marker === 'check' ? check : '<i class="ic dot"></i>';
  const items = v.items.map((x) => `<li>${mark}<span>${x}</span></li>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
@font-face{font-family:'Cormorant Garamond';src:url('${FONTS}cormorant-garamond.woff2') format('woff2');font-weight:300 700;font-style:normal}
@font-face{font-family:'Cormorant Garamond';src:url('${FONTS}cormorant-garamond-italic.woff2') format('woff2');font-weight:300 700;font-style:italic}
@font-face{font-family:'Golos Text';src:url('${FONTS}golos-text.woff2') format('woff2');font-weight:400 900}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${L.w}px;height:${L.h}px;background:${T.bg}}
.banner{position:relative;width:${L.w}px;height:${L.h}px;overflow:hidden;background:${T.bg};color:${T.ink};font-family:'Golos Text',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.banner::before{content:'';position:absolute;inset:0;background:radial-gradient(90% 130% at 8% 0%,${T.bgHi} 0%,rgba(255,255,255,0) 62%)}
.copy{position:absolute;left:${L.padX}px;top:0;bottom:0;width:${L.copyW}px;display:flex;flex-direction:column;justify-content:center;padding-bottom:${L.noteArea}px}
.logo{display:block;height:${L.logoH}px;width:auto;align-self:flex-start;margin-bottom:${L.gapLogo}px}
.title{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:${L.title}px;line-height:1.06;letter-spacing:-.004em;${L.inline ? 'white-space:nowrap;' : ''}}
.title span{display:${L.inline ? 'inline' : 'block'}}
.title em{font-style:italic;color:${T.accent}}
.rule{display:block;width:56px;height:2px;background:${T.brass};margin:${L.ruleGap}px 0 ${L.ruleGap + 2}px}
.lab{font-weight:600;font-size:${Math.round(L.item * 0.68)}px;letter-spacing:.16em;text-transform:uppercase;color:${T.accent};margin-bottom:${Math.round(L.item * 0.4)}px}
.list{display:flex;${L.inline ? 'flex-wrap:wrap;' : 'flex-direction:column;'}column-gap:${L.colGap}px;row-gap:${L.rowGap}px;max-width:${L.listW}px;list-style:none}
${v.grid && L.inline ? `.list{display:grid;grid-template-columns:max-content 380px;column-gap:36px;row-gap:4px;justify-content:start;max-width:none}` : ''}
.list li{display:flex;align-items:flex-start;gap:${L.gap}px;font-weight:500;font-size:${L.item}px;line-height:${lh}px;${L.inline && !v.grid ? 'white-space:nowrap;' : ''}}
.ic{flex:none;display:grid;place-items:center;width:${L.icon}px;height:${L.icon}px;margin-top:${(lh - L.icon) / 2}px;border-radius:50%;background:${T.brass}}
.ic svg{width:64%;height:64%}
.ic.dot{background:none;position:relative}
.ic.dot::after{content:'';position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:${T.brass}}
.note span{display:${L.inline ? 'block' : 'inline'}}
.note{position:absolute;left:${L.padX}px;bottom:${L.noteBottom}px;width:${L.noteW}px;font-size:${L.note}px;line-height:1.3;color:${T.soft}}
.art{position:absolute;inset:0;pointer-events:none}
.arch{position:absolute;bottom:0;border-radius:999px 999px 0 0}
.arch--line{left:${L.line.left}px;width:${L.line.w}px;height:${L.line.h}px;border:2px solid ${T.ivory};border-bottom:0;background:${T.lineFill}}
.arch--side{left:${L.side.left}px;width:${L.side.w}px;height:${L.side.h}px;background:${T.brass}}
.arch--front{left:${L.front.left}px;width:${L.front.w}px;height:${L.front.h}px;background:${T.brass};box-shadow:0 24px 46px -22px ${T.shadow};overflow:hidden;border:${L.mat}px solid ${T.ivory};border-bottom:0}
.subject{position:absolute;display:block;z-index:1;inset:0;width:100%;height:100%;object-fit:cover}
</style></head><body>
<div class="banner" data-layout="${layoutName}">
  <div class="copy">
    <img class="logo" src="${ASSETS}${T.logo}" alt="PERI CLINIC">
    <h1 class="title"><span>${TITLE[0]}</span> <span>${TITLE[1]}</span></h1>
    <i class="rule"></i>
    ${v.label ? `<p class="lab">${v.label}</p>` : ''}
    <ul class="list">${items}</ul>
  </div>
  <div class="art" aria-hidden="true">
    <span class="arch arch--line"></span>
    <span class="arch arch--side"></span>
    <span class="arch arch--front"><img class="subject" src="${ASSETS}${layoutName === 'desktop' ? 'lumecca-girl-desktop.jpg' : 'lumecca-girl-mobile.jpg'}" alt=""></span>
  </div>
  <p class="note"><span>${NOTE[0]}</span> <span>${NOTE[1]}</span></p>
</div></body></html>`;
}

const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const [id, v] of Object.entries(VARIANTS)) {
  if (only && !id.endsWith(only)) continue;
  for (const [layoutName, L] of Object.entries(LAYOUTS)) {
    const name = `${id}-${layoutName}-${L.w}x${L.h}`;
    const htmlUrl = new URL(`html/${name}.html`, ROOT);
    writeFileSync(htmlUrl, html(v, L, layoutName));
    const page = await browser.newPage({ viewport: { width: L.w, height: L.h }, deviceScaleFactor: 2 });
    await page.goto(htmlUrl.href);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
    const g = await page.evaluate(() => {
      const rect = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom) }; };
      const q = (s) => document.querySelector(s);
      const textRight = (els) => Math.max(...els.map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); return Math.round(rg.getBoundingClientRect().right); }));
      return {
        logo: rect(q('.logo')), list: rect(q('.list')), note: rect(q('.note')), front: rect(q('.arch--front')), side: rect(q('.arch--side')), line: rect(q('.arch--line')),
        titleRight: textRight([...document.querySelectorAll('.title span')]), listRight: textRight([...document.querySelectorAll('.list li span')]),
        rows: new Set([...document.querySelectorAll('.list li')].map((e) => Math.round(e.getBoundingClientRect().y))).size,
      };
    });
    const raw = new URL(`out/${name}@2x.png`, ROOT);
    await page.screenshot({ path: raw.pathname, clip: { x: 0, y: 0, width: L.w, height: L.h } });
    await page.close();
    await sharp(raw.pathname).resize(L.w, L.h, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(new URL(`out/${name}.png`, ROOT).pathname);
    const gx = Math.min(g.front.x, g.side.x, g.line.x), gy = Math.min(g.front.y, g.side.y, g.line.y);
    const share = ((Math.min(L.w, Math.max(g.front.r, g.side.r, g.line.r)) - gx) * (L.h - gy)) / (L.w * L.h);
    console.log(JSON.stringify({ name, share: +share.toFixed(3), logoTop: g.logo.y, listBottom: g.list.b, noteTop: g.note.y, gapListNote: g.note.y - g.list.b, titleRight: g.titleRight, listRight: g.listRight, artLeft: gx, gapText: gx - Math.max(g.titleRight, g.listRight), listRows: g.rows }));
  }
}
await browser.close();
