// The approved layout (Вариант 2, «мятная дымка»), final wording, five full stars — on a canvas enlarged by 2 cm on every
// side, because the table-tent pocket is about 2 cm bigger than A5 all round. The design keeps its size and sits in the
// middle; only the mint haze is carried out to the new edges. Reword by editing COPY and re-run:
//   node artifacts/review-tent-20261002/final.mjs   →  out/peri-review-tent-final-5star-188x250.{png,pdf}
import { BRAND as B, ROWS, qr, logoUri, stars, soften, fontFaces, fitHeading, renderAll } from './lib.mjs';

// «вы/ваш» are lowercase to match the heading and the site's own voice (the old sheet capitalised them).
// «рублей» is the client's wording; the loyalty page itself says «баллы/бонусы» on a «бонусный счёт» (spend up to 10 %).
const COPY = {
  heading: 'Нам важно ваше мнение',
  offer: ['Дарим <b>500 рублей</b> на ваш счёт или подарок*,', 'если вы оставите отзыв о нашей работе'],
};
const STARS = { halfLast: false }; // the client asked for five full stars (the first final sheet had 4.5)

const MARGIN_MM = 20;                       // extra background on every side
const SHEET = [148, 210];                   // the design itself: A5
const W = SHEET[0] + 2 * MARGIN_MM, H = SHEET[1] + 2 * MARGIN_MM;
const VW = Math.ceil(W * 96 / 25.4), VH = Math.ceil(H * 96 / 25.4); // the same canvas in whole css px (711 × 945 ≈ 188.1 × 250.0 mm)
// The margin is snapped to whole device pixels at 300 dpi (236 px ≈ 19.98 mm), so Chrome rasterises the design exactly as
// on the plain A5 sheet — which lets the two PNGs be compared pixel for pixel.
const PAD = Math.round(MARGIN_MM * 96 / 25.4 * 3.125) / 3.125; // css px

// Brand colours diluted with white; text stays dark (ink 8.8:1, secondary 6.9:1, brass text 4.9:1 on the soft ivory).
const S = {
  ivory: soften(B.ivory, .5),
  m85: soften(B.mint, .85), m72: soften(B.mint, .72), m70: soften(B.mint, .7), m60: soften(B.mint, .6), m50: soften(B.mint, .5),
  star: soften(B.brass, .15), brassLine: soften(B.brass, .3),
  ink: '#4A463C', ink2: '#5A554A', brassText: '#85672E', qr: '#2B352E',
};
const headingMm = await fitHeading(COPY.heading);
console.log('heading size', headingMm, 'mm for «' + COPY.heading + '»');

// The haze is a radial gradient. On the A5 sheet it was "125% 80% at 50% 12%" of a 148 × 209.8 mm box; here the same ellipse is
// written in absolute lengths and moved by the margin, so the middle looks exactly as before and the colour simply goes on
// outwards (the last stop is a plateau, which is what the bottom of the old sheet already was).
const haze = `radial-gradient(${1.25 * SHEET[0]}mm ${0.8 * 209.8}mm at calc(${PAD}px + ${SHEET[0] / 2}mm) calc(${PAD}px + ${0.12 * 209.8}mm), ${S.m85} 0%, ${S.m72} 60%, ${S.m50} 100%)`;

const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>PERI CLINIC — отзывы</title>
<style>
${fontFaces()}
@page { size: ${VW}px ${VH}px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${S.m50}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { html, body { overflow: hidden; } }
/* on screen (the PNG) the canvas is 2 mm bigger than the page, so the screenshot never meets the bare body; in print it is the page */
.page { position: relative; overflow: hidden; width: ${W + 2}mm; height: ${H + 2}mm; background: ${haze}; }
@media print { .page { width: ${VW}px; height: ${VH - 0.5}px; } }
.sheet { position: absolute; left: ${PAD}px; top: ${PAD}px; width: ${SHEET[0]}mm; height: 209.8mm; color: ${S.ink}; font-family: 'Golos Text', sans-serif; }
.panel { position: absolute; left: 9mm; top: 7mm; width: 130mm; height: 191mm; border-radius: 44mm 44mm 7mm 7mm; background: ${S.ivory}; box-shadow: 0 .8mm 3.6mm rgba(63, 86, 70, .14); }
.panel::before { content: ''; position: absolute; inset: 2.4mm; border: .25mm solid ${S.brassLine}; border-radius: 41.6mm 41.6mm 4.6mm 4.6mm; }
.head { position: absolute; left: 0; right: 0; top: 17.5mm; text-align: center; }
/* a fixed 9.8 mm slot, so a smaller heading doesn't pull the stars and the offer upwards */
h1 { margin: 0; height: 9.8mm; display: flex; justify-content: center; align-items: center; white-space: nowrap; font: 500 ${headingMm}mm/1 'Cormorant Garamond', serif; letter-spacing: .012em; }
.stars { display: flex; justify-content: center; gap: 2.4mm; margin-top: 3.4mm; }
.star { width: 7.4mm; height: 6.8mm; display: block; }
.lead { margin: 4.4mm 0 0; font: 400 3.75mm/1.45 'Golos Text', sans-serif; color: ${S.ink2}; }
.lead b { font-weight: 600; color: ${S.brassText}; }
.cards { position: absolute; left: 16mm; right: 16mm; top: 57mm; margin: 0; padding: 0; list-style: none; }
.card { height: 31.2mm; margin-bottom: 2.4mm; padding-left: 1.1mm; display: flex; align-items: center; border-radius: 5mm; background: linear-gradient(90deg, ${S.m60} 0%, ${S.m70} 100%); }
.card:last-child { margin-bottom: 0; }
.qr { flex: none; width: 29mm; height: 29mm; border-radius: 3.9mm; overflow: hidden; box-shadow: 0 .5mm 1.7mm rgba(63, 86, 70, .16); }
.qr svg { display: block; width: 100%; height: 100%; }
.logo { flex: 1; margin: 0 2mm 0 5mm; display: flex; justify-content: center; align-items: center; }
.logo img { display: block; }
</style>
<div class="page"><div class="sheet">
  <div class="panel"></div>
  <header class="head">
    <h1>${COPY.heading}</h1>
    <div class="stars">${stars(S.star, STARS)}</div>
    <p class="lead">${COPY.offer.join('<br>')}</p>
  </header>
  <ol class="cards">
${ROWS.map((r) => `    <li class="card"><div class="qr">${qr(r.url, S.qr)}</div><div class="logo"><img alt="${r.name}" src="${logoUri(r.logo)}" style="height:${r.h}mm"></div></li>`).join('\n')}
  </ol>
</div></div>`;

await renderAll([{ html, base: `peri-review-tent-final-5star-${W}x${H}`, size: [W, H], pdfPx: true }]);
