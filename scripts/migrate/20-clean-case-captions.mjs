/** Clean gallery captions in CMS. Defaults to dry run; --apply backs up all records first. */
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
let token = process.env.DIRECTUS_TOKEN;
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  if (!response.ok) throw Error(`Login HTTP ${response.status}`);
  token = (await response.json()).data.access_token;
}
if (!token) throw Error('CMS credentials required');
async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}/items/before_after_cases${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw Error(`CMS HTTP ${response.status}`);
  return (await response.json()).data;
}
const before = await api('?limit=-1');
const updates = before.flatMap(row => {
  const title = row.title.replace(/\s*[—–-]\s*пример\s*№?\s*\d+\s*$/iu, '').replace(/\s*№\s*\d+\s*$/u, '').trim();
  const patch = {};
  if (title !== row.title) patch.title = title;
  if (row.result?.trim() === 'Пример из материалов о процедуре. Результат индивидуален.') patch.result = null;
  return Object.keys(patch).length ? [{ id: row.id, ...patch }] : [];
});
console.log(JSON.stringify({ records: before.length, updates }, null, 2));
if (!process.argv.includes('--apply') || !updates.length) process.exit(0);
const backup = new URL(`./out/case-caption-backups/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
await writeFile(new URL('before.json', backup), JSON.stringify(before, null, 2));
await api('', 'PATCH', updates);
const after = await api('?limit=-1');
if (after.length !== before.length) throw Error('Record count changed');
for (const row of before) {
  const { id, ...patch } = updates.find(update => update.id === row.id) || {};
  const expected = { ...row, ...patch };
  const actual = after.find(item => item.id === row.id);
  for (const key of Object.keys(expected)) {
    if (['date_updated', 'user_updated'].includes(key)) continue;
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual?.[key])) throw Error(`Unexpected change: ${row.id}.${key}`);
  }
}
await writeFile(new URL('after.json', backup), JSON.stringify(after, null, 2));
console.log(`Verified ${updates.length} updates; backup: ${backup.pathname}`);
