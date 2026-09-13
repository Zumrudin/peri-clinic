/** Seed device manufacturer/country/short and the catalog intro copy; default dry-run, --apply backs up before writing. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { collections } from '../../directus/setup/collections.mjs';
const { get, post, patch } = await import('../../directus/setup/lib.mjs');

const content = JSON.parse(await readFile(new URL('./devices-catalog-content.json', import.meta.url), 'utf8'));

const fields = await get('/fields/home');
const home = await get('/items/home');
const missingFields = Object.keys(content.home).filter((key) => !fields.some((f) => f.field === key));
const homeValues = {
  ...(home.devices_catalog_lead ? {} : { devices_catalog_lead: content.home.devices_catalog_lead }),
  ...(home.devices_catalog_title?.includes('_') ? {} : { devices_catalog_title: content.home.devices_catalog_title }),
};

const devices = await get('/items/devices?limit=-1');
const deviceUpdates = content.devices
  .map(({ name, ...fields }) => {
    const existing = devices.find((d) => d.name === name);
    if (!existing) throw new Error(`Missing device ${name}`);
    const values = Object.fromEntries(Object.entries(fields).filter(([key]) => !existing[key]));
    return { id: existing.id, name, values };
  })
  .filter(({ values }) => Object.keys(values).length);

console.log(JSON.stringify({ missingFields, homeValues, deviceUpdates: deviceUpdates.map(({ name, values }) => ({ name, values })) }, null, 2));
console.log('apply:', process.argv.includes('--apply'));
if (!process.argv.includes('--apply')) process.exit(0);

const dir = new URL('./out/devices-catalog-backups/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, dir), JSON.stringify({ home, devices }, null, 2));

const homeDefinition = collections.find((c) => c.collection === 'home');
for (const key of missingFields) await post('/fields/home', homeDefinition.fields.find((f) => f.field === key));
if (Object.keys(homeValues).length) await patch('/items/home', homeValues);
for (const { id, values } of deviceUpdates) await patch(`/items/devices/${id}`, values);
console.log(`Patched home + ${deviceUpdates.length} device(s).`);
