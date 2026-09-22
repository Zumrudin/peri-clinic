import { readFile, mkdir, writeFile } from 'node:fs/promises';
const content = JSON.parse(await readFile(new URL('./astemir-profile-content.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
let token = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_TOKEN;
if (base && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
  if (!response.ok) throw Error(`Login: ${response.status}`);
  token = (await response.json()).data.access_token;
}
if (!base || !token) throw Error('CMS credentials required');
async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw Error(`${method}: ${response.status}`);
  return (await response.json()).data;
}
const records = await api(`/items/specialists?filter[slug][_eq]=${encodeURIComponent(content.slug)}`);
if (records.length !== 1) throw Error('Expected exactly one profile');
const before = records[0];
const { slug, paragraphs, ...fields } = content;
const patch = { ...fields, body: paragraphs.join('\n') };
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ id: before.id, slug: before.slug, ...patch }, null, 2));
} else {
  const directory = new URL('./out/astemir-profile-backups/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(`${Date.now()}.json`, directory), JSON.stringify(before, null, 2));
  await api(`/items/specialists/${before.id}`, 'PATCH', patch);
  const after = await api(`/items/specialists/${before.id}`);
  if (Object.entries(patch).some(([key, value]) => after[key] !== value)) throw Error('Verification failed');
  console.log(`Updated and verified: ${after.slug}`);
}
