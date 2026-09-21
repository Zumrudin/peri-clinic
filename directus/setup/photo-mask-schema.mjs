/** Run after installing the extension. Only changes image interfaces; no content is changed. */
import { get, post, patch, log } from './lib.mjs';
const fields = await get('/fields');
if (!fields.some(f => f.collection === 'directus_files' && f.field === 'peri_eye_edit')) {
  await post('/fields/directus_files', {
    field: 'peri_eye_edit', type: 'json', schema: { is_nullable: true },
    meta: { hidden: true, interface: 'input-code', special: ['cast-json'], note: 'Original and normalized PERI mask coordinates. Managed by the photo editor.' },
  });
}
for (const field of fields) {
  if (!field.collection.startsWith('directus_') && field.meta?.interface === 'file-image') {
    await patch(`/fields/${field.collection}/${field.field}`, { meta: { interface: 'peri-photo-mask' } });
    log('photo editor', `${field.collection}.${field.field}`);
  }
}
log('Photo editor schema ready');
