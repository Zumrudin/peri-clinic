/** Audit every built HTML page, including nested specialist routes. Run after astro build. */
import { globSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { load } from 'cheerio';
const root = resolve(process.argv[2] || 'dist');
const out = process.argv[3] || 'output/seo';
const clean = s => s.replace(/\s+/g, ' ').trim();
const pathOf = f => '/' + relative(root, f).replace(/index\.html$/, '').replace(/\.html$/, '');
const pages = new Map(globSync(`${root}/**/*.html`).map(f => [pathOf(f), { f, $: load(readFileSync(f, 'utf8')) }]));
const errors = [], warnings = [], rows = [];
const fail = (path, issue) => errors.push({ path, issue });
const warn = (path, issue) => warnings.push({ path, issue });
const origins = new Set();
for (const [path, { $ }] of pages) {
  const title = clean($('title').text()), description = clean($('meta[name="description"]').attr('content') || '');
  const canonical = $('link[rel="canonical"]').attr('href');
  const noindex = /noindex/.test($('meta[name="robots"]').attr('content') || '');
  const main = $('main').clone();
  main.find('script, style, dialog, [hidden]').remove();
  main.find('p, div, li, h1, h2, h3, a, span, br, td, th').append(' ');
  const text = clean(main.text());
  if (!title || $('title').length !== 1) fail(path, 'Missing/duplicate title');
  if (!description) fail(path, 'Missing description');
  if ($('h1').length !== 1) fail(path, `Expected one H1: ${$('h1').length}`);
  if (!canonical || $('link[rel="canonical"]').length !== 1) fail(path, 'Missing/duplicate canonical');
  else { const u = new URL(canonical); origins.add(u.origin); if (u.pathname !== path || u.search || u.hash) fail(path, 'Non-self canonical'); }
  if ($('html').attr('lang') !== 'ru') fail(path, 'Missing Russian document language');
  if (/демонстрационная страница|undefined|\[object Object\]/i.test(title + description)) fail(path, 'Placeholder metadata');
  if (!noindex && text.length < 120) warn(path, 'Very little main content; review manually');
  $('script[type="application/ld+json"]').each((i,e) => { try { JSON.parse($(e).text()); } catch { fail(path, 'Invalid JSON-LD'); } });
  $('img').each((i,e) => { if ($(e).attr('alt') === undefined) fail(path, 'Image missing alt attribute'); });
  const links = [];
  $('a[href], img[src], source[src], video[src], video[poster], meta[property="og:image"]').each((i,e) => {
    const raw = $(e).attr('href') || $(e).attr('src') || $(e).attr('poster') || $(e).attr('content');
    if (!raw || /^(tel:|mailto:|data:|javascript:)/.test(raw)) return;
    const u = new URL(raw, canonical || 'https://www.peri-clinic.ru' + path);
    if (canonical && u.origin !== new URL(canonical).origin) return;
    const dest = decodeURIComponent(u.pathname), page = pages.get(dest);
    if (!page && !existsSync(resolve(root, '.' + dest))) fail(path, `Broken resource/link: ${raw}`);
    if (page && $(e).is('a')) {
      links.push(dest);
      if (u.hash && !page.$('[id]').toArray().some(el => page.$(el).attr('id') === decodeURIComponent(u.hash.slice(1)))) fail(path, `Missing fragment: ${raw}`);
    }
  });
  rows.push({ path, title, description, h1: clean($('h1').text()), canonical, noindex, words: text.split(/\s+/).length, images: $('img').length, links: [...new Set(links)], text });
}
if (origins.size !== 1) fail('/', 'Inconsistent canonical origins');
for (const key of ['title', 'description']) {
  const seen = new Map();
  for (const row of rows.filter(p => !p.noindex)) { if (seen.has(row[key])) fail(row.path, `Duplicate ${key}: ${seen.get(row[key])}`); seen.set(row[key], row.path); }
}
const xml = load(readFileSync(resolve(root, 'sitemap.xml'), 'utf8'), { xmlMode: true });
const urls = xml('url > loc').map((i,e) => xml(e).text()).get();
if (urls.length !== new Set(urls).size) fail('/sitemap.xml', 'Duplicate URLs');
for (const url of urls) { const row = rows.find(p => p.canonical === url); if (!row || row.noindex) fail('/sitemap.xml', `Non-indexable or missing URL: ${url}`); }
for (const row of rows) if (!row.noindex && !urls.includes(row.canonical)) fail(row.path, 'Absent from sitemap');
const reached = new Set(['/']);
for (let size = -1; size !== reached.size;) { size = reached.size; for (const row of rows) if (reached.has(row.path)) for (const link of row.links) reached.add(link); }
for (const row of rows) if (!row.noindex && !reached.has(row.path)) fail(row.path, 'Unreachable from homepage links');
const robots = readFileSync(resolve(root, 'robots.txt'), 'utf8');
if (/Disallow:\s*\/\s*$/m.test(robots)) fail('/robots.txt', 'Blocks whole site');
if (!robots.includes(`Sitemap: ${[...origins][0]}/sitemap.xml`)) fail('/robots.txt', 'Wrong sitemap origin');
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/audit.json`, JSON.stringify({ pages: rows, errors, warnings }, null, 2));
writeFileSync(`${out}/pages.md`, '| URL | Title | Description | H1 | Words | Indexable |\n|---|---|---|---|---:|---|\n' + rows.map(p => `| ${p.path} | ${p.title.replaceAll('|','\\|')} | ${p.description} | ${p.h1} | ${p.words} | ${!p.noindex} |`).join('\n') + '\n');
console.log(JSON.stringify({ pages: rows.length, sitemap: urls.length, errors, warnings }, null, 2));
process.exitCode = errors.length ? 1 : 0;
