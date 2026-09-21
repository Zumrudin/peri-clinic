/** Run on the CMS host after installing the bundle. Credentials never leave the process. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const cmsEnv = parseEnv(await readFile(process.env.PERI_CMS_ENV || '/srv/peri/directus/.env', 'utf8'));
process.env.DIRECTUS_URL = 'http://127.0.0.1:' + (cmsEnv.PORT || '8055');
process.env.DIRECTUS_ADMIN_TOKEN = '';
process.env.DIRECTUS_ADMIN_EMAIL = cmsEnv.ADMIN_EMAIL;
process.env.DIRECTUS_ADMIN_PASSWORD = cmsEnv.ADMIN_PASSWORD;
const { get } = await import('./lib.mjs');
const extensions = await get('/extensions');
if (!extensions.some(e => e.name === 'directus-extension-peri-photo-mask' || e.schema?.name === 'directus-extension-peri-photo-mask')) {
  throw new Error('Install and enable the PERI photo mask bundle before migrating fields.');
}
const fields = await get('/fields');
const directory = process.env.PERI_MASK_BACKUP_DIR || '/srv/peri/photo-mask-backups';
await mkdir(directory, { recursive: true, mode: 0o700 });
await writeFile(`${directory}/fields-${Date.now()}.json`, JSON.stringify(fields.filter(f => f.meta?.interface === 'file-image'), null, 2), { mode: 0o600 });
await import('./photo-mask-schema.mjs');
const after = await get('/fields');
console.log('Verified photo editor fields:', after.filter(f => f.meta?.interface === 'peri-photo-mask').length);
