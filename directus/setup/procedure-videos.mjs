/** Add only procedure-video schema, permissions and publication hooks. Idempotent. */
import { get, post, patch } from './lib.mjs';
import { collections, relations, fileFields } from './collections.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const name = 'procedure_videos';
const backup = new URL(`../../scripts/migrate/out/procedure-video-backups/${Date.now()}/`, import.meta.url);
await mkdir(backup, { recursive: true });
const [fields, existingRelations, permissions, flows] = await Promise.all([
  get('/fields/procedures'), get('/relations'), get('/permissions?limit=-1'), get('/flows?limit=-1'),
]);
await writeFile(new URL('before.json', backup), JSON.stringify({ fields, existingRelations, permissions, flows }, null, 2));
const def = collections.find(c => c.collection === name);
if (!(await get('/collections')).some(c => c.collection === name)) {
  await post('/collections', { collection: name, meta: def.meta, schema: {}, fields: def.fields });
}
const procedure = collections.find(c => c.collection === 'procedures');
for (const field of procedure.fields.filter(f => ['videos_title', 'videos'].includes(f.field))) {
  if (!fields.some(f => f.field === field.field)) await post('/fields/procedures', field);
}
for (const [collection, field, related_collection, meta] of relations.filter(r => r[0] === name)) {
  if (!existingRelations.some(r => r.collection === collection && r.field === field)) {
    await post('/relations', { collection, field, related_collection, meta: { one_field: meta.one_field, sort_field: meta.sort_field, one_deselect_action: meta.one_deselect_action }, schema: { on_delete: meta.on_delete } });
  }
}
for (const [collection, field] of fileFields.filter(r => r[0] === name)) {
  if (!existingRelations.some(r => r.collection === collection && r.field === field)) {
    await post('/relations', { collection, field, related_collection: 'directus_files', schema: { on_delete: 'SET NULL' } });
  }
}
const policies = await get('/policies?limit=-1');
for (const policy of policies.filter(p => ['Редактор: контент', 'Builder: сборка сайта'].includes(p.name))) {
  for (const action of policy.name.startsWith('Редактор') ? ['read', 'create', 'update', 'delete'] : ['read']) {
    if (!permissions.some(p => p.policy === policy.id && p.collection === name && p.action === action)) {
      await post('/permissions', { policy: policy.id, collection: name, action, fields: ['*'], permissions: {}, validation: {}, presets: null });
    }
  }
}
for (const flow of flows.filter(f => ['Автопубликация', 'Опубликовать сайт'].includes(f.name))) {
  if (!flow.options.collections.includes(name)) await patch(`/flows/${flow.id}`, { options: { ...flow.options, collections: [...flow.options.collections, name] } });
}
console.log('Procedure video fields, relations, editor/builder permissions and publication hooks applied.');
