/**
 * Applies directus/setup/collections.mjs to a running Directus (idempotent).
 * Run: node directus/setup/schema.mjs
 */
import { get, post, patch, log } from './lib.mjs';
import { collections, groups, relations, fileFields, filesJunctions, folders } from './collections.mjs';

async function ensureCollection(def) {
  const existing = await get(`/collections/${def.collection}`, { ok404: true });
  if (!existing) {
    log('create collection', def.collection);
    await post('/collections', {
      collection: def.collection,
      meta: def.meta,
      schema: def.schema === null ? null : {},
      fields: def.fields ? def.fields.filter((f) => f.field === 'id') : undefined,
    });
  } else {
    await patch(`/collections/${def.collection}`, { meta: def.meta });
  }
  if (!def.fields) return;
  const have = new Set((await get(`/fields/${def.collection}`)).map((f) => f.field));
  for (const fld of def.fields) {
    if (fld.field === 'id') continue;
    if (have.has(fld.field)) {
      await patch(`/fields/${def.collection}/${fld.field}`, { meta: fld.meta });
    } else {
      log('  add field', `${def.collection}.${fld.field}`);
      await post(`/fields/${def.collection}`, fld);
    }
  }
}

async function ensureRelation(collection, field, related, meta) {
  const all = await get('/relations');
  const found = all.find((r) => r.collection === collection && r.field === field);
  const body = {
    collection,
    field,
    related_collection: related,
    meta: { one_field: meta.one_field ?? null, sort_field: meta.sort_field ?? null, one_deselect_action: 'nullify' },
    schema: { on_delete: 'SET NULL' },
  };
  if (found) {
    await patch(`/relations/${collection}/${field}`, { meta: body.meta });
  } else {
    log('create relation', `${collection}.${field} → ${related}`);
    await post('/relations', body);
  }
}

async function ensureFilesJunction(collection, field) {
  const junction = `${collection}_files`;
  const existing = await get(`/collections/${junction}`, { ok404: true });
  if (!existing) {
    log('create junction', junction);
    await post('/collections', {
      collection: junction,
      meta: { hidden: true, icon: 'import_export' },
      schema: {},
      fields: [
        { field: 'id', type: 'integer', meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
        { field: `${collection}_id`, type: 'integer', meta: { hidden: true }, schema: {} },
        { field: 'directus_files_id', type: 'uuid', meta: { hidden: true }, schema: {} },
        { field: 'sort', type: 'integer', meta: { hidden: true }, schema: {} },
      ],
    });
    await post('/relations', {
      collection: junction,
      field: `${collection}_id`,
      related_collection: collection,
      meta: { one_field: field, sort_field: 'sort', junction_field: 'directus_files_id', one_deselect_action: 'delete' },
      schema: { on_delete: 'CASCADE' },
    });
    await post('/relations', {
      collection: junction,
      field: 'directus_files_id',
      related_collection: 'directus_files',
      meta: { junction_field: `${collection}_id`, one_deselect_action: 'nullify' },
      schema: { on_delete: 'CASCADE' },
    });
  }
}

async function ensureFolders() {
  const existing = await get('/folders?limit=-1');
  const names = new Set(existing.map((f) => f.name));
  for (const name of folders) {
    if (!names.has(name)) {
      log('create folder', name);
      await post('/folders', { name });
    }
  }
}

async function main() {
  for (const g of groups) {
    const ex = await get(`/collections/${g.collection}`, { ok404: true });
    if (!ex) {
      log('create group', g.collection);
      await post('/collections', g);
    } else {
      await patch(`/collections/${g.collection}`, { meta: g.meta });
    }
  }
  for (const def of collections) await ensureCollection(def);
  for (const [c, fld, related, meta] of relations) await ensureRelation(c, fld, related, meta);
  for (const [c, fld] of fileFields) {
    const all = await get('/relations');
    if (!all.find((r) => r.collection === c && r.field === fld)) {
      log('file relation', `${c}.${fld}`);
      await post('/relations', { collection: c, field: fld, related_collection: 'directus_files', schema: { on_delete: 'SET NULL' } });
    }
  }
  for (const [c, fld] of filesJunctions) await ensureFilesJunction(c, fld);
  await ensureFolders();
  await patch('/settings', {
    project_name: 'PERI CLINIC',
    project_color: '#aa892f',
    default_language: 'ru-RU',
    project_descriptor: 'Управление сайтом',
  });
  log('schema applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
