/** Apply only at an authorized release, before building this branch. Does not publish content. */
import { get, post, patch, log } from './lib.mjs';
import { collections } from './collections.mjs';
const definition = collections.find(c => c.collection === 'specialist_media');
if (!(await get('/collections/specialist_media', { ok404: true }))) {
  await post('/collections', { collection: definition.collection, meta: definition.meta, schema: {}, fields: [definition.fields[0]] });
}
const existing = await get('/fields/specialist_media');
for (const field of definition.fields.filter(f => f.field !== 'id')) {
  if (existing.some(f => f.field === field.field)) await patch(`/fields/specialist_media/${field.field}`, { meta: field.meta });
  else await post('/fields/specialist_media', field);
}
// Keep experimental Telegram data for rollback, but remove it from the editor form.
if (existing.some(f => f.field === 'telegram_url')) await patch('/fields/specialist_media/telegram_url', { meta: { hidden: true, readonly: true } });
const parent = collections.find(c => c.collection === 'specialists');
const parentFields = await get('/fields/specialists');
for (const name of ['media_items', 'media']) {
  const field = parent.fields.find(f => f.field === name);
  if (parentFields.some(f => f.field === name)) await patch(`/fields/specialists/${name}`, { meta: field.meta });
  else await post('/fields/specialists', field);
}
const relations = await get('/relations');
for (const [field, related, meta] of [['specialist', 'specialists', { one_field: 'media_items', sort_field: 'sort' }], ['image', 'directus_files', {}], ['video', 'directus_files', {}]]) {
  if (!relations.some(r => r.collection === 'specialist_media' && r.field === field)) await post('/relations', {
    collection: 'specialist_media', field, related_collection: related,
    schema: { on_delete: field === 'specialist' ? 'CASCADE' : 'SET NULL' }, meta: { ...meta, one_deselect_action: field === 'specialist' ? 'delete' : 'nullify' },
  });
}
for (const policy of await get('/policies?limit=-1')) {
  if (policy.name !== 'Редактор: контент' && !policy.name.startsWith('Builder')) continue;
  const permissions = await get(`/permissions?filter[policy][_eq]=${policy.id}&limit=-1`);
  for (const action of policy.name.startsWith('Builder') ? ['read'] : ['read','create','update','delete']) {
    if (!permissions.some(p => p.collection === 'specialist_media' && p.action === action)) await post('/permissions', { policy: policy.id, collection: 'specialist_media', action, fields: ['*'], permissions: {}, validation: {} });
  }
}
for (const flow of await get('/flows?limit=-1')) {
  if (!['Автопубликация', 'Опубликовать сайт'].includes(flow.name)) continue;
  if (!Array.isArray(flow.options?.collections)) throw new Error(`Unexpected flow options: ${flow.name}`);
  await patch(`/flows/${flow.id}`, { options: { ...flow.options, collections: [...new Set([...flow.options.collections, 'specialist_media'])] } });
}
log('specialist media schema ready; existing media preserved');
