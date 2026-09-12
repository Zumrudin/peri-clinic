import type { APIRoute } from 'astro';
import { getAllCategories } from '../lib/categoryContent';
import { getAllProcedures } from '../lib/procedureContent';
import { getAllPages } from '../lib/pageContent';

const STATIC_PATHS = ['/apparaty', '/', '/uslugi-i-ceny', '/result', '/otzyvy', '/kontakty'];

export const GET: APIRoute = async ({ site }) => {
  const base = site?.href.replace(/\/$/, '') ?? 'https://www.peri-clinic.ru';
  const [categories, procedures, pages] = await Promise.all([getAllCategories(), getAllProcedures(), getAllPages()]);

  const urls = [
    ...STATIC_PATHS,
    ...categories.map((c) => `/${c.data.slug}`),
    ...procedures.map((p) => `/${p.data.slug}`),
    ...pages.filter((p) => !p.data.noindex).map((p) => `/${p.data.slug}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
