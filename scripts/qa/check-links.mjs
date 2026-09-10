import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../../dist/', import.meta.url).pathname;
const files = readdirSync(DIST).filter((f) => f.endsWith('.html'));

const knownPaths = new Set(files.map((f) => '/' + f.replace(/\.html$/, '').replace(/^index$/, '')));
knownPaths.add('/');

const hrefRe = /href="([^"]+)"/g;
const broken = [];
const external = new Set();

for (const f of files) {
  const html = readFileSync(join(DIST, f), 'utf8');
  let m;
  while ((m = hrefRe.exec(html))) {
    let href = m[1];
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('//')) {
      external.add(href);
      continue;
    }
    if (href.startsWith('#')) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (clean === '/sitemap.xml') {
      if (!existsSync(join(DIST, 'sitemap.xml'))) broken.push({ file: f, href });
      continue;
    }
    const normalized = clean.replace(/\/$/, '') || '/';
    if (knownPaths.has(normalized)) continue;
    if (existsSync(join(DIST, clean))) continue;
    broken.push({ file: f, href });
  }
}

console.log(`Checked ${files.length} pages, ${knownPaths.size} known internal paths.`);
if (broken.length) {
  console.log('BROKEN internal links:');
  for (const b of broken) console.log(`  ${b.file} -> ${b.href}`);
} else {
  console.log('No broken internal links found.');
}
console.log(`\n${external.size} distinct external links (not checked over network).`);
