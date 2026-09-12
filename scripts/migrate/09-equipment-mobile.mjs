/** Add only equipment labels; default dry-run, --apply backs up before writing. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { collections } from '../../directus/setup/collections.mjs';
if (!process.env.DIRECTUS_ADMIN_EMAIL) process.env.DIRECTUS_ADMIN_TOKEN ||= process.env.DIRECTUS_TOKEN;
const { get, post, patch } = await import('../../directus/setup/lib.mjs');

const labels = JSON.parse(await readFile(new URL('./equipment-mobile-content.json', import.meta.url), 'utf8'));
const fields = await get('/fields/home');
const home = await get('/items/home');
const missing = Object.keys(labels).filter(key => !fields.some(field => field.field === key));
const values = Object.fromEntries(Object.entries(labels).filter(([key]) => !home[key]));
console.log({ missingFields: missing, labelsToFill: Object.keys(values), apply: process.argv.includes('--apply') });
if (process.argv.includes('--apply')) {
  const dir = new URL('./out/equipment-mobile-backups/', import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL(`${Date.now()}.json`, dir), JSON.stringify({ home, fields }, null, 2));
  const definition = collections.find(c => c.collection === 'home');
  for (const key of missing) await post('/fields/home', definition.fields.find(f => f.field === key));
  if (Object.keys(values).length) await patch('/items/home', values);
}
