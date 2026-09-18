/** Apply only the reviewed, non-conditional service codes, matching by slug + name.
 * Run with ADMIN_EMAIL/ADMIN_PASSWORD from the target Directus environment.
 * Defaults to dry-run; --apply creates two nullable fields and updates reviewed rows.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const review = JSON.parse(await readFile(new URL('../../docs/medical-codes/2026-09-18/service-codes.json', import.meta.url), 'utf8'));
const approved = review.rows.filter(r => r.scope === 'Актуальный прайс Directus' && r.status === 'Соответствует описанному вмешательству' && r.code);
if (approved.length !== 93 || approved.some(r => r.candidates.length || !review.codebook[r.code])) throw Error('Unexpected review selection');
const base = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
if (!login.ok) throw Error(`Admin login HTTP ${login.status}`);
const token = (await login.json()).data.access_token;
async function api(path, method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw Error(`${method} ${path}: HTTP ${res.status}`);
  return res.status === 204 ? null : (await res.json()).data;
}
const fields = await api('/fields/price_items');
const existingFields = new Set(fields.map(f => f.field));
const before = await api('/items/price_items?limit=-1&fields=*,procedure.slug');
const plan = approved.map(row => {
  const matches = before.filter(p => p.procedure?.slug === row.slug && p.name === row.item);
  if (matches.length !== 1) throw Error(`Expected unique match: ${row.slug} / ${row.item}`);
  const item = matches[0];
  const values = { medical_service_code: row.code, medical_service_name: review.codebook[row.code].name };
  for (const [key, value] of Object.entries(values)) if (item[key] && item[key] !== value) throw Error(`Existing conflicting value on ${item.id}: ${key}`);
  return { id: item.id, values };
});
console.log(JSON.stringify({ base, matched: plan.length, changes: plan.filter(p => Object.entries(p.values).some(([k,v]) => before.find(r => r.id === p.id)[k] !== v)).length }));
if (!process.argv.includes('--apply')) process.exit(0);
const backup = new URL(`./out/medical-service-codes/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
await writeFile(new URL('before.json', backup), JSON.stringify({ fields, items: before }, null, 2));
for (const [field, label, note] of [
  ['medical_service_code', 'Код медицинской услуги', 'Подтверждённый код по номенклатуре Минздрава. Не МКБ и не код препарата.'],
  ['medical_service_name', 'Наименование по номенклатуре', 'Точное название медицинского вмешательства, соответствующее коду.'],
]) {
  if (!existingFields.has(field)) await api('/fields/price_items', 'POST', { field, type: 'string', schema: { is_nullable: true, max_length: 255 }, meta: { interface: 'input', width: field.endsWith('code') ? 'half' : 'full', note, translations: [{ language: 'ru-RU', translation: label }] } });
}
// Recheck reviewed values immediately before writing, preserving concurrent edits.
const latest = await api('/items/price_items?limit=-1&fields=*,procedure.slug');
for (const p of plan) {
  const original = before.find(r => r.id === p.id), current = latest.find(r => r.id === p.id);
  if (!current || current.name !== original.name || current.procedure?.slug !== original.procedure?.slug || Object.keys(p.values).some(k => (current[k] ?? null) !== (original[k] ?? null))) throw Error(`Concurrent edit ${p.id}`);
}
await api('/items/price_items', 'PATCH', plan.map(p => ({ id: p.id, ...p.values })));
const after = await api('/items/price_items?limit=-1&fields=*,procedure.slug');
if (after.length !== before.length) throw Error('Price row count changed');
for (const original of before) {
  const current = after.find(r => r.id === original.id), p = plan.find(p => p.id === original.id);
  for (const [key, value] of Object.entries(original)) {
    if (key === 'medical_service_code' || key === 'medical_service_name') continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) throw Error(`Unexpected change ${original.id}: ${key}`);
  }
  for (const key of ['medical_service_code', 'medical_service_name']) {
    if ((current[key] ?? null) !== (p ? p.values[key] : original[key] ?? null)) throw Error(`Verification failed ${original.id}: ${key}`);
  }
}
await writeFile(new URL('after.json', backup), JSON.stringify(after, null, 2));
console.log(`Verified ${plan.length} coded rows; all other row values preserved. Backup: ${backup.pathname}`);
