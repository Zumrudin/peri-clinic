// Shared pieces of the review table-tent builds — build.mjs (full brand colours) and soft.mjs (softer variants):
// QR codes, aggregator logos, stars, brand fonts and the Chrome render to PNG + PDF.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });

// Brand board 2026-10-02. Raw brass on ivory is ~2:1, so it is decoration only (stars, hairlines) — never text.
export const BRAND = { mint: '#B7C9B8', brass: '#C9A96B', ivory: '#F4EFE6' };

// share = how much white goes into the colour (0 = the brand colour itself, 1 = white) — the "softer shades"
export function soften(hex, share) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - share) + 255 * share));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Order is the client's: Яндекс, 2ГИС, ПроДокторов, Google. Yandex/2GIS are the URLs already printed on the old sheet.
// Google was a ~560-char search-results URL with session tokens (a QR too dense to scan at 3 cm); this is the
// canonical write-review link for the same place — the place id is derived from the old URL's #lrd=0x414ab…:0xd685…
// and was confirmed in Maps to open PERI CLINIC.
export const ROWS = [
  { name: 'Яндекс Карты', url: 'https://yandex.ru/maps/org/peri_clinic/38588977489/reviews/?add-review=true&ll=37.721705,55.604890&z=17', logo: 'yandex-maps-ru.svg', h: 12.8 },
  { name: '2ГИС', url: 'https://2gis.ru/moscow/firm/70000001057552313/tab/reviews', logo: '2gis-ru.svg', h: 14.5 },
  { name: 'ПроДокторов', url: 'https://prodoctorov.ru/moskva/lpu/117533-peri-klinik/otzivi/', logo: 'prodoctorov.svg', h: 9 },
  { name: 'Google', url: 'https://search.google.com/local/writereview?placeid=ChIJTXbARGSxSkERFsfZyl_JhdY', logo: 'google-2015.svg', h: 15 },
];
writeFileSync(join(OUT, 'targets.json'), JSON.stringify(ROWS.map(({ name, url }) => ({ name, url })), null, 2));

// qrencode's --svg-path emits one stroked 1-module segment per dark module; re-pack it into filled horizontal runs
// so the QR is a single clean path (no hairline seams between modules in the PDF or the raster).
export function qr(url, dark = '#26312A') {
  const raw = execFileSync('qrencode', ['-t', 'SVG', '--svg-path', '-m', '0', '-l', 'M', '-o', '-', url], { encoding: 'utf8' });
  const n = Number(/viewBox="0 0 (\d+) \d+"/.exec(raw)[1]);
  const rows = Array.from({ length: n }, () => []);
  for (const m of raw.matchAll(/M(\d+),(\d+)h1/g)) rows[Number(m[2])].push(Number(m[1]));
  let d = '';
  rows.forEach((xs, y) => {
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length;) {
      let j = i;
      while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
      const len = xs[j] - xs[i] + 1;
      d += `M${xs[i]} ${y}h${len}v1h-${len}z`;
      i = j + 1;
    }
  });
  const q = 4; // quiet zone in modules — the QR spec minimum, kept inside the white tile
  const s = n + 2 * q;
  return `<svg viewBox="${-q} ${-q} ${s} ${s}" xmlns="http://www.w3.org/2000/svg"><rect x="${-q}" y="${-q}" width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="${dark}"/></svg>`;
}

// The Commons wordmark is all black; the old sheet (and Yandex's own logo) has a red «Я». The path holds every
// letter, «Я» being the first sub-path, so splitting there is enough.
function yandexLogo(svg) {
  const m = /<path fill="#000" d="([^"]+)"\/>/.exec(svg);
  const cut = m[1].indexOf('Z') + 1;
  return svg.replace(m[0], `<path fill="#FC3F1D" d="${m[1].slice(0, cut)}"/><path fill="#000" d="${m[1].slice(cut)}"/>`);
}
export const logoUri = (file) => {
  let svg = readFileSync(join(HERE, 'assets', file), 'utf8');
  if (file.startsWith('yandex')) svg = yandexLogo(svg);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

// 5-point star; the 5th is half-filled (4.5 of 5), as on the old sheet.
function starPath(R = 12, ratio = 0.46, cx = 12, cy = 12) {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = (-90 + k * 36) * Math.PI / 180, r = k % 2 ? R * ratio : R;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
}
export function stars(color, { halfLast = true } = {}) {
  const p = starPath();
  const full = `<svg class="star" viewBox="0 0 24 22"><path d="${p}" fill="${color}" stroke="${color}" stroke-width=".8" stroke-linejoin="round"/></svg>`;
  const half = `<svg class="star" viewBox="0 0 24 22"><defs><clipPath id="half"><rect width="12" height="22"/></clipPath></defs>` +
    `<path d="${p}" fill="none" stroke="${color}" stroke-width=".8" stroke-linejoin="round"/>` +
    `<path d="${p}" fill="${color}" stroke="${color}" stroke-width=".8" stroke-linejoin="round" clip-path="url(#half)"/></svg>`;
  return halfLast ? full.repeat(4) + half : full.repeat(5);
}

const font = (f) => readFileSync(join(HERE, '../../public/fonts', f)).toString('base64');
export const fontFaces = () =>
  `@font-face { font-family: 'Cormorant Garamond'; font-weight: 300 700; src: url(data:font/woff2;base64,${font('cormorant-garamond.woff2')}) format('woff2'); }\n` +
  `@font-face { font-family: 'Golos Text'; font-weight: 400 900; src: url(data:font/woff2;base64,${font('golos-text.woff2')}) format('woff2'); }`;

// Largest heading size (mm, up to maxSize) at which `text` stays on one line within maxMm. Measured in the real font, so
// rewording the heading can't run into the arch frame (86 mm is the room between the frame lines at the heading's height).
export async function fitHeading(text, { maxMm = 86, maxSize = 9.8, weight = 500, tracking = 0.012 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(`<style>${fontFaces()} span { font: ${weight} ${maxSize}mm/1 'Cormorant Garamond', serif; letter-spacing: ${tracking}em; white-space: nowrap; position: absolute; }</style><span>${text}</span>`);
  await page.evaluate(() => document.fonts.ready);
  const mm = await page.evaluate(() => document.querySelector('span').getBoundingClientRect().width * 25.4 / 96);
  await browser.close();
  return Math.floor(maxSize * Math.min(1, maxMm / mm) * 10) / 10;
}

// sheets: [{ html, base }] → out/<base>.png (300 dpi) + out/<base>.pdf (vector, A5) + out/<base>.html
export async function renderAll(sheets) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  // 96 css-px/in × 3.125 = 300 dpi → A5 comes out as ~1748×2480 px
  const ctx = await browser.newContext({ viewport: { width: 560, height: 794 }, deviceScaleFactor: 3.125 });
  // pdfPx: give the PDF page in whole css px. Chrome rounds an mm page size up by a fraction of a px and leaves that last
  // sliver unpainted — a hairline of bare white along the bottom edge — which a sheet that must be all-colour can't have.
  for (const { html, base, size = [148, 210], pdfPx = false } of sheets) {
    const [wMm, hMm] = size;
    const vw = Math.ceil(wMm * 96 / 25.4), vh = Math.ceil(hMm * 96 / 25.4); // css px — A5 gives the old 560×794
    writeFileSync(join(OUT, `${base}.html`), html);
    const page = await ctx.newPage();
    await page.setViewportSize({ width: vw, height: vh });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const fontsOk = await page.evaluate(() => document.fonts.check('600 20px "Cormorant Garamond"') && document.fonts.check('400 20px "Golos Text"'));
    if (!fontsOk) throw new Error('brand fonts did not load — the sheet would silently fall back to a system font');
    // Chrome floors a fractional clip to whole css px (559×793 would clip 1–2 device px off the sheet); 560×794 takes
    // the whole sheet plus a sub-pixel strip that body/html paint in the page colour.
    await page.screenshot({ path: join(OUT, `${base}.png`), clip: { x: 0, y: 0, width: vw, height: vh } });
    await page.pdf({ path: join(OUT, `${base}.pdf`), width: pdfPx ? `${vw}px` : `${wMm}mm`, height: pdfPx ? `${vh}px` : `${hMm}mm`, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    await page.close();
    console.log('built', base);
  }
  await browser.close();
}
