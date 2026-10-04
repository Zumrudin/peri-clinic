// Review table-tent sheet (A5 portrait) in the full-strength 2026-10 brand palette — the version published first.
// Helpers live in lib.mjs; the softer variants are in soft.mjs.   node artifacts/review-tent-20261002/build.mjs
import { BRAND, ROWS, qr, logoUri, stars, fontFaces, renderAll } from './lib.mjs';

// Text tones derived from the brand board for contrast (ink 11:1 on ivory, brass-deep 5.2:1 on ivory).
const C = { ...BRAND, ink: '#35322A', inkGreen: '#26312A', brassDeep: '#7C5F27' };

const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>PERI CLINIC — отзывы</title>
<style>
${fontFaces()}
@page { size: 148mm 210mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${C.ivory}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { position: relative; width: 148mm; height: 209.8mm; overflow: hidden; background: ${C.ivory}; color: ${C.ink}; font-family: 'Golos Text', sans-serif; }
.head { position: absolute; left: 0; right: 0; top: 10mm; text-align: center; }
h1 { margin: 0; font: 600 9.8mm/1 'Cormorant Garamond', serif; letter-spacing: .005em; }
.stars { display: flex; justify-content: center; gap: 2.4mm; margin-top: 3.4mm; }
.star { width: 7.4mm; height: 6.8mm; display: block; }
.lead { margin: 4.4mm 0 0; font: 400 3.75mm/1.45 'Golos Text', sans-serif; }
.lead b { font-weight: 600; color: ${C.brassDeep}; }
/* the brand board's arch: a tall rounded-top window holding the QR column, with a brass hairline echoing it */
.arch { position: absolute; left: 10mm; top: 50.5mm; width: 40mm; height: 146.5mm; background: ${C.mint}; border-radius: 20mm 20mm 1.6mm 1.6mm; }
.arch::before { content: ''; position: absolute; inset: -2.2mm; border: .3mm solid ${C.brass}; border-radius: 22.2mm 22.2mm 3.8mm 3.8mm; }
.rows { position: absolute; left: 10mm; right: 10mm; top: 62.5mm; margin: 0; padding: 0; list-style: none; }
.row { position: relative; height: 30mm; margin-bottom: 3.5mm; display: flex; align-items: center; }
.row:last-child { margin-bottom: 0; }
.row + .row::before { content: ''; position: absolute; left: 48mm; right: 0; top: -1.85mm; height: .25mm; background: ${C.brass}; }
.qr { flex: none; width: 30mm; height: 30mm; margin-left: 5mm; border-radius: 1.8mm; overflow: hidden; }
.qr svg { display: block; width: 100%; height: 100%; }
.logo { flex: 1; margin-left: 8mm; display: flex; justify-content: center; align-items: center; }
.logo img { display: block; }
</style>
<div class="sheet">
  <header class="head">
    <h1>Уважаемые пациенты</h1>
    <div class="stars">${stars(C.brass)}</div>
    <p class="lead">Дарим <b>500 бонусов</b> на Ваш счёт или подарок*,<br>если Вы оставите отзыв о нашей работе</p>
  </header>
  <div class="arch"></div>
  <ol class="rows">
${ROWS.map((r) => `    <li class="row"><div class="qr">${qr(r.url, C.inkGreen)}</div><div class="logo"><img alt="${r.name}" src="${logoUri(r.logo)}" style="height:${r.h}mm"></div></li>`).join('\n')}
  </ol>
</div>`;

await renderAll([{ html, base: 'peri-review-tent-a5' }]);
