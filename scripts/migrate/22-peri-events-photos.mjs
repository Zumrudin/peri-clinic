/** Upload the September 2026 event photo set to Peri Gadzhieva's profile. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const base = (process.env.DIRECTUS_URL || 'http://127.0.0.1:8055').replace(/\/$/, '');
let token = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_TOKEN;
if (!token && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
  if (!response.ok) throw new Error(`Login: ${response.status}`);
  token = (await response.json()).data.access_token;
}
if (!token) throw new Error('CMS credentials required');

const photoDir = process.env.PERI_EVENT_PHOTO_DIR || '/tmp/peri-events-20260922';

const photos = [
  [`${photoDir}/IMG_4116.jpg`, 'AMWC Dubai', 'Пери Гаджиева на международном конгрессе AMWC Dubai'],
  [`${photoDir}/IMG_4390.jpg`, 'AMWC Dubai', 'Пери Гаджиева на площадке конгресса AMWC Dubai'],
  [`${photoDir}/IMG_5510.jpg`, 'Международный конгресс', 'Пери Гаджиева на международном конгрессе по эстетической медицине'],
  [`${photoDir}/IMG_6556.jpg`, 'Профессиональное обучение', 'Пери Гаджиева с сертификатом участника профессионального обучения'],
  [`${photoDir}/IMG_6990.jpg`, 'SIAM Expo', 'Пери Гаджиева на выставке SIAM Expo'],
  [`${photoDir}/IMG_7705.jpg`, 'Dubai Derma', 'Пери Гаджиева на конференции Dubai Derma'],
  [`${photoDir}/IMG_8325.jpg`, 'SIAM', 'Пери Гаджиева на профессиональном мероприятии SIAM'],
  [`${photoDir}/IMG_8558.jpg`, 'AMWC 2026', 'Пери Гаджиева на церемонии Aesthetic Medicine Awards в рамках AMWC 2026'],
  [`${photoDir}/IMG_8705.jpg`, 'AMWC 2026', 'Пери Гаджиева на конгрессе эстетической и антивозрастной медицины AMWC 2026'],
  [`${photoDir}/IMG_9671.jpg`, 'REVI Summit', 'Пери Гаджиева на саммите науки и красоты REVI'],
];

async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()).data;
}

async function upload(path, title) {
  const form = new FormData();
  form.append('title', title);
  form.append('file', new Blob([await readFile(path)], { type: 'image/jpeg' }), basename(path).replace(extname(path), '.jpg'));
  const response = await fetch(`${base}/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!response.ok) throw new Error(`Upload ${basename(path)}: ${response.status} ${await response.text()}`);
  return (await response.json()).data;
}

const specialists = await api('/items/specialists?filter[slug][_eq]=gadzhieva&fields=id,name,media_items.id,media_items.sort,media_items.title,media_items.image_alt&limit=1');
if (specialists.length !== 1) throw new Error('Expected exactly one Peri Gadzhieva profile');
const specialist = specialists[0];
const firstSort = Math.max(0, ...(specialist.media_items || []).map(item => item.sort || 0)) + 1;

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ specialist: specialist.name, firstSort, photos: photos.map(([, title, image_alt]) => ({ title, image_alt })) }, null, 2));
  process.exit(0);
}

const backupDir = new URL('./out/peri-events-photos-backups/', import.meta.url);
await mkdir(backupDir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, backupDir), JSON.stringify(specialist, null, 2), { mode: 0o600 });

const created = [];
for (const [path, title, image_alt] of photos) {
  if ((specialist.media_items || []).some(item => item.image_alt === image_alt)) continue;
  const file = await upload(path, `Пери Гаджиева — ${title}`);
  const item = await api('/items/specialist_media', 'POST', { specialist: specialist.id, title, image_alt, image: file.id, sort: firstSort + created.length });
  created.push({ id: item.id, file: file.id, title });
}

const verified = await api(`/items/specialists/${specialist.id}?fields=id,media_items.id,media_items.sort,media_items.title,media_items.image.id`);
for (const item of created) {
  if (!verified.media_items.some(candidate => candidate.id === item.id && candidate.image?.id === item.file)) throw new Error(`Verification failed for ${item.title}`);
}
console.log(`Uploaded and verified ${created.length} new photos for ${specialist.name}`);
