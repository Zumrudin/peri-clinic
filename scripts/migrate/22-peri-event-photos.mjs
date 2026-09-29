import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
let token = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_TOKEN;
if (base && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
  if (!response.ok) throw Error(`Login: ${response.status}`);
  token = (await response.json()).data.access_token;
}
if (!base || !token) throw Error('CMS credentials required');

const photos = [
  ['peri-event-amwc-dubai-01.jpg', 'AMWC Dubai', 'Участие в международном конгрессе эстетической и антивозрастной медицины AMWC в Дубае.'],
  ['peri-event-amwc-dubai-02.jpg', 'AMWC Dubai', 'Международный обмен опытом и знакомство с актуальными направлениями эстетической медицины.'],
  ['peri-event-pro-ageless.jpg', 'Pro-Ageless', 'Участие в профессиональном мероприятии, посвящённом современным anti-age и pro-age подходам.'],
  ['peri-event-sheinb-training.jpg', 'Международное обучение SHEINB', 'Повышение квалификации и знакомство с современными технологиями эстетической медицины.'],
  ['peri-event-siam.jpg', 'Конгресс SIAM', 'Профессиональное событие в области эстетической медицины и косметологии.'],
  ['peri-event-dubai-derma-2025.jpg', 'Dubai Derma 2025', '24-я международная конференция и выставка по дерматологии и лазерным технологиям в Дубае.'],
  ['peri-event-siam-02.jpg', 'Конгресс SIAM', 'Участие в научной программе и обмен опытом с коллегами.'],
  ['peri-event-amwc-2026-01.jpg', 'AMWC 2026', '24-й Всемирный конгресс эстетической и антивозрастной медицины.'],
  ['peri-event-amwc-2026-02.jpg', 'AMWC 2026', 'Международный конгресс: новые исследования, методики и профессиональный обмен.'],
  ['peri-event-revi-summit.jpg', 'REVI Summit', 'Профессиональный саммит науки и красоты.'],
];

async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()).data;
}

const [specialist] = await api('/items/specialists?filter[slug][_eq]=gadzhieva&limit=2');
if (!specialist) throw Error('Profile gadzhieva not found');
const existing = await api(`/items/specialist_media?filter[specialist][_eq]=${specialist.id}&limit=-1&sort=sort`);
const duplicateNames = new Set(existing.map(item => item.title));
const pending = photos.filter(([, title]) => !duplicateNames.has(title) || title === 'AMWC Dubai' || title === 'AMWC 2026' || title === 'Конгресс SIAM');

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ specialist: specialist.id, existing: existing.length, photos }, null, 2));
  process.exit(0);
}

const backupDir = new URL('./out/peri-event-photos-backups/', import.meta.url);
await mkdir(backupDir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, backupDir), JSON.stringify(existing, null, 2));

let sort = Math.max(0, ...existing.map(item => item.sort || 0));
for (const [filename, title, description] of photos) {
  const matches = await api(`/files?filter[filename_download][_eq]=${encodeURIComponent(filename)}&limit=1`);
  let file = matches[0];
  if (!file) {
    const bytes = await readFile(new URL(`./out/peri-event-photos/${filename}`, import.meta.url));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/jpeg' }), basename(filename));
    form.append('title', title);
    const response = await fetch(`${base}/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (!response.ok) throw Error(`Upload ${filename}: ${response.status} ${await response.text()}`);
    file = (await response.json()).data;
  }
  const already = await api(`/items/specialist_media?filter[specialist][_eq]=${specialist.id}&filter[image][_eq]=${file.id}&limit=1`);
  if (!already.length) await api('/items/specialist_media', 'POST', { specialist: specialist.id, title, description, image: file.id, image_alt: `${title}: Пери Гаджиева на профессиональном мероприятии`, sort: ++sort });
}

const after = await api(`/items/specialist_media?filter[specialist][_eq]=${specialist.id}&limit=-1&sort=sort&fields=id,title,image.id,image.filename_download,sort`);
for (const [filename] of photos) if (!after.some(item => item.image?.filename_download === filename)) throw Error(`Verification failed: ${filename}`);
console.log(`Uploaded and verified ${photos.length} photos; profile now has ${after.length} media items.`);
