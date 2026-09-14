/** Reviewed service copy. Dry run by default; --apply backs up and updates CMS text only.
 * node --env-file=.env.claude scripts/migrate/08-editorial.mjs [--apply]
 * Expected field values protect subsequent editorial changes from an accidental rerun.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'cheerio';

const { updates } = JSON.parse(await readFile(new URL('./editorial-content.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_TOKEN;
if (!base || !token) throw new Error('DIRECTUS_URL and DIRECTUS_TOKEN are required');
const allowed = {
  procedures: ['title', 'lead', 'summary', 'body', 'indications', 'contraindications'],
  service_categories: ['description'], faq_items: ['question', 'answer'], devices: ['name'],
};
async function request(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}
const records = {};
for (const collection of Object.keys(allowed)) records[collection] = await request(`/items/${collection}?limit=-1`);
const pending = [];
for (const { collection, key, before, data } of updates) {
  if (!allowed[collection]) throw new Error(`Unexpected collection: ${collection}`);
  const matches = records[collection].filter(row => Object.entries(key).every(([k, v]) => row[k] === v));
  if (matches.length !== 1) throw new Error(`Expected one record: ${collection} ${JSON.stringify(key)}`);
  const previous = matches[0];
  const patch = {};
  for (const [field, value] of Object.entries(data)) {
    if (!allowed[collection].includes(field) || typeof value !== 'string' || !value.trim()) throw new Error(`Invalid field: ${collection}.${field}`);
    if (/[\u200B-\u200D\uFEFF]|Подписывайтесь|5–15 лет|безупречн|усиление работы лимфатическ/i.test(value)) throw new Error(`Unreviewed copy: ${collection}.${field}`);
    const $ = load(value, null, false);
    if ($('*').toArray().some(el => !['p', 'h3', 'ul', 'li'].includes(el.tagName) || Object.keys(el.attribs).length)) throw new Error(`Unexpected markup: ${collection}.${field}`);
    if (isDeepStrictEqual(previous[field], value)) continue;
    if (!isDeepStrictEqual(previous[field], before[field])) throw new Error(`CMS changed since review: ${collection}/${previous.id}.${field}`);
    patch[field] = value;
  }
  if (Object.keys(patch).length) pending.push({ collection, previous, patch });
}
for (const { collection, previous, patch } of pending) console.log(`UPDATE ${collection}/${previous.slug || previous.id}: ${Object.keys(patch).join(', ')}`);
console.log(`${pending.length} records ${process.argv.includes('--apply') ? 'to apply' : '(dry run)'}`);
if (!process.argv.includes('--apply') || !pending.length) process.exit(0);
const backupDir = new URL('./out/editorial-backups/', import.meta.url);
await mkdir(backupDir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, backupDir), JSON.stringify(pending, null, 2), { mode: 0o600 });
for (const { collection, previous, patch } of pending) {
  const path = `/items/${collection}/${previous.id}`;
  const current = await request(path);
  for (const field of Object.keys(patch)) {
    if (!isDeepStrictEqual(current[field], previous[field])) throw new Error(`CMS changed before write: ${path}.${field}`);
  }
  await request(path, 'PATCH', patch);
  const saved = await request(path);
  if (!Object.entries(patch).every(([field, value]) => isDeepStrictEqual(saved[field], value))) throw new Error(`Verification failed: ${path}`);
  console.log(`Saved and verified ${collection}/${previous.slug || previous.id}`);
}
