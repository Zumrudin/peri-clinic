/** Complete the existing /pladuo page and link its catalog device.
 * node --env-file=.env.claude scripts/migrate/11-pladuo.mjs [--apply]
 * Content comes from the archived clinic page; hardware details checked against sources in JSON.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const content = JSON.parse(await readFile(new URL('./pladuo-content.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_TOKEN;
if (!base || !token) throw new Error('DIRECTUS_URL and DIRECTUS_TOKEN are required');
async function request(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}
const [procedures, devices, faq, image] = await Promise.all([
  request('/items/procedures?filter[slug][_eq]=pladuo&fields=*,gallery.*'),
  request('/items/devices?limit=-1'),
  request('/items/faq_items?filter[procedure][slug][_eq]=pladuo&limit=-1'),
  request(`/files/${content.device.image}`),
]);
if (procedures.length !== 1) throw new Error('Expected exactly one existing /pladuo procedure');
if (!image.width || !image.height) throw new Error('Missing catalog image dimensions');
const previous = procedures[0];
const matches = devices.filter(d => d.name.toLowerCase() === 'pladuo');
if (matches.length > 1) throw new Error('Duplicate Pladuo devices');
const existing = matches[0];
const deviceValues = { ...content.device, procedure: previous.id, sort: existing?.sort ?? Math.max(0, ...devices.map(d => d.sort || 0)) + 1 };
const changed = (record, values) => Object.fromEntries(Object.entries(values).filter(([key, value]) => JSON.stringify(record?.[key]) !== JSON.stringify(value)));
console.log(JSON.stringify({ device: existing ? 'update' : 'create', slug: previous.slug, procedureFields: Object.keys(changed(previous, content.procedure)), faq: content.faq.length, apply: process.argv.includes('--apply') }, null, 2));
if (!process.argv.includes('--apply')) process.exit(0);
const dir = new URL('./out/pladuo-backups/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, dir), JSON.stringify({ procedure: previous, devices, faq }, null, 2));
let device = existing;
if (!device) device = await request('/items/devices', 'POST', deviceValues);
else {
  const values = changed(device, deviceValues);
  if (Object.keys(values).length) await request(`/items/devices/${device.id}`, 'PATCH', values);
}
const values = changed(previous, { ...content.procedure, device: device.id });
if (Object.keys(values).length) await request(`/items/procedures/${previous.id}`, 'PATCH', values);
for (const [index, entry] of content.faq.entries()) {
  const found = faq.find(f => f.question === entry.question);
  const values = changed(found, { ...entry, procedure: previous.id, scope: 'procedure', status: 'published', sort: index + 1 });
  if (Object.keys(values).length) await request(`/items/faq_items${found ? `/${found.id}` : ''}`, found ? 'PATCH' : 'POST', values);
}
console.log('Pladuo catalog device, procedure and FAQ saved.');
