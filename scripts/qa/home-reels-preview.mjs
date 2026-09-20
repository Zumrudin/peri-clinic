/** Package only the reviewed section and its assets, never CMS data or credentials. */
import { load } from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/qa/home-reels-preview.mjs <output-directory>');
mkdirSync(out, { recursive: true });
const $ = load(readFileSync('dist/index.html', 'utf8'));
const block = $('.approach').clone();
block.children().not('#approach-team, [data-home-reels]').remove();
block.removeAttr('id aria-labelledby');
block.find('script').remove();
const assets = new Set();
const asset = value => {
  if (!value?.startsWith('/_astro/') && !value?.startsWith('/media/specialists/') && !value?.startsWith('/media/reels/')) return value;
  assets.add(value.slice(1));
  return `./${value.slice(1)}`;
};
block.find('*').each((_, el) => {
  const node = $(el);
  for (const attribute of ['src', 'data-src', 'data-poster', 'href']) {
    const value = node.attr(attribute);
    if (!value) continue;
    const local = asset(value);
    node.attr(attribute, local === value && attribute === 'href' && value.startsWith('/') ? `https://www.peri-clinic.ru${value}` : local);
  }
  node.removeAttr('srcset');
});
const script = $('script[src*="Reels.astro"]').attr('src');
if (!script) throw new Error('Reels script not found');
const scriptPath = asset(script);
const css = $('style').map((_, el) => $(el).html()).get().join('\n').replaceAll('/fonts/', './fonts/');
for (const font of ['cormorant-garamond.woff2', 'cormorant-garamond-italic.woff2', 'golos-text.woff2']) assets.add(`fonts/${font}`);
for (const file of assets) {
  const target = join(out, file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join('dist', file), target);
}
writeFileSync(join(out, 'section.html'), `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>PERI — мобильная видеолента</title><style>${css}</style></head><body class="page--home"><main id="home-page">${$.html(block)}</main><script type="module" src="${scriptPath}"></script></body></html>`);
copyFileSync(join(out, 'section.html'), join(out, 'index.html'));
console.log(`Preview packaged in ${out}; ${assets.size} assets.`);
