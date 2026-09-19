/** Apply the user-requested regrouping and six removals. Dry-run unless --apply. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { collections } from '../../directus/setup/collections.mjs';

const plan = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/plan.json', import.meta.url), 'utf8'));
const refinement = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/refinement.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
if (!login.ok) throw Error(`Login HTTP ${login.status}`);
const token = (await login.json()).data.access_token;
async function api(path, method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw Error(`${method} ${path}: HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : (await res.json()).data;
}
const fields = await api('/fields/price_items');
const before = await api('/items/price_items?limit=-1');
const removed = plan.additions.filter(a => refinement.removed_source_indices.includes(a.source_index));
const deletions = before.filter(row => removed.some(a => row.procedure === null && row.price_group === a.values.price_group && row.name === a.values.name));
if (deletions.length !== 0 && deletions.length !== removed.length) throw Error('Partial removal set; review current data');
const updates = before.filter(row => !deletions.some(d => d.id === row.id) && row.procedure === null && refinement.groups[row.price_group]).map(row => ({ id: row.id, ...refinement.groups[row.price_group] })).filter(update => Object.entries(update).some(([key, value]) => before.find(row => row.id === update.id)[key] !== value));
console.log(JSON.stringify({ base, updates: updates.length, deletions: deletions.map(row => row.name) }));
if (!process.argv.includes('--apply')) process.exit(0);
const backup = new URL(`./out/pricing-groups/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
await writeFile(new URL('before.json', backup), JSON.stringify({ fields, items: before }, null, 2));
for (const field of ['price_group_category', 'price_group_sort']) {
  if (!fields.some(f => f.field === field)) await api('/fields/price_items', 'POST', collections.find(c => c.collection === 'price_items').fields.find(f => f.field === field));
}
if (updates.length) await api('/items/price_items', 'PATCH', updates);
if (deletions.length) await api('/items/price_items', 'DELETE', deletions.map(row => row.id));
const after = await api('/items/price_items?limit=-1');
if (after.length !== before.length - deletions.length) throw Error('Unexpected final count');
for (const row of before) {
  const actual = after.find(r => r.id === row.id);
  if (deletions.some(d => d.id === row.id)) { if (actual) throw Error('Deleted row remains'); continue; }
  const expected = { ...row, ...updates.find(u => u.id === row.id) };
  if (!actual || Object.entries(expected).some(([k,v]) => actual[k] !== v)) throw Error(`Unexpected change: ${row.id}`);
}
await writeFile(new URL('after.json', backup), JSON.stringify(after, null, 2));
console.log(`Verified ${after.length} rows; backup: ${backup.pathname}`);
