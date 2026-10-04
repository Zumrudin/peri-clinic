// Two softer takes on the review table-tent: the brand colours diluted with white (soften() in lib.mjs), gentler contrast,
// a lighter title weight and nested rounded shapes. Copy, QR targets and logos are the same as in build.mjs.
//   node artifacts/review-tent-20261002/soft.mjs     → out/peri-review-tent-soft-{1,2}.png (+pdf) and out/compare.png
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { BRAND as B, ROWS, OUT, qr, logoUri, stars, soften, fontFaces, renderAll } from './lib.mjs';

// "share" is how much white is mixed into the brand colour. Text tones stay dark enough for print:
// ink 8.8:1 and secondary ink 7:1 on the soft ivory, brass text 4.9:1.
const S = {
  ivory: soften(B.ivory, .5), ivoryEdge: soften(B.ivory, .15),
  m85: soften(B.mint, .85), m72: soften(B.mint, .72), m70: soften(B.mint, .7), m60: soften(B.mint, .6), m50: soften(B.mint, .5), m35: soften(B.mint, .35),
  star: soften(B.brass, .15), brassLine: soften(B.brass, .3),
  ink: '#4A463C', ink2: '#5A554A', brassText: '#85672E', qr: '#2B352E',
};
console.log('soft tints:', JSON.stringify(S));

const head = `<header class="head"><h1>Уважаемые пациенты</h1><div class="stars">${stars(S.star)}</div>` +
  `<p class="lead">Дарим <b>500 бонусов</b> на Ваш счёт или подарок*,<br>если Вы оставите отзыв о нашей работе</p></header>`;
const qrTile = (r) => `<div class="qr">${qr(r.url, S.qr)}</div>`;
const logo = (r) => `<div class="logo"><img alt="${r.name}" src="${logoUri(r.logo)}" style="height:${r.h}mm"></div>`;

const page = (css, body, bg) => `<!doctype html><html lang="ru"><meta charset="utf-8"><title>PERI CLINIC — отзывы</title>
<style>
${fontFaces()}
@page { size: 148mm 210mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${bg}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { position: relative; width: 148mm; height: 209.8mm; overflow: hidden; color: ${S.ink}; font-family: 'Golos Text', sans-serif; }
.head { position: absolute; left: 0; right: 0; text-align: center; }
h1 { margin: 0; font: 500 9.8mm/1 'Cormorant Garamond', serif; letter-spacing: .012em; }
.stars { display: flex; justify-content: center; gap: 2.4mm; margin-top: 3.4mm; }
.star { width: 7.4mm; height: 6.8mm; display: block; }
.lead { margin: 4.4mm 0 0; font: 400 3.75mm/1.45 'Golos Text', sans-serif; color: ${S.ink2}; }
.lead b { font-weight: 600; color: ${S.brassText}; }
.qr { flex: none; overflow: hidden; box-shadow: 0 .5mm 1.7mm rgba(63, 86, 70, .16); }
.qr svg { display: block; width: 100%; height: 100%; }
.logo { flex: 1; display: flex; justify-content: center; align-items: center; }
.logo img { display: block; }
${css}
</style>
<div class="sheet">${body}</div>`;

// 1 — «нежная арка»: the first layout, softened (pale mint arch with a light gradient, champagne hairlines)
const css1 = `
.sheet { background: linear-gradient(180deg, ${S.ivory} 0%, ${S.ivoryEdge} 100%); }
.head { top: 10mm; }
.arch { position: absolute; left: 10mm; top: 50.5mm; width: 40mm; height: 146.5mm; border-radius: 20mm 20mm 2.4mm 2.4mm; background: linear-gradient(180deg, ${S.m50} 0%, ${S.m35} 100%); }
.arch::before { content: ''; position: absolute; inset: -2.2mm; border: .28mm solid ${S.brassLine}; border-radius: 22.2mm 22.2mm 4.6mm 4.6mm; }
.rows { position: absolute; left: 10mm; right: 10mm; top: 62.5mm; margin: 0; padding: 0; list-style: none; }
.row { position: relative; height: 30mm; margin-bottom: 3.5mm; display: flex; align-items: center; }
.row:last-child { margin-bottom: 0; }
.row + .row::before { content: ''; position: absolute; left: 48mm; right: 0; top: -1.85mm; height: .25mm; background: ${S.brassLine}; }
.qr { width: 30mm; height: 30mm; margin-left: 5mm; border-radius: 2.6mm; }
.logo { margin-left: 8mm; }`;
const body1 = `${head}<div class="arch"></div><ol class="rows">${ROWS.map((r) => `<li class="row">${qrTile(r)}${logo(r)}</li>`).join('')}</ol>`;

// 2 — «мятная дымка»: a different composition — a mint haze page, an ivory arch-topped window and pale-mint row cards
const css2 = `
.sheet { background: radial-gradient(125% 80% at 50% 12%, ${S.m85} 0%, ${S.m72} 60%, ${S.m50} 100%); }
.panel { position: absolute; left: 9mm; top: 7mm; width: 130mm; height: 191mm; border-radius: 44mm 44mm 7mm 7mm; background: ${S.ivory}; box-shadow: 0 .8mm 3.6mm rgba(63, 86, 70, .14); }
.panel::before { content: ''; position: absolute; inset: 2.4mm; border: .25mm solid ${S.brassLine}; border-radius: 41.6mm 41.6mm 4.6mm 4.6mm; }
.head { top: 17.5mm; }
.cards { position: absolute; left: 16mm; right: 16mm; top: 57mm; margin: 0; padding: 0; list-style: none; }
.card { height: 31.2mm; margin-bottom: 2.4mm; padding-left: 1.1mm; display: flex; align-items: center; border-radius: 5mm; background: linear-gradient(90deg, ${S.m60} 0%, ${S.m70} 100%); }
.card:last-child { margin-bottom: 0; }
.qr { width: 29mm; height: 29mm; border-radius: 3.9mm; }
.logo { margin: 0 2mm 0 5mm; }`;
const body2 = `<div class="panel"></div>${head}<ol class="cards">${ROWS.map((r) => `<li class="card">${qrTile(r)}${logo(r)}</li>`).join('')}</ol>`;

await renderAll([
  { html: page(css1, body1, S.ivoryEdge), base: 'peri-review-tent-soft-1' },
  { html: page(css2, body2, S.m50), base: 'peri-review-tent-soft-2' },
]);

// one picture with all three, for a quick look on a phone: the sheet as first published vs the two soft variants
const img = (f) => `data:image/png;base64,${readFileSync(join(OUT, f)).toString('base64')}`;
const figs = [
  ['peri-review-tent-a5.png', 'Было', 'полные цвета бренда'],
  ['peri-review-tent-soft-1.png', 'Вариант 1', 'нежная арка'],
  ['peri-review-tent-soft-2.png', 'Вариант 2', 'мятная дымка'],
];
const compare = `<!doctype html><meta charset="utf-8"><style>
${fontFaces()}
body { margin: 0; background: #EDE8DE; }
.wrap { display: flex; gap: 64px; padding: 64px; justify-content: center; }
figure { margin: 0; width: 640px; }
img { display: block; width: 640px; height: auto; box-shadow: 0 8px 28px rgba(60, 55, 40, .2); }
figcaption { margin-top: 24px; text-align: center; }
b { display: block; font: 600 34px/1.1 'Cormorant Garamond', serif; color: #4A463C; }
span { font: 400 20px 'Golos Text', sans-serif; color: #7A7468; }
</style><div class="wrap">${figs.map(([f, t, s]) => `<figure><img src="${img(f)}"><figcaption><b>${t}</b><span>${s}</span></figcaption></figure>`).join('')}</div>`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await browser.newContext({ viewport: { width: 2176, height: 1200 } })).newPage();
await p.setContent(compare, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(OUT, 'compare.png'), fullPage: true });
await browser.close();
console.log('built compare');
