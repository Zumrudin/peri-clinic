/**
 * Shared helpers for the Wix → Directus migration scripts (scripts/migrate/01-05).
 * Findings that shaped this file (see docs/superpowers/specs and the phase-4 plan):
 *   - Wix renders every heading as a literal <h1> — tag name is useless for structure;
 *     classification must be done by matching known Russian heading phrases.
 *   - Long-form sections (Показания/Противопоказания/"Почему X?" etc.) live in a
 *     "collapsible text" widget (`data-testid="ellipsis_text_viewer_text_wrapper"`),
 *     NOT inside the `richTextElement` div that holds their heading. Both selectors
 *     have to be combined and walked in document order together.
 */
import { load } from 'cheerio';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// Directory URLs (not path strings) so callers can do `new URL('./file.html', RAW_DIR)`.
export const RAW_DIR = new URL('./raw/', import.meta.url);
export const OUT_DIR = new URL('./out/', import.meta.url);
export const MEDIA_DIR = new URL('./media/', import.meta.url);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

/** Wix serves complete SSR HTML — no headless browser needed. */
export async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9' } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

export function loadHtml(html) {
  return load(html);
}

export const cleanText = (s) => (s || '').replace(/\s+/g, ' ').replace(/ /g, ' ').trim();

/**
 * Walks the two content-bearing widget types in document order and returns
 * `[{ kind: 'heading'|'text', text }]`. `kind` is a light hint, not authoritative —
 * callers classify by matched phrase, not by kind, since a heading-styled RTE and a
 * plain paragraph RTE are visually different but structurally identical (<h1>/<p>
 * with no reliable distinguishing attribute across pages).
 */
export function walkContentStream($) {
  const items = [];
  $('[data-testid="richTextElement"], [data-testid="ellipsis_text_viewer_text_wrapper"]').each((_, el) => {
    const $el = $(el);
    const text = cleanText($el.text());
    if (!text) return;
    const kind = $el.attr('data-testid') === 'richTextElement' ? 'rte' : 'collapsible';
    items.push({ kind, text, html: $el.html() });
  });
  return items;
}

/** First stream index whose text matches any of the footer/nav chrome markers. */
export function findFooterStart(items, fromIndex = 0) {
  const markers = [/^Клиентам$/i, /^Наши услуги$/i, /^Соц\.?\s*Сети$/i, /^Контакты$/i];
  for (let i = fromIndex; i < items.length; i++) {
    if (markers.some((re) => re.test(items[i].text))) return i;
  }
  return items.length;
}

/**
 * Rewrites a Wix CDN thumbnail/transform URL to the full-resolution original:
 * `.../media/<uri>/v1/fill/w_700,h_900,.../name.jpg` → `.../media/<uri>`.
 */
export function wixOriginalUrl(src) {
  if (!src) return null;
  const m = /static\.wixstatic\.com\/media\/([^/]+)/.exec(src);
  if (!m) return src;
  return `https://static.wixstatic.com/media/${m[1]}`;
}

/** Collects every distinct original image URL referenced in a cheerio-loaded page. */
export function collectImageUrls($, scope = 'body') {
  const urls = new Set();
  $(scope)
    .find('img')
    .each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src') || $el.attr('data-src');
      const original = wixOriginalUrl(src);
      if (original && original.includes('static.wixstatic.com')) urls.add(original);
    });
  return [...urls];
}

/** Minimal HTML sanitizer for extracted body copy: strip everything except a safe allow-list. */
export function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?!\/?(p|ul|ol|li|strong|em|b|i|br|h3)(\s|>|\/))[^>]+>/gi, '')
    .replace(/\s(class|style|data-[\w-]+|id)="[^"]*"/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .trim();
}
