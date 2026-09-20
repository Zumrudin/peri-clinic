/** Change only the booking Telegram link; save the previous singleton before --apply. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const values = JSON.parse(await readFile(new URL('./telegram-contact.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
if (!login.ok) throw Error(`Login HTTP ${login.status}`);
const token = (await login.json()).data.access_token;
async function api(method = 'GET', body) {
  const response = await fetch(base + '/items/site_settings', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw Error(`site_settings HTTP ${response.status}`);
  return (await response.json()).data;
}
const before = await api();
console.log(JSON.stringify({ base, before: before.telegram_url, after: values.telegram_url }));
if (!process.argv.includes('--apply') || before.telegram_url === values.telegram_url) process.exit(0);
const backup = new URL(`./out/telegram-contact/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
await writeFile(new URL('before.json', backup), JSON.stringify(before, null, 2));
await api('PATCH', values);
const after = await api();
for (const [key, value] of Object.entries({ ...before, ...values })) {
  if (['date_updated', 'user_updated'].includes(key)) continue;
  if (JSON.stringify(after[key]) !== JSON.stringify(value)) throw Error(`Unexpected change: ${key}`);
}
await writeFile(new URL('after.json', backup), JSON.stringify(after, null, 2));
console.log(`Verified Telegram contact; backup: ${backup.pathname}`);
