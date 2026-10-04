// ProDoctorov informational banners in the new brand palette (Mint / Brass / Ivory).
// HTML → Chrome @2x → Lanczos down to the exact upload size, so hairlines and arch edges stay clean.
// Device cut-outs are the manufacturer images already on the live clinic site; the one human photo
// (gen/girl-gpt.png) is AI-generated, so every banner carries ProDoctorov's «иллюстративный характер» line.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('./', import.meta.url);
const FONTS = pathToFileURL('/root/peri-clinnic.ru/public/fonts/').href;
const ASSETS = new URL('assets/', ROOT).href;
mkdirSync(new URL('html/', ROOT), { recursive: true });
mkdirSync(new URL('out/', ROOT), { recursive: true });

const THEMES = {
  ivory: {
    bg: '#F4EFE6', bgHi: '#FAF7F1',
    ink: '#35322A', soft: '#5F594C', accent: '#7C5F27', logo: 'logo-bronze.png',
    front: '#B7C9B8', side: '#C9A96B', line: '#C9A96B', lineFill: 'rgba(255,255,255,.5)', mat: '#F4EFE6', rule: '#C9A96B',
    shadow: 'rgba(53,50,42,.30)',
  },
  mint: {
    bg: '#B7C9B8', bgHi: '#C3D3C4',
    ink: '#26312A', soft: '#44503F', accent: '#55401A', logo: 'logo-deep.png',
    front: '#C9A96B', side: '#F4EFE6', line: '#F4EFE6', lineFill: 'rgba(244,239,230,.22)', mat: '#F4EFE6', rule: '#C9A96B',
    shadow: 'rgba(38,49,42,.34)',
  },
};

const LAYOUTS = {
  desktop: {
    w: 1104, h: 308, padX: 46, copyW: 700, inline: true,
    logoH: 34, gapLogo: 20, title: 43, name: 28, role: 22, roleW: 700, note: 13.5, noteBottom: 18, ruleGap: 16, mat: 6,
    front: { left: 836, w: 216, h: 288 }, side: { left: 758, w: 136, h: 206 }, line: { left: 974, w: 150, h: 252 },
  },
  mobile: {
    w: 700, h: 480, padX: 38, copyW: 396, inline: false,
    logoH: 34, gapLogo: 26, title: 46, name: 28, role: 22, roleW: 376, note: 16, noteBottom: 22, ruleGap: 20, mat: 6,
    front: { left: 474, w: 206, h: 420 }, side: { left: 442, w: 100, h: 170 }, line: { left: 632, w: 130, h: 330 },
  },
};

const NOTE = 'Изображение носит иллюстративный характер';
// Wording follows ProDoctorov's approved formulas: no «хит», no seasonal hook, no effects or indications.
const BANNERS = {
  'banner1-pladuo': {
    theme: 'ivory',
    title: ['В клинике появился', 'новый аппарат'],
    name: 'Pladuo',
    role: ['аргоновая и азотная плазма', 'ShenB, Южная Корея'],
    subject: { kind: 'device', src: 'pladuo-fade.png', desktop: { h: 268, top: 14 }, mobile: { h: 380, top: 34 } },
    note: NOTE,
  },
  'banner2-lumecca-photo': {
    theme: 'mint',
    arch: { side: '#C9A96B', line: '#F4EFE6' },
    title: ['В клинике проводят', 'фотоомоложение'],
    name: 'Lumecca',
    role: ['процедура на основе интенсивного импульсного света'],
    subject: { kind: 'photo', desktop: 'lumecca-girl-desktop.jpg', mobile: 'lumecca-girl-mobile.jpg' },
    note: NOTE,
  },
  'banner2-lumecca-device': {
    theme: 'mint',
    title: ['В клинике проводят', 'фотоомоложение'],
    name: 'Lumecca',
    role: ['процедура на основе интенсивного импульсного света'],
    subject: { kind: 'device', src: 'lumecca.png', desktop: { h: 236, top: 44 }, mobile: { h: 262, top: 104 } },
    note: NOTE,
  },
};

function html(b, T, L, layoutName) {
  const t = { ...T, ...(b.arch || {}) };
  const s = b.subject;
  const dev = s[layoutName];
  const subject = s.kind === 'photo'
    ? `<img class="subject" src="${ASSETS}${s[layoutName]}" alt="">`
    : `<i class="floor"></i><img class="subject" src="${ASSETS}${s.src}" alt="">`;
  const roleHtml = b.role.map((r, i) => `${i ? '<span class="dot"> · </span>' : ''}<span>${r}</span>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
@font-face{font-family:'Cormorant Garamond';src:url('${FONTS}cormorant-garamond.woff2') format('woff2');font-weight:300 700;font-style:normal}
@font-face{font-family:'Cormorant Garamond';src:url('${FONTS}cormorant-garamond-italic.woff2') format('woff2');font-weight:300 700;font-style:italic}
@font-face{font-family:'Golos Text';src:url('${FONTS}golos-text.woff2') format('woff2');font-weight:400 900}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${L.w}px;height:${L.h}px;background:${t.bg}}
.banner{position:relative;width:${L.w}px;height:${L.h}px;overflow:hidden;background:${t.bg};color:${t.ink};font-family:'Golos Text',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.banner::before{content:'';position:absolute;inset:0;background:radial-gradient(90% 130% at 8% 0%,${t.bgHi} 0%,rgba(255,255,255,0) 62%)}
.copy{position:absolute;left:${L.padX}px;top:0;bottom:0;width:${L.copyW}px;display:flex;flex-direction:column;justify-content:center;padding-bottom:${L.noteBottom + 12}px}
.logo{display:block;height:${L.logoH}px;width:auto;align-self:flex-start;margin-bottom:${L.gapLogo}px}
.title{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:${L.title}px;line-height:1.04;letter-spacing:-.005em;${L.inline ? 'white-space:nowrap;' : ''}}
.title span,.title em{display:${L.inline ? 'inline' : 'block'}}
.title em{font-style:italic;color:${t.accent}}
.rule{display:block;width:56px;height:2px;background:${t.rule};margin:${L.ruleGap}px 0}
.name{font-weight:600;font-size:${L.name}px;line-height:1.22}
.role{font-weight:400;font-size:${L.role}px;line-height:1.3;color:${t.soft};margin-top:6px;max-width:${L.roleW}px}
.role span{display:${L.inline ? 'inline' : 'block'}}
${L.inline ? '' : '.role .dot{display:none}'}
.note{position:absolute;left:${L.padX}px;bottom:${L.noteBottom}px;font-size:${L.note}px;line-height:1.2;color:${t.soft}}
.art{position:absolute;inset:0;pointer-events:none}
.arch{position:absolute;bottom:0;border-radius:999px 999px 0 0}
.arch--line{left:${L.line.left}px;width:${L.line.w}px;height:${L.line.h}px;border:2px solid ${t.line};border-bottom:0;background:${t.lineFill}}
.arch--side{left:${L.side.left}px;width:${L.side.w}px;height:${L.side.h}px;background:${t.side}}
.arch--front{left:${L.front.left}px;width:${L.front.w}px;height:${L.front.h}px;background:${t.front};box-shadow:0 24px 46px -22px ${t.shadow};overflow:hidden;${s.kind === 'photo' ? `border:${L.mat}px solid ${t.mat};border-bottom:0;` : ''}}
${s.kind === 'photo' ? '' : `.arch--front::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 70% at 30% 0%,rgba(255,255,255,.16),rgba(255,255,255,0) 60%)}`}
.subject{position:absolute;display:block;z-index:1;${s.kind === 'photo'
    ? 'inset:0;width:100%;height:100%;object-fit:cover;'
    : `height:${dev.h}px;width:auto;left:50%;transform:translateX(-50%);top:${dev.top}px;filter:drop-shadow(0 6px 10px ${t.shadow});`}}
${s.kind === 'photo' ? '' : `.floor{position:absolute;z-index:0;left:50%;transform:translateX(-50%);top:${dev.top + dev.h - 12}px;width:${Math.round(dev.h * 0.5)}px;height:${Math.round(dev.h * 0.06)}px;background:radial-gradient(ellipse at center,${t.shadow} 0%,rgba(0,0,0,0) 70%)}`}
</style></head><body>
<div class="banner" data-layout="${layoutName}">
  <div class="copy">
    <img class="logo" src="${ASSETS}${t.logo}" alt="PERI CLINIC">
    <h1 class="title"><span>${b.title[0]}</span> <em>${b.title[1]}</em></h1>
    <i class="rule"></i>
    <p class="name">${b.name}</p>
    <p class="role">${roleHtml}</p>
  </div>
  <div class="art" aria-hidden="true">
    <span class="arch arch--line"></span>
    <span class="arch arch--side"></span>
    <span class="arch arch--front">${subject}</span>
  </div>
  <p class="note">${b.note}</p>
</div></body></html>`;
}

const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const report = [];
for (const [id, b] of Object.entries(BANNERS)) {
  if (only && !id.includes(only)) continue;
  for (const [layoutName, L] of Object.entries(LAYOUTS)) {
    const T = THEMES[b.theme];
    const name = `${id}-${layoutName}-${L.w}x${L.h}`;
    const htmlUrl = new URL(`html/${name}.html`, ROOT);
    writeFileSync(htmlUrl, html(b, T, L, layoutName));
    const page = await browser.newPage({ viewport: { width: L.w, height: L.h }, deviceScaleFactor: 2 });
    await page.goto(htmlUrl.href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    const geo = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      const textRight = Math.max(...['.title span', '.title em', '.name', '.role'].map((s) => { const e = document.querySelector(s); const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect().right; }));
      return { logo: r('.logo'), title: r('.title'), name: r('.name'), role: r('.role'), note: r('.note'), front: r('.arch--front'), side: r('.arch--side'), line: r('.arch--line'), textRight: Math.round(textRight), fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.style}`) };
    });
    const raw = new URL(`out/${name}@2x.png`, ROOT);
    await page.screenshot({ path: raw.pathname, clip: { x: 0, y: 0, width: L.w, height: L.h } });
    await page.close();
    const final = new URL(`out/${name}.png`, ROOT);
    await sharp(raw.pathname).resize(L.w, L.h, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(final.pathname);
    // visual share: bounding box of the whole arch group vs. banner area (ProDoctorov: visual ≤ 1/3)
    const gx = Math.min(geo.front.x, geo.side.x, geo.line.x), gy = Math.min(geo.front.y, geo.side.y, geo.line.y);
    const groupArea = (Math.min(L.w, Math.max(geo.front.r, geo.side.r, geo.line.r)) - gx) * (L.h - gy);
    report.push({ name, share: +(groupArea / (L.w * L.h)).toFixed(3), textRight: geo.textRight, artLeft: gx, gap: gx - geo.textRight, logoTop: geo.logo.y, roleBottom: geo.role.b, noteTop: geo.note.y, noteRight: geo.note.r, fonts: geo.fonts.length });
  }
}
await browser.close();
for (const r of report) console.log(JSON.stringify(r));
