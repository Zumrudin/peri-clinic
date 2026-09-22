/** Import a normalized export; repeat runs preserve editorial decisions and text. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { get, post } from '../../directus/setup/lib.mjs';

export function normalize(rows) {
  if (!Array.isArray(rows)) throw new Error('Expected a JSON array');
  const seen = new Set();
  return rows.map((r, index) => {
    const fail = () => { throw new Error(`Invalid review at row ${index + 1}`); };
    if (!r || typeof r.id !== 'string' || !r.id.trim() || r.id.length > 200 ||
        typeof r.author_name !== 'string' || !r.author_name.trim() || r.author_name.length > 255 ||
        typeof r.text !== 'string' || !r.text.trim() ||
        !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) fail();
    let url;
    try { url = new URL(r.source_url); } catch { fail(); }
    if (url.protocol !== 'https:' || url.username || url.password ||
        !['yandex.ru', 'yandex.com', 'www.yandex.ru', 'www.yandex.com'].includes(url.hostname) ||
        !url.pathname.startsWith('/maps/')) fail();
    if (r.date != null && (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0, 10) !== r.date)) fail();
    const external_id = `yandex:${r.id.trim()}`;
    if (seen.has(external_id)) throw new Error(`Duplicate review at row ${index + 1}`);
    seen.add(external_id);
    return { external_id, source: 'yandex', source_url: url.href,
      author_name: r.author_name.trim(), text: r.text.trim(), rating: r.rating,
      date: r.date ?? null, status: 'draft', show_on_home: false };
  });
}

export async function importReviews(rows, client = { get, post }) {
  const records = normalize(rows); // Validate the complete export before writing anything.
  const existing = await client.get('/items/reviews?fields=external_id,source_url&limit=-1');
  const ids = new Set(existing.map(r => r.external_id).filter(Boolean));
  // Widget rows share the organization URL; only individual permalinks identify a review.
  const permalink = value => {
    try { return new URL(value).searchParams.has('reviewId') ? value : null; } catch { return null; }
  };
  const urls = new Set(existing.map(r => permalink(r.source_url)).filter(Boolean));
  let created = 0;
  for (const record of records) {
    if (ids.has(record.external_id) || urls.has(permalink(record.source_url))) continue;
    await client.post('/items/reviews', record);
    ids.add(record.external_id);
    if (permalink(record.source_url)) urls.add(record.source_url);
    created++;
  }
  return { created, skipped: records.length - created };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node scripts/reviews/import.mjs export.json [--apply]');
  const rows = JSON.parse(await readFile(file, 'utf8'));
  const records = normalize(rows);
  console.log(process.argv.includes('--apply') ? await importReviews(rows) : { validated: records.length, dryRun: true });
}
