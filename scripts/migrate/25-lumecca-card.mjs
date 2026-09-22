/** Rename the Lumecca card in Directus; preview by default, --apply saves a backup. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const content = JSON.parse(await readFile(new URL('./lumecca-card-content.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
let token = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_TOKEN;
if (!base) throw new Error('DIRECTUS_URL required');
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  if (!response.ok) throw new Error(`Login: ${response.status}`);
  token = (await response.json()).data.access_token;
}
if (!token) throw new Error('CMS credentials required');

async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}

const query = new URLSearchParams({ 'filter[procedure][slug][_eq]': content.procedure_slug });
const records = await api(`/items/devices?${query}`);
if (records.length !== 1) throw new Error('Expected exactly one Lumecca card');
const before = records[0];
if (before.name === content.name) {
  console.log('Lumecca card already up to date');
} else if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ id: before.id, before: before.name, after: content.name }, null, 2));
} else {
  const directory = new URL('./out/lumecca-card-backups/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(`${Date.now()}.json`, directory), JSON.stringify(before, null, 2));
  const path = `/items/devices/${before.id}`;
  const current = await api(path);
  if (current.name !== before.name) throw new Error('Concurrent name edit');
  await api(path, 'PATCH', { name: content.name });
  const after = await api(path);
  if (after.name !== content.name) throw new Error('Verification failed');
  console.log(`Updated and verified: ${after.name}`);
}
