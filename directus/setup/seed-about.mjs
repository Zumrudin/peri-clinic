/** Temporary reference crops, explicitly flagged as demo. Never overwrite editor content. */
import { readFile } from 'node:fs/promises';
import { BASE, get, post, patch, login, log } from './lib.mjs';
const copy = JSON.parse(await readFile(new URL('../../src/data/about-demo.json', import.meta.url), 'utf8'));
const current = await get('/items/clinic_about');
if (!current?.title) await patch('/items/clinic_about', copy);

async function upload(name) {
  const title = `about-reference-${name}`;
  const existing = await get(`/files?filter[title][_eq]=${encodeURIComponent(title)}&limit=1`);
  if (existing.length) return existing[0].id;
  const data = new FormData();
  data.append('title', title);
  data.append('description', 'Временное изображение из утверждённого дизайн-референса. Заменить реальной фотографией.');
  data.append('file', new Blob([await readFile(new URL(`../../src/assets/about/${name}.webp`, import.meta.url))], { type: 'image/webp' }), `${name}.webp`);
  const response = await fetch(`${BASE}/files`, { method: 'POST', headers: { Authorization: `Bearer ${await login()}` }, body: data });
  if (!response.ok) throw new Error(`Reference upload failed: HTTP ${response.status}`);
  return (await response.json()).data.id;
}

// Seed only completely empty collections, so reruns cannot bring back deleted demo people.
if (!(await get('/items/clinic_photos?limit=1')).length) {
  for (const [i, name] of ['reception', 'cabinet', 'waiting'].entries()) {
    await post('/items/clinic_photos', { status: 'published', sort: i + 1, is_demo: true, title: ['Ресепшен', 'Кабинет', 'Зона ожидания'][i], image: await upload(name), image_alt: 'Временный интерьер из дизайн-концепции' });
  }
}
if (!(await get('/items/specialists?limit=1')).length) {
  for (let i = 1; i <= 3; i++) {
    await post('/items/specialists', { status: 'published', sort: i, is_demo: true, slug: `demo-specialist-${i}`, name: `Специалист ${i}`, role: i === 1 ? 'Главный врач' : 'Врач-косметолог', image: await upload(`specialist-${i}`), image_alt: 'Условный портрет из дизайн-концепции', focus_y: 35,
      body: '<p>Здесь будет описание специалиста: знакомство с врачом, направления работы, образование и опыт.</p><p>Это демонстрационная страница. Портрет вырезан из утверждённого референса и будет заменён настоящей фотографией.</p>', seo_description: 'Демонстрационная страница специалиста' });
  }
}
log('about content ready; demo images remain explicitly marked');
