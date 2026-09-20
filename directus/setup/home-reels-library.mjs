/** Add independent homepage video curation; seed current uploaded reels only on first creation. */
import { mkdir, writeFile } from 'node:fs/promises';
import { get, post, patch, log } from './lib.mjs';
import { collections } from './collections.mjs';
const name = 'home_reels';
const definition = collections.find(c => c.collection === name);
const exists = await get(`/collections/${name}`, { ok404: true });
let source;
if (!exists) {
  source = await get('/items/specialists?fields=id,name,sort,is_demo,status,image,media_items.*&sort=sort,id&limit=-1');
  const directory = process.env.REELS_BACKUP_DIR || `scripts/migrate/out/reels-library-${Date.now()}`;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/specialists-before.json`, JSON.stringify(source, null, 2), { mode: 0o600 });
  await post('/collections', { collection: name, meta: definition.meta, schema: {}, fields: [definition.fields[0]] });
}
const existingFields = await get(`/fields/${name}`);
for (const field of definition.fields.slice(1)) {
  if (!existingFields.some(f => f.field === field.field)) await post(`/fields/${name}`, field);
}
const relations = await get('/relations');
for (const field of ['video', 'image']) {
  if (!relations.some(r => r.collection === name && r.field === field)) await post('/relations', {
    collection: name, field, related_collection: 'directus_files', schema: { on_delete: 'SET NULL' }, meta: { one_deselect_action: 'nullify' },
  });
}
for (const policy of await get('/policies?limit=-1')) {
  if (policy.name !== 'Редактор: контент' && !policy.name.startsWith('Builder')) continue;
  const permissions = await get(`/permissions?filter[policy][_eq]=${policy.id}&limit=-1`);
  for (const action of policy.name.startsWith('Builder') ? ['read'] : ['read', 'create', 'update', 'delete']) {
    if (!permissions.some(p => p.collection === name && p.action === action)) await post('/permissions', { policy: policy.id, collection: name, action, fields: ['*'], permissions: {}, validation: {} });
  }
}
// Do not repopulate a deliberately emptied list when this migration is run again.
if (!exists) {
  const seen = new Set();
  let sort = 1;
  for (const person of source) {
    if (person.status !== 'published' || person.is_demo || !person.image) continue;
    for (const item of [...(person.media_items || [])].sort((a,b) => (a.sort ?? Infinity) - (b.sort ?? Infinity) || a.id - b.id)) {
      if (!item.video || !item.title?.trim() || seen.has(item.video)) continue;
      seen.add(item.video);
      await post(`/items/${name}`, { status: 'published', sort: sort++, title: item.title, description: person.name, video: item.video, image: item.image || person.image });
    }
  }
  log('seeded current uploaded reels', sort - 1);
}
const presets = await get(`/presets?filter[collection][_eq]=${name}&limit=-1`);
if (!presets.some(p => !p.user && !p.role && !p.bookmark)) await post('/presets', {
  collection: name, layout: 'tabular', layout_query: { tabular: { fields: ['sort', 'title', 'description', 'status', 'video'], sort: ['sort'] } },
});
for (const flow of await get('/flows?limit=-1')) {
  if (!['Автопубликация', 'Опубликовать сайт'].includes(flow.name)) continue;
  if (!Array.isArray(flow.options?.collections)) throw new Error(`Unexpected flow options: ${flow.name}`);
  const options = { ...flow.options, collections: [...new Set([...flow.options.collections, name])] };
  if (flow.name === 'Автопубликация') options.scope = [...new Set([...(options.scope || []), 'items.sort'])];
  await patch(`/flows/${flow.id}`, { options });
}
log('Independent homepage video library ready');
