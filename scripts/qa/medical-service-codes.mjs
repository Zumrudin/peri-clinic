/** Check every public price row against the reviewed register, including exclusions.
 * node scripts/qa/medical-service-codes.mjs dist|https://host
 */
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
const target = process.argv[2] || 'dist';
const review = JSON.parse(await readFile(new URL('../../docs/medical-codes/2026-09-18/service-codes.json', import.meta.url), 'utf8'));
const rows = review.rows.filter(r => r.scope === 'Актуальный прайс Directus');
const normalize = s => s.replace(/\s+/g, ' ').trim();
async function html(slug) {
  if (!target.startsWith('http')) return readFile(`${target}/${slug}.html`, 'utf8');
  const res = await fetch(`${target}/${slug}`);
  if (!res.ok) throw Error(`${slug}: HTTP ${res.status}`);
  return res.text();
}
function verify(markup, expected, page) {
  const $ = load(markup);
  let coded = 0;
  for (const row of expected) {
    const table = $('table').filter((_, el) => $(el).attr('aria-label') === `Стоимость: ${row.service}`);
    const matches = table.find('tbody tr').filter((_, el) => {
      const name = $(el).find('td').first().clone();
      name.find('span').remove();
      return normalize(name.text()) === normalize(row.item);
    });
    if (matches.length !== 1) throw Error(`${page}: expected unique row ${row.slug}/${row.item}, got ${matches.length}`);
    const label = matches.find('.price-table__service-code');
    if (!row.code) {
      if (label.length) throw Error(`${page}: unapproved code on ${row.item}`);
    } else {
      if (label.length !== 1 || normalize(label.text()) !== `Код медицинской услуги: ${row.code}` || label.attr('title') !== review.codebook[row.code].name) throw Error(`${page}: wrong code or name on ${row.item}`);
      coded++;
    }
  }
  if ($('.price-table__service-code').length !== coded) throw Error(`${page}: extra codes`);
  if ($('.price-table__icd').text().match(/[AB]\d{2}\.\d{2,3}\.\d{3}/)) throw Error(`${page}: service code mislabeled as ICD`);
  return coded;
}
const count = verify(await html('uslugi-i-ceny'), rows, 'uslugi-i-ceny');
for (const slug of new Set(rows.map(r => r.slug))) verify(await html(slug), rows.filter(r => r.slug === slug), slug);
console.log(`${target}: verified all ${rows.length} price rows and 19 procedure pages; ${count} approved codes, no codes on excluded rows.`);
