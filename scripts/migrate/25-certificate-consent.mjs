/** CMS content only. --apply writes after backup; default is a dry run. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { pages } = JSON.parse(await readFile(new URL('./certificate-legal-pages-2026-09-28.json', import.meta.url)));
const release = JSON.parse(await readFile(new URL('./certificate-consent-2026-09-28.json', import.meta.url)));
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_TOKEN;
if (!base || !token) throw new Error('DIRECTUS_URL and DIRECTUS_TOKEN required');
async function request(path, method = 'GET', body) {
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  return (await r.json()).data;
}
const existing = await request('/items/pages?limit=-1');
const updates = pages.map(page => ({ page, previous: existing.find(p => p.slug === page.slug) }));
const immutable = updates.find(x => x.page.slug === release.slug);
if (immutable.previous && (immutable.previous.body !== release.body || immutable.previous.title !== release.title)) throw new Error('Existing archived consent differs: create a new revision, do not overwrite');
for (const { page, previous } of updates) console.log(`${previous ? 'UPDATE' : 'CREATE'} /${page.slug}`);
if (process.argv.includes('--apply')) {
  const dir = new URL('./out/certificate-consent-backups/', import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL(`${Date.now()}.json`, dir), JSON.stringify(updates, null, 2));
  for (const { page, previous } of updates) {
    await request('/items/pages' + (previous ? `/${previous.id}` : ''), previous ? 'PATCH' : 'POST', { ...page, status: 'published', seo_title: `${page.title} — PERI CLINIC`, seo_description: page.lead });
  }
}
