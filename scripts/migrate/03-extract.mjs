/**
 * Parses raw HTML (scripts/migrate/raw/*.html) into structured JSON matching Directus
 * field names, one file per manifest entry in scripts/migrate/out/<slug>.json.
 *
 * Procedure-page heuristic (confirmed by hand against /volnewmer, see the phase-4 plan):
 * walk the combined content stream (richTextElement headings/paragraphs interleaved with
 * collapsible-text long-form answers) in document order, split into sections at known
 * heading phrases, classify each section by which phrase matched. Anything between the
 * intro and the first known heading is the lead paragraph(s); anything after the last
 * known section and before the footer chrome is appended to `body`.
 *
 * Run: node scripts/migrate/03-extract.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import {
  loadHtml,
  walkContentStream,
  findFooterStart,
  collectImageUrls,
  wixOriginalUrl,
  sanitizeHtml,
  cleanText,
  ensureDir,
  RAW_DIR,
  OUT_DIR,
} from './lib.mjs';

const SECTION_MARKERS = [
  { key: 'steps', re: /^Как проходит процедура/i },
  { key: 'cases', re: /^До\s*\/\s*после/i },
  { key: 'faq', re: /^Важно знать/i },
  { key: 'indications', re: /^Показания/i },
  { key: 'contraindications', re: /^Противопоказания/i },
  { key: 'device', re: /^Про оборудование/i },
];
function matchSection(text) {
  for (const m of SECTION_MARKERS) if (m.re.test(text)) return m.key;
  return null;
}

// Wix renders the header logo wordmark as two plain richTextElements ("КЛИНИКА" /
// "ЭСТЕТИЧЕСКОЙ МЕДИЦИНЫ") ahead of every page's real content — skip them by exact text,
// not length, since real headings/leads can be short too.
const CHROME_LINES_RE = /^(КЛИНИКА|ЭСТЕТИЧЕСКОЙ МЕДИЦИНЫ)$/i;
// The site-wide logo file — appears as an <img> on every page, must not end up as a
// procedure's "cover image".
const LOGO_HASH = '0d054c_32a9d66bca9d4636976cfa19e78471bc';

/** Procedure page: title + lead, then steps/faq/indications/contraindications/device, rest → body. */
function extractProcedure($, slug) {
  const items = walkContentStream($);
  const footerAt = findFooterStart(items);
  const stream = items.slice(0, footerAt);

  let start = 0;
  while (start < stream.length && CHROME_LINES_RE.test(stream[start].text)) start++;

  const title = stream[start]?.text ?? slug;
  let i = start + 1;
  // Only the single paragraph right after the title is the "lead" — any further
  // marketing headings/paragraphs before the first known section go to `body` instead,
  // so `lead` stays a short intro rather than absorbing the whole page opening.
  const lead = !matchSection(stream[i]?.text ?? '') ? (stream[i++]?.text ?? '') : '';
  const bodyParts = [];
  while (i < stream.length && !matchSection(stream[i].text)) {
    bodyParts.push(`<p>${stream[i].text}</p>`);
    i++;
  }

  const steps = [];
  const faq = [];
  let indications = '';
  let contraindications = '';
  let currentSection = null;

  while (i < stream.length) {
    const item = stream[i];
    const section = matchSection(item.text);
    if (section) {
      currentSection = section;
      if (section === 'steps' || section === 'cases') {
        i++;
        continue;
      }
      if (section === 'faq') {
        i++;
        continue;
      }
      if (section === 'indications' || section === 'contraindications' || section === 'device') {
        const next = stream[i + 1];
        const text = next && !matchSection(next.text) ? next.text : '';
        if (section === 'indications') indications = text;
        else if (section === 'contraindications') contraindications = text;
        else bodyParts.push(`<h3>Про оборудование</h3><p>${text}</p>`);
        i += next ? 2 : 1;
        continue;
      }
    }

    if (currentSection === 'steps') {
      const heading = item.text;
      const next = stream[i + 1];
      if (next && !matchSection(next.text)) {
        steps.push({ title: heading, text: next.text });
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (currentSection === 'cases') {
      // Inline before/after blurbs on the procedure page itself are skipped — /result is
      // the single source of truth for before/after cases (see phase-4 plan).
      i++;
      continue;
    }

    if (currentSection === 'faq') {
      const question = item.text;
      const next = stream[i + 1];
      if (next && !matchSection(next.text) && /\?\s*$/.test(question)) {
        faq.push({ question, answer: next.text });
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    // Unmatched content after a known section (or before any section, rare) → body.
    bodyParts.push(`<p>${item.text}</p>`);
    i++;
  }

  const images = collectImageUrls($, 'body').filter((u) => !u.includes(LOGO_HASH));
  const coverImage = images[0] ?? null;

  return {
    kind: 'procedure',
    slug,
    title: cleanText(title),
    lead: cleanText(lead),
    body: sanitizeHtml(bodyParts.join('')),
    steps,
    faq,
    indications: sanitizeHtml(`<p>${indications}</p>`),
    contraindications: sanitizeHtml(`<p>${contraindications}</p>`),
    cover_image: coverImage,
    gallery_images: images.slice(0, 12),
  };
}

/** Category page: intro paragraph + ordered procedure cards (title, tagline, href). */
function extractCategory($, slug) {
  const items = walkContentStream($);
  const introIdx = items.findIndex((it) => /сертифицирован/i.test(it.text));
  const intro = introIdx !== -1 ? items[introIdx].text : '';

  // The card's own visible text is just the "Подробнее" button — titles/taglines live on
  // each procedure's own page (already extracted by extractProcedure). All this needs is
  // the *order* of procedure links, filtered down from the nav/footer links every page
  // repeats (categories, legal pages, the shop, socials).
  const NON_PROCEDURE_SLUGS = new Set([
    'result', 'uslugi-i-ceny', 'kontakty', 'apparatnaya-kosmetologiya', 'injekcionnaya-cosmetologiya',
    'esteticheskaya-kosmetologiya', 'spravka', 'loyaltyprogram', 'yuridicheskaya-informaciya',
    'uridicheskaya-informaciya', 'politika', 'polzovatelskoe-soglashenie', 'soglashenie',
  ]);
  const procedureSlugs = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = /peri-clinic\.ru\/([a-z0-9-]+)$/i.exec(href);
    if (!m) return;
    const cardSlug = m[1];
    if (NON_PROCEDURE_SLUGS.has(cardSlug) || procedureSlugs.includes(cardSlug)) return;
    procedureSlugs.push(cardSlug);
  });

  return { kind: 'category', slug, intro: cleanText(intro), procedureSlugs };
}

/** Legal/info page: title + everything else, in order, as sanitized body HTML. */
function extractLegalPage($, slug) {
  const items = walkContentStream($);
  const footerAt = findFooterStart(items);
  const stream = items.slice(0, footerAt);
  let start = 0;
  while (start < stream.length && CHROME_LINES_RE.test(stream[start].text)) start++;
  const title = stream[start]?.text ?? slug;
  const body = stream
    .slice(start + 1)
    .map((it) => `<p>${it.text}</p>`)
    .join('');
  return { kind: 'legal_page', slug, title: cleanText(title), body: sanitizeHtml(body) };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
  await ensureDir(OUT_DIR);

  let count = 0;
  for (const entry of manifest) {
    if (entry.type === 'redirect' || entry.type === 'home') continue;
    const html = await readFile(new URL(`./${entry.slug}.html`, RAW_DIR), 'utf8');
    const $ = loadHtml(html);

    let extracted;
    if (entry.type === 'procedure') extracted = extractProcedure($, entry.slug);
    else if (entry.type === 'category') extracted = extractCategory($, entry.slug);
    else if (entry.type === 'legal_page') extracted = { ...extractLegalPage($, entry.slug), template: entry.template };
    else if (entry.type === 'results' || entry.type === 'services_overview') {
      // Handled by their own dedicated logic once phase 5 templates need them; for now
      // just confirm the raw HTML is there and move on (no structured extraction yet).
      extracted = { kind: entry.type, slug: entry.slug, note: 'Экстракция для этого типа страницы будет добавлена в фазе 5 вместе с шаблоном.' };
    } else {
      continue;
    }

    await writeFile(new URL(`./${entry.slug}.json`, OUT_DIR), JSON.stringify(extracted, null, 2));
    count++;
  }
  console.log(`extracted: ${count} pages → scripts/migrate/out/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
