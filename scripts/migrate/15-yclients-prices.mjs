/** Reviewed YCLIENTS snapshot. Dry-run by default; --apply backs up before writing.
 * Matches procedure slug + row name, never assumes IDs are shared by dev and prod.
 * ADMIN_EMAIL / ADMIN_PASSWORD and DIRECTUS_URL must refer to the target instance.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { collections } from '../../directus/setup/collections.mjs';

const plan = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/plan.json', import.meta.url), 'utf8'));
const refinement = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/refinement.json', import.meta.url), 'utf8'));
const mensPolicy = JSON.parse(await readFile(new URL('../../docs/pricing/2026-09-19/mens-policy.json', import.meta.url), 'utf8'));
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
const procedures = await api('/items/procedures?limit=-1&fields=id,slug');
const before = await api('/items/price_items?limit=-1');
const procedureId = slug => {
  if (slug === null) return null;
  const p = procedures.filter(p => p.slug === slug);
  if (p.length !== 1) throw Error(`Missing or ambiguous procedure: ${slug}`);
  return p[0].id;
};
const equal = (a, b) => (a ?? null) === (b ?? null);
const updates = [];
for (const u of plan.updates) {
  // Later user-approved notes are applied by migration 17, not the original export.
  if (mensPolicy.notes.some(rule => rule.slug === u.match.slug && rule.name === u.match.name)) continue;
  const candidates = before.filter(r => r.procedure === procedureId(u.match.slug) && [u.match.name, u.values.name].includes(r.name));
  if (candidates.length !== 1) throw Error(`Ambiguous update: ${u.match.name}`);
  const row = candidates[0];
  for (const [key, value] of Object.entries(u.values)) {
    if (!equal(row[key], u.before[key]) && !equal(row[key], value)) throw Error(`Concurrent change: ${row.name} / ${key}`);
  }
  if (Object.entries(u.values).some(([k, v]) => !equal(row[k], v))) updates.push({ id: row.id, ...u.values });
}
const additions = [];
for (const a of plan.additions) {
  if ([...refinement.removed_source_indices, ...mensPolicy.removed_source_indices].includes(a.source_index)) continue;
  const { procedure_slug, ...values } = a.values;
  Object.assign(values, refinement.groups[values.price_group] ?? {});
  values.procedure = procedureId(procedure_slug);
  const matches = before.filter(r => r.procedure === values.procedure && equal(r.price_group, values.price_group) && r.name === values.name);
  if (matches.length > 1) throw Error(`Duplicate: ${values.name}`);
  if (matches.length && Object.entries(values).some(([k, v]) => !equal(matches[0][k], v))) throw Error(`Conflicting existing row: ${values.name}`);
  if (!matches.length) additions.push(values);
}
console.log(JSON.stringify({ base, updates: updates.length, additions: additions.length, deletions: 0 }));
if (!process.argv.includes('--apply')) process.exit(0);
const backup = new URL(`./out/yclients-prices/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
await writeFile(new URL('before.json', backup), JSON.stringify({ base, fields, procedures, items: before }, null, 2));
const schema = collections.find(c => c.collection === 'price_items').fields;
for (const name of ['price_max', 'price_group', 'price_group_category', 'price_group_sort']) {
  if (!fields.some(f => f.field === name)) await api('/fields/price_items', 'POST', schema.find(f => f.field === name));
}
const relation = fields.find(f => f.field === 'procedure');
if (relation.meta?.required || !relation.schema?.is_nullable) {
  await api('/fields/price_items/procedure', 'PATCH', { meta: { required: false }, schema: { is_nullable: true } });
}
// Re-read immediately before mutation so an editor's intervening changes are not lost.
const fresh = await api('/items/price_items?limit=-1');
for (const row of before) {
  const current = fresh.find(r => r.id === row.id);
  if (!current || Object.entries(row).some(([k, v]) => !equal(current[k], v))) throw Error('Content changed since backup');
}
if (fresh.length !== before.length) throw Error('Content changed since backup');
if (updates.length) await api('/items/price_items', 'PATCH', updates);
const created = additions.length ? await api('/items/price_items', 'POST', additions) : [];
const after = await api('/items/price_items?limit=-1');
if (after.length !== before.length + additions.length) throw Error('Unexpected final row count');
for (const old of before) {
  const expected = { ...old, ...updates.find(u => u.id === old.id) };
  const actual = after.find(r => r.id === old.id);
  if (!actual || Object.entries(expected).some(([k, v]) => !equal(actual[k], v))) throw Error(`Verification failed: ${old.id}`);
}
for (const values of additions) {
  if (!after.some(row => Object.entries(values).every(([k, v]) => equal(row[k], v)))) throw Error(`Missing addition: ${values.name}`);
}
await writeFile(new URL('after.json', backup), JSON.stringify({ items: after, created, updates }, null, 2));
console.log(`Verified ${after.length} price rows; backup: ${backup.pathname}`);
