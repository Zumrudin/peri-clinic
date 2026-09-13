/** Additive migration: node directus/setup/about-schema.mjs. Never seeds demo people into CMS. */
import { get, post, log } from './lib.mjs';
import { collections } from './collections.mjs';
for (const definition of collections.filter(c => ['clinic_photos', 'specialists'].includes(c.collection))) {
  const name = definition.collection;
  if (!(await get(`/collections/${name}`, { ok404: true }))) {
    await post('/collections', { collection: name, meta: definition.meta, schema: {}, fields: [definition.fields[0]] });
  }
  const fields = await get(`/fields/${name}`);
  for (const field of definition.fields) {
    if (!fields.some(f => f.field === field.field)) await post(`/fields/${name}`, field);
  }
  const relations = await get('/relations');
  if (!relations.some(r => r.collection === name && r.field === 'image')) {
    await post('/relations', { collection: name, field: 'image', related_collection: 'directus_files', schema: { on_delete: 'SET NULL' }, meta: { one_deselect_action: 'nullify' } });
  }
  // Extend existing content policies only, preserving all other permissions.
  for (const policy of await get('/policies?limit=-1')) {
    if (!['Редактор: контент', 'Builder: API'].includes(policy.name) && !policy.name.startsWith('Builder')) continue;
    const permissions = await get(`/permissions?filter[policy][_eq]=${policy.id}&limit=-1`);
    for (const action of policy.name.startsWith('Builder') ? ['read'] : ['read', 'create', 'update', 'delete']) {
      if (!permissions.some(p => p.collection === name && p.action === action)) await post('/permissions', { policy: policy.id, collection: name, action, fields: ['*'], permissions: {}, validation: {} });
    }
  }
  log('ready', name);
}
