/** User-confirmed Volnewmer tiers: lower price for doctors, upper for head doctor. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const policy = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/volnewmer-policy.json', import.meta.url), 'utf8'));
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
const matching = procedures.filter(p => p.slug === policy.slug);
if (matching.length !== 1) throw Error('Expected one Volnewmer procedure');
const before = await api('/items/price_items?limit=-1');
const rows = before.filter(row => row.procedure === matching[0].id);
if (rows.length !== policy.rows.length) throw Error('Unexpected Volnewmer row count');
const updates = [];
for (const expected of policy.rows) {
  const matches = rows.filter(row => row.name === expected.name);
  if (matches.length !== 1) throw Error(`Missing price: ${expected.name}`);
  const row = matches[0];
  if (row.price !== expected.price || row.price_head_doctor !== expected.price_head_doctor || ![null, expected.price_head_doctor].includes(row.price_max ?? null)) throw Error(`Unexpected current price: ${row.name}`);
  if (row.price_max != null) updates.push({ id: row.id, price_max: null });
}
console.log(JSON.stringify({ base, verified: rows.length, updates: updates.length }));
if (!process.argv.includes('--apply')) process.exit(0);
const backup = new URL(`./out/volnewmer-tiers/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
await writeFile(new URL('before.json', backup), JSON.stringify(before, null, 2));
if (updates.length) await api('/items/price_items', 'PATCH', updates);
const after = await api('/items/price_items?limit=-1');
if (after.length !== before.length) throw Error('Unexpected row count change');
for (const row of before) {
  const actual = after.find(r => r.id === row.id);
  const expected = { ...row, ...updates.find(update => update.id === row.id) };
  if (!actual || Object.entries(expected).some(([key,value]) => actual[key] !== value)) throw Error(`Unexpected change: ${row.id}`);
}
await writeFile(new URL('after.json', backup), JSON.stringify(after, null, 2));
console.log(`Verified all ${after.length} rows; backup: ${backup.pathname}`);
