/**
 * Seeds Directus with the homepage content already approved and live in the Astro
 * components (was previously src/data/home.json + site.json, now removed). This is
 * NOT the Wix migration (that's phase 4, scripts/migrate/) — it just moves today's
 * already-approved copy into the CMS so editors can take over from here.
 *
 * Idempotent: uploads are skipped if a file with the same `title` already exists in the
 * matching folder; items are upserted by a natural key (slug / name / author_name+date).
 * Run: DIRECTUS_URL=... DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... node directus/setup/seed-home.mjs
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { get, post, patch, log, login, BASE } from './lib.mjs';

const ASSETS = fileURLToPath(new URL('../../src/assets/home/', import.meta.url));

// --- files -----------------------------------------------------------------

const folderCache = new Map();
async function folderId(name) {
  if (folderCache.has(name)) return folderCache.get(name);
  const found = (await get(`/folders?filter[name][_eq]=${encodeURIComponent(name)}`))[0];
  folderCache.set(name, found?.id ?? null);
  return found?.id ?? null;
}

async function uploadFile(filename, { title, folder }) {
  const existing = (await get(`/files?filter[title][_eq]=${encodeURIComponent(title)}&limit=1`))[0];
  if (existing) return existing.id;

  const buf = await readFile(ASSETS + filename);
  const ext = filename.split('.').pop();
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';
  const form = new FormData();
  const fid = await folderId(folder);
  if (fid) form.set('folder', fid);
  form.set('title', title);
  form.set('file', new Blob([buf], { type }), filename);

  const token = await login();
  const res = await fetch(`${BASE}/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) throw new Error(`upload ${filename} → ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  log('uploaded', filename, '→', title);
  return data.id;
}

// --- upsert helpers ----------------------------------------------------------

async function upsert(collection, key, value, payload) {
  const existing = (await get(`/items/${collection}?filter[${key}][_eq]=${encodeURIComponent(value)}&limit=1`))[0];
  if (existing) {
    await patch(`/items/${collection}/${existing.id}`, payload);
    return existing.id;
  }
  const created = await post(`/items/${collection}`, { [key]: value, ...payload });
  return created.id;
}

// --- content -----------------------------------------------------------------

async function main() {
  log('uploading images...');
  const files = {
    hero: await uploadFile('hero.jpg', { title: 'home-hero', folder: 'Главная' }),
    approach: await uploadFile('approach.jpg', { title: 'home-approach', folder: 'Главная' }),
    catApparatnaya: await uploadFile('cat-apparatnaya.jpg', { title: 'category-apparatnaya-kosmetologiya', folder: 'Направления' }),
    catInjekcionnaya: await uploadFile('cat-injekcionnaya.jpg', { title: 'category-injekcionnaya-cosmetologiya', folder: 'Направления' }),
    catEsteticheskaya: await uploadFile('cat-esteticheskaya.jpg', { title: 'category-esteticheskaya-kosmetologiya', folder: 'Направления' }),
    deviceMorpheus8: await uploadFile('device-morpheus8.png', { title: 'device-morpheus8', folder: 'Аппараты' }),
    deviceUltraformer: await uploadFile('device-ultraformer.png', { title: 'device-ultraformer', folder: 'Аппараты' }),
    deviceVolnewmer: await uploadFile('device-volnewmer.png', { title: 'device-volnewmer', folder: 'Аппараты' }),
    deviceInmode: await uploadFile('device-inmode.png', { title: 'device-inmode', folder: 'Аппараты' }),
    caseVolnewmer: await uploadFile('case-volnewmer.jpg', { title: 'case-volnewmer-after', folder: 'До-после' }),
    caseKonturnaya: await uploadFile('case-konturnaya.jpg', { title: 'case-konturnaya-after', folder: 'До-после' }),
    caseGuby: await uploadFile('case-guby.jpg', { title: 'case-guby-after', folder: 'До-после' }),
  };

  log('site_settings...');
  await patch('/items/site_settings', {
    phone: '+7 925 017-77-78',
    email: 'Peri.Clinic@mail.ru',
    city: 'Москва',
    hours: 'Ежедневно, 10:00–22:00',
    address_short: 'Москва, ул. Генерала Белова, 28, корпус 3',
    address_lines: 'ул. Генерала Белова,\n28, корпус 3',
    telegram_url: 'https://t.me/peri_clinic',
    whatsapp_text: 'Здравствуйте! Хочу записаться в PERI CLINIC',
    vk_url: 'https://vk.com/periclinic',
    instagram_url: 'https://instagram.com/peri_clinic',
    shop_url: 'https://periclinic-shop.ru',
    tagline: 'Естественная красота.\nВрачебная точность.',
    non_offer_text: 'Информация на сайте носит информационный характер и не является публичной офертой.',
    instagram_disclaimer: '',
    contraindications_text: 'Имеются противопоказания. Необходима консультация специалиста.',
  });

  log('service_categories...');
  const catApparatnaya = await upsert('service_categories', 'slug', 'apparatnaya-kosmetologiya', {
    status: 'published',
    sort: 1,
    title: 'Аппаратная\nкосметология',
    short_title: 'Аппаратная косметология',
    tagline: 'Лифтинг · Омоложение · Качество кожи',
    cover: files.catApparatnaya,
    cover_alt: 'Аппаратная косметология',
    show_on_home: true,
  });
  await upsert('service_categories', 'slug', 'injekcionnaya-cosmetologiya', {
    status: 'published',
    sort: 2,
    title: 'Инъекционная\nкосметология',
    short_title: 'Инъекционная косметология',
    tagline: 'Контуры · Увлажнение · Гармонизация',
    cover: files.catInjekcionnaya,
    cover_alt: 'Инъекционная косметология',
    show_on_home: true,
  });
  await upsert('service_categories', 'slug', 'esteticheskaya-kosmetologiya', {
    status: 'published',
    sort: 3,
    title: 'Эстетическая\nкосметология',
    short_title: 'Эстетическая косметология',
    tagline: 'Уход · Восстановление · Сияние',
    cover: files.catEsteticheskaya,
    cover_alt: 'Эстетическая косметология',
    show_on_home: true,
  });

  log('devices...');
  await upsert('devices', 'name', 'Morpheus 8', {
    status: 'published',
    sort: 1,
    short: 'Игольчатый RF-лифтинг',
    image: files.deviceMorpheus8,
    show_on_home: true,
  });
  await upsert('devices', 'name', 'Ultraformer', {
    status: 'published',
    sort: 2,
    short: 'SMAS-лифтинг',
    image: files.deviceUltraformer,
    show_on_home: true,
  });
  await upsert('devices', 'name', 'Volnewmer', {
    status: 'published',
    sort: 3,
    short: 'Монополярный RF-лифтинг',
    image: files.deviceVolnewmer,
    show_on_home: true,
  });
  await upsert('devices', 'name', 'InMode', {
    status: 'published',
    sort: 4,
    short: 'Комплексное омоложение',
    image: files.deviceInmode,
    show_on_home: true,
  });

  log('case_categories...');
  const ccApparatnaya = await upsert('case_categories', 'title', 'Аппаратная косметология', { slug: 'apparatnaya-kosmetologiya', sort: 1 });
  const ccInjekcionnaya = await upsert('case_categories', 'title', 'Инъекционная косметология', { slug: 'injekcionnaya-cosmetologiya', sort: 2 });

  log('before_after_cases...');
  await upsert('before_after_cases', 'title', 'Volnewmer', {
    status: 'published',
    sort: 1,
    category: ccApparatnaya,
    after: files.caseVolnewmer,
    result: 'Более плотная кожа, чёткий овал и мягкий лифтинг',
    show_on_home: true,
    needs_review: false,
  });
  await upsert('before_after_cases', 'title', 'Контурная пластика', {
    status: 'published',
    sort: 2,
    category: ccInjekcionnaya,
    after: files.caseKonturnaya,
    result: 'Гармонизация профиля и деликатная коррекция пропорций',
    show_on_home: true,
    needs_review: false,
  });
  await upsert('before_after_cases', 'title', 'Коррекция губ', {
    status: 'published',
    sort: 3,
    category: ccInjekcionnaya,
    after: files.caseGuby,
    result: 'Естественный объём, увлажнение и восстановление симметрии',
    show_on_home: true,
    needs_review: false,
  });

  log('reviews...');
  await upsert('reviews', 'author_name', 'Анна', {
    status: 'published',
    sort: 1,
    date: '2026-08-12',
    rating: 5,
    procedure_label: 'Контурная пластика',
    text: 'Очень деликатный подход. Врач услышала мой запрос на максимально естественный результат — лицо выглядит свежее, но никто не понял, в чём дело.',
    source: 'site',
    show_on_home: true,
  });
  await upsert('reviews', 'author_name', 'Мария', {
    status: 'published',
    sort: 2,
    date: '2026-08-03',
    rating: 5,
    procedure_label: 'Morpheus 8',
    text: 'В клинике очень спокойно и красиво, всё объясняют до процедуры и остаются на связи после. Вернусь на следующий этап плана.',
    source: 'site',
    show_on_home: true,
  });
  await upsert('reviews', 'author_name', 'Елена', {
    status: 'published',
    sort: 3,
    date: '2026-07-28',
    rating: 5,
    procedure_label: 'Консультация косметолога',
    text: 'Наконец нашла врача, которому могу доверить лицо. Ничего лишнего не назначили, подробно рассказали о вариантах и сроках.',
    source: 'site',
    show_on_home: true,
  });

  log('home singleton...');
  await patch('/items/home', {
    hero_eyebrow: 'Клиника эстетической медицины · Москва',
    hero_title: 'Красота,\n_основанная_\nна медицине',
    hero_lead: 'Деликатно подчёркиваем вашу естественную красоту, сочетая врачебную экспертизу, премиальные технологии и искреннюю заботу.',
    hero_primary_label: 'Подобрать процедуру',
    hero_secondary_label: 'Смотреть результаты',
    hero_image: files.hero,
    hero_image_alt: 'Эстетическая процедура в PERI CLINIC',
    hero_note: 'Эстетика, которая\nостаётся _вашей_',
    hero_facts: [
      { value: '3', label: 'направления\nкосметологии' },
      { value: '100%', label: 'сертифицированные\nпрепараты' },
      { value: '10–22', label: 'время работы\nклиники' },
    ],
    ticker_items: ['Здоровье кожи', 'Естественный результат', 'Врачебная экспертиза', 'Премиальные технологии'],
    categories_eyebrow: 'Направления',
    categories_title: 'Забота, подобранная\n_именно для вас_',
    categories_lead: 'Начинаем с консультации и составляем персональный план — без лишних процедур и навязанных решений.',
    approach_eyebrow: 'Философия PERI',
    approach_title: 'Точная медицина.\n_Деликатная эстетика._',
    approach_lead: 'Для нас хороший результат — тот, о котором не догадываются окружающие. Они лишь замечают, что вы выглядите свежо, спокойно и уверенно.',
    approach_image: files.approach,
    approach_image_alt: 'Врач PERI CLINIC проводит процедуру',
    approach_badge: 'PERI\nCARE',
    principles: [
      { title: 'Безопасность прежде всего', text: 'Только врачи, сертифицированные препараты и доказательные протоколы.' },
      { title: 'Сохраняем индивидуальность', text: 'Не меняем черты, а мягко работаем с пропорциями и качеством кожи.' },
      { title: 'Сопровождаем после визита', text: 'Остаёмся на связи и контролируем восстановление после процедуры.' },
    ],
    approach_link_label: 'Познакомиться с клиникой',
    approach_link_href: '/kontakty',
    devices_eyebrow: 'Технологии',
    devices_title: 'Премиальный парк\n_оборудования_',
    devices_lead: 'Работаем на оригинальных аппаратах с доказанной эффективностью и точными протоколами.',
    cases_eyebrow: 'До и после',
    cases_title: 'Результат,\n_который говорит сам_',
    cases_lead: 'Реальные пациенты PERI CLINIC. Каждый результат индивидуален и зависит от исходных данных.',
    reviews_eyebrow: 'Отзывы пациентов',
    reviews_title: 'Доверие, которое\n_для нас бесценно_',
    reviews_rating: '5.0',
    reviews_rating_label: 'рейтинг клиники',
    cta_eyebrow: 'Начните с консультации',
    cta_title: 'Подберём решение,\n_которое подходит вам_',
    cta_lead: 'Напишите нам в удобном мессенджере или позвоните — администратор уточнит ваш запрос и предложит время для визита.',
    cta_button_label: 'Записаться',
    cta_image: files.catApparatnaya,
    cta_image_alt: 'Процедура в PERI CLINIC',
    seo_title: 'PERI CLINIC — клиника эстетической медицины в Москве',
    seo_description: 'PERI CLINIC — клиника эстетической медицины в Москве. Аппаратная, инъекционная и эстетическая косметология. Забота о естественной красоте и здоровье кожи.',
  });

  log('seed complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
