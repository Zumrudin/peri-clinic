/** Upload the additional September 2026 photo set to Peri Gadzhieva's profile. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const base = (process.env.DIRECTUS_URL || 'http://127.0.0.1:8055').replace(/\/$/, '');
let token = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_TOKEN;
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
  if (!response.ok) throw new Error(`Login: ${response.status}`);
  token = (await response.json()).data.access_token;
}
if (!token) throw new Error('CMS credentials required');

const photoDir = process.env.PERI_EVENT_PHOTO_DIR || '/tmp/peri-additional-events-20260922';
const photos = [
  [`${photoDir}/peri-bi-soft-injection-technology.jpg`, 'Bi-Soft Injection Technology', 'Пери Гаджиева на профессиональном мероприятии Bi-Soft Injection Technology'],
  [`${photoDir}/peri-revi-club-istanbul.jpg`, 'REVI Club Istanbul', 'Пери Гаджиева на клинико-анатомическом обучении REVI Club в Стамбуле'],
  [`${photoDir}/peri-banobagi.jpg`, 'Banobagi', 'Пери Гаджиева во время профессионального визита в клинику Banobagi'],
  [`${photoDir}/peri-classys.jpg`, 'Classys', 'Пери Гаджиева на профессиональном обучении Classys'],
  [`${photoDir}/peri-vivacy-paris.jpg`, 'Laboratoires Vivacy Paris', 'Пери Гаджиева на профессиональном обучении Laboratoires Vivacy в Париже'],
  [`${photoDir}/peri-ibsa-event.jpg`, 'Профессиональное мероприятие IBSA', 'Пери Гаджиева на профессиональном мероприятии IBSA'],
];

async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()).data;
}

async function upload(path, title) {
  const form = new FormData();
  form.append('title', title);
  form.append('file', new Blob([await readFile(path)], { type: 'image/jpeg' }), basename(path));
  const response = await fetch(`${base}/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!response.ok) throw new Error(`Upload ${basename(path)}: ${response.status} ${await response.text()}`);
  return (await response.json()).data;
}

const specialists = await api('/items/specialists?filter[slug][_eq]=gadzhieva&fields=id,name,media_items.id,media_items.sort,media_items.title,media_items.image_alt&limit=1');
if (specialists.length !== 1) throw new Error('Expected exactly one Peri Gadzhieva profile');
const specialist = specialists[0];
const firstSort = Math.max(0, ...(specialist.media_items || []).map(item => item.sort || 0)) + 1;
const pending = photos.filter(([, , imageAlt]) => !(specialist.media_items || []).some(item => item.image_alt === imageAlt));

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ specialist: specialist.name, existing: specialist.media_items?.length || 0, firstSort, pending: pending.map(([, title, image_alt]) => ({ title, image_alt })) }, null, 2));
  process.exit(0);
}

const backupDir = new URL('./out/peri-additional-event-photos-backups/', import.meta.url);
await mkdir(backupDir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, backupDir), JSON.stringify(specialist, null, 2), { mode: 0o600 });

const created = [];
for (const [path, title, image_alt] of pending) {
  const file = await upload(path, `Пери Гаджиева — ${title}`);
  const item = await api('/items/specialist_media', 'POST', { specialist: specialist.id, title, image_alt, image: file.id, sort: firstSort + created.length });
  created.push({ id: item.id, file: file.id, title });
}

const verified = await api(`/items/specialists/${specialist.id}?fields=id,media_items.id,media_items.sort,media_items.title,media_items.image.id`);
for (const item of created) {
  if (!verified.media_items.some(candidate => candidate.id === item.id && candidate.image?.id === item.file)) throw new Error(`Verification failed for ${item.title}`);
}
console.log(`Uploaded and verified ${created.length} new photos for ${specialist.name}`);
