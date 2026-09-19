/** Replace explicit male tariffs with the user-approved +30% notes. Backup before --apply. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const plan = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/plan.json', import.meta.url), 'utf8'));
const policy = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/mens-policy.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
if (!login.ok) throw Error(`Login HTTP ${login.status}`);
const token = (await login.json()).data.access_token;
async function api(path, method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw Error(`${method} ${path}: HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : (await res.json()).data;
}
const procedures = await api('/items/procedures?limit=-1&fields=id,slug');
const before = await api('/items/price_items?limit=-1');
function procedureId(slug) {
  const matches = procedures.filter(row => row.slug === slug);
  if (matches.length !== 1) throw Error(`Missing procedure: ${slug}`);
  return matches[0].id;
}
const removed = plan.additions.filter(row => policy.removed_source_indices.includes(row.source_index));
if (removed.length !== 19) throw Error('Unexpected removal plan');
const deletions = before.filter(row => removed.some(a => row.procedure === procedureId(a.values.procedure_slug) && row.name === a.values.name));
if (deletions.length !== 0 && deletions.length !== removed.length) throw Error('Partial removal set');
const updates = policy.notes.map(rule => {
  const matches = before.filter(row => row.procedure === procedureId(rule.slug) && row.name === rule.name);
  if (matches.length !== 1) throw Error(`Expected one note row: ${rule.name}`);
  return { id: matches[0].id, price: null, price_head_doctor: null, price_max: null, note: rule.note };
}).filter(update => Object.entries(update).some(([key,value]) => (before.find(row => row.id === update.id)[key] ?? null) !== value));
console.log(JSON.stringify({ base, deletions: deletions.map(row => row.name), updates: updates.length }));
if (!process.argv.includes('--apply')) process.exit(0);
const backup = new URL(`./out/mens-pricing/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
await writeFile(new URL('before.json', backup), JSON.stringify(before, null, 2));
if (updates.length) await api('/items/price_items', 'PATCH', updates);
if (deletions.length) await api('/items/price_items', 'DELETE', deletions.map(row => row.id));
const after = await api('/items/price_items?limit=-1');
if (after.length !== before.length - deletions.length) throw Error('Unexpected final row count');
for (const row of before) {
  const actual = after.find(r => r.id === row.id);
  if (deletions.some(d => d.id === row.id)) { if (actual) throw Error('Deleted row remains'); continue; }
  const expected = { ...row, ...updates.find(update => update.id === row.id) };
  if (!actual || Object.entries(expected).some(([key,value]) => actual[key] !== value)) throw Error(`Unexpected change: ${row.id}`);
}
await writeFile(new URL('after.json', backup), JSON.stringify(after, null, 2));
console.log(`Verified ${after.length} rows; backup: ${backup.pathname}`);
