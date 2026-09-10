/**
 * Builds manifest.json (this script's output, source of truth for 02-05) and the
 * human-readable docs/CONTENT-MAP.md. The Wix sitemap only lists URLs — it says nothing
 * about page type — so classification below is hand-curated against the LIVE site
 * (fetched and read page-by-page while planning this phase, see the phase-4 plan section
 * in docs/superpowers/plans/ for what was actually checked and why).
 *
 * Confirmed via `curl https://www.peri-clinic.ru/pages-sitemap.xml` on 2026-09-10: 36 URLs
 * (35 + homepage), including two stale "backup" pages Wix left live and one page whose
 * slug and content don't match (см. `microtoki` ниже).
 *
 * Run: node scripts/migrate/01-sitemap.mjs
 */
import { writeFile } from 'node:fs/promises';
import { fetchHtml, ensureDir, ROOT } from './lib.mjs';

const SITEMAP_URL = 'https://www.peri-clinic.ru/pages-sitemap.xml';
const BASE = 'https://www.peri-clinic.ru';

// slug -> { type, category?, redirectTo?, note? }
// type: category | procedure | results | services_overview | legal_page | redirect | home
const CLASSIFY = {
  '': { type: 'home', note: 'Уже перенесена в фазе 3, здесь не скрейпится повторно.' },

  'apparatnaya-kosmetologiya': { type: 'category' },
  'injekcionnaya-cosmetologiya': { type: 'category' },
  'esteticheskaya-kosmetologiya': { type: 'category' },

  'pigment-lumec': { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  'rf-lifting-inmode': { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  volnewmer: { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  'tesla-former': { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  pladuo: { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  beautylizer: { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  'laser-epilation': { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  profeccial: { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  heleo: { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  'mikrotokovaya-terapiya': { type: 'procedure', category: 'apparatnaya-kosmetologiya' },
  microtoki: {
    type: 'procedure',
    category: 'apparatnaya-kosmetologiya',
    note: 'НЕ редирект на mikrotokovaya-terapiya, как предполагалось в исходном плане — реальная отдельная страница "Удаление новообразований Sensitec".',
  },

  'mezoterapiya-i-biorevitalizaciya': { type: 'procedure', category: 'injekcionnaya-cosmetologiya' },
  'konturnaya-plastika': { type: 'procedure', category: 'injekcionnaya-cosmetologiya' },
  botullinoterapiya: { type: 'procedure', category: 'injekcionnaya-cosmetologiya' },
  'plazmoterapiya-plazmolifting': { type: 'procedure', category: 'injekcionnaya-cosmetologiya' },
  lipolitiki: { type: 'procedure', category: 'injekcionnaya-cosmetologiya' },
  droppers: {
    type: 'procedure',
    category: 'injekcionnaya-cosmetologiya',
    note: 'Не в pages-sitemap.xml, но живая опубликованная страница ("Капельницы") — найдена как ссылка на странице категории. Slug оставлен как на Wix (droppers), не переименован в "kapelnicy", как предполагал исходный план.',
  },

  maski: { type: 'procedure', category: 'esteticheskaya-kosmetologiya' },
  'uhodovye-procedury': { type: 'procedure', category: 'esteticheskaya-kosmetologiya' },
  'kosemotologicheskie-pilingi': { type: 'procedure', category: 'esteticheskaya-kosmetologiya' },

  result: { type: 'results' },
  'uslugi-i-ceny': { type: 'services_overview' },

  'uridicheskaya-informaciya': { type: 'legal_page', template: 'legal', note: 'Организационные документы — источник ОГРН/ИНН/лицензии.' },
  'yuridicheskaya-informaciya': { type: 'legal_page', template: 'legal', note: 'Хаб-страница со ссылками на прочие юр. документы.' },
  'normativno-parvovye-dokumenty': { type: 'legal_page', template: 'legal' },
  'kontakty-organov': { type: 'legal_page', template: 'legal' },
  'poryadok-oplaty': { type: 'legal_page', template: 'legal' },
  politika: { type: 'legal_page', template: 'legal', note: 'Канонический документ 152-ФЗ.' },
  'polzovatelskoe-soglashenie': { type: 'legal_page', template: 'legal' },
  loyaltyprogram: { type: 'legal_page', template: 'loyalty' },
  spravka: { type: 'legal_page', template: 'spravka' },

  soglashenie: { type: 'redirect', redirectTo: '/politika', note: 'Заголовок "Политика персональных данных" — устаревший дубль /politika.' },
  'копия-маски': { type: 'redirect', redirectTo: '/esteticheskaya-kosmetologiya', note: 'Заголовок "Чистки" — забытый backup-черновик, не совпадает по смыслу с /maski.' },
  'копия-услуги-и-цены': { type: 'redirect', redirectTo: '/uslugi-i-ceny', note: 'Заголовок "бэкап Услуги и цены" — явный backup.' },
};

// Live, linked-from-the-site pages that Wix's own sitemap.xml omits (found by walking
// category-page links during extraction, not by crawling the sitemap).
const EXTRA_URLS = [`${BASE}/droppers`];

async function main() {
  const xml = await fetchHtml(SITEMAP_URL);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).concat(EXTRA_URLS);
  console.log(`sitemap: ${urls.length - EXTRA_URLS.length} URLs + ${EXTRA_URLS.length} extra known URL(s)`);

  const manifest = [];
  const unclassified = [];
  for (const url of urls) {
    const slug = decodeURIComponent(url.replace(BASE, '').replace(/^\//, '').replace(/\/$/, ''));
    const entry = CLASSIFY[slug];
    if (!entry) {
      unclassified.push(slug);
      continue;
    }
    manifest.push({ wixUrl: url, slug: slug || null, ...entry });
  }

  if (unclassified.length) {
    console.warn('UNCLASSIFIED slugs (add to CLASSIFY before continuing):', unclassified);
  }

  await ensureDir(new URL('.', import.meta.url));
  await writeFile(new URL('./manifest.json', import.meta.url), JSON.stringify(manifest, null, 2));

  const rows = manifest
    .filter((m) => m.type !== 'home')
    .map((m) => {
      const dest = m.type === 'redirect' ? `301 → ${m.redirectTo}` : `/${m.slug}`;
      return `| ${m.wixUrl} | ${m.type} | ${dest} | ${m.note ?? ''} |`;
    });
  const md = [
    '# CONTENT-MAP — соответствие Wix URL и нового сайта',
    '',
    `Сформировано ${new Date().toISOString().slice(0, 10)} скриптом \`scripts/migrate/01-sitemap.mjs\` из \`${SITEMAP_URL}\`. Всего URL в sitemap: ${urls.length}.`,
    '',
    '| Wix URL | Тип | Новый адрес | Примечание |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  await writeFile(new URL('../../docs/CONTENT-MAP.md', import.meta.url), md);

  console.log(`manifest.json: ${manifest.length} entries`);
  console.log('docs/CONTENT-MAP.md written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
