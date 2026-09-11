/** Apply the reviewed legal-page snapshot without touching other CMS content.
 * Run: node --env-file=.env.claude scripts/migrate/06-legal.mjs --apply
 * Without --apply, prints the proposed changes. A backup is saved before writes.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { pages } = JSON.parse(await readFile(new URL('./legal-content.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL;
const token = process.env.DIRECTUS_TOKEN;
if (!base || !token) throw new Error('DIRECTUS_URL and DIRECTUS_TOKEN are required');
async function request(path, method = 'GET', body) {
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}
const existing = await request('/items/pages?limit=-1');
const updates = pages.map(page => ({ page, previous: existing.find(p => p.slug === page.slug) }));
for (const { page, previous } of updates) console.log(`${previous ? 'UPDATE' : 'CREATE'} /${page.slug}: ${page.title}`);
if (process.argv.includes('--apply')) {
  const backupDir = new URL('./out/legal-backups/', import.meta.url);
  await mkdir(backupDir, { recursive: true });
  await writeFile(new URL(`${Date.now()}.json`, backupDir), JSON.stringify(updates, null, 2));
  for (const { page, previous } of updates) {
    const data = previous ? page : { ...page, status: 'published' };
    await request(`/items/pages${previous ? `/${previous.id}` : ''}`, previous ? 'PATCH' : 'POST', data);
    console.log(`Saved /${page.slug}`);
  }
}
