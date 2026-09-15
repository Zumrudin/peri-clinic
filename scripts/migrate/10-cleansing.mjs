/** Split cleansing prices from peels, preserving row IDs and all price fields. */
import { mkdir, writeFile } from 'node:fs/promises';

process.loadEnvFile('.env.claude');
process.env.DIRECTUS_ADMIN_TOKEN ||= process.env.DIRECTUS_TOKEN;
const { get, post, patch } = await import('../../directus/setup/lib.mjs');
const slug = 'kosmetologicheskie-chistki';
const names = ['Комбинированная чистка лица', 'Чистка спины, 1 степень', 'Чистка спины, 2 степень'];
const procedures = await get('/items/procedures?limit=-1');
const source = procedures.find(p => p.slug === 'kosemotologicheskie-pilingi');
if (!source) throw new Error('Peels procedure missing');
let target = procedures.find(p => p.slug === slug);
const prices = await get('/items/price_items?limit=-1');
const rows = names.map(name => {
  const matches = prices.filter(p => p.name === name && [source.id, target?.id].includes(p.procedure));
  if (matches.length !== 1) throw new Error(`Expected one price row: ${name}`);
  return matches[0];
});
console.log({ create: !target, move: rows.filter(r => r.procedure !== target?.id).map(r => r.name) });
if (process.argv.includes('--apply')) {
  const dir = new URL('./out/cleansing-backups/', import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL(`${Date.now()}.json`, dir), JSON.stringify({ source, target, rows }, null, 2));
  target ||= await post('/items/procedures', {
    status: 'draft', slug, title: 'Косметологические чистки', category: source.category,
    sort: Math.max(...procedures.filter(p => p.category === source.category).map(p => p.sort || 0)) + 1,
    summary: 'Комбинированная чистка лица и чистки спины.',
    lead: 'Комбинированная чистка лица и чистки спины.',
    show_on_home: false,
  });
  for (const [index, row] of rows.entries()) {
    if (row.procedure !== target.id) await patch(`/items/price_items/${row.id}`, { procedure: target.id, sort: index + 1 });
  }
  if (target.status !== 'published') await patch(`/items/procedures/${target.id}`, { status: 'published' });
  const result = await get(`/items/price_items?filter[procedure][_eq]=${target.id}&sort=sort`);
  if (result.length !== 3 || rows.some(row => !result.some(r => r.id === row.id && r.price === row.price && r.price_head_doctor === row.price_head_doctor))) {
    throw new Error('Cleansing prices verification failed');
  }
  console.log('Verified:', result.map(r => ({ name: r.name, price: r.price })));
}
