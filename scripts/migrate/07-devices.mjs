/** Restructure existing apparatus content and classify previously published gallery photos.
 * Dry run: node --env-file=.env.claude scripts/migrate/07-devices.mjs
 * Apply: add --apply. Original CMS records are backed up before any writes.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { procedures: content } = JSON.parse(await readFile(new URL('./device-content.json', import.meta.url), 'utf8'));
const base = process.env.DIRECTUS_URL;
const token = process.env.DIRECTUS_TOKEN;
if (!base || !token) throw new Error('DIRECTUS_URL and DIRECTUS_TOKEN are required');
async function request(path, method = 'GET', body) {
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}
const [procedures, devices, cases, categories] = await Promise.all([
  request('/items/procedures?fields=*,gallery.id,gallery.directus_files_id&limit=-1'),
  request('/items/devices?limit=-1'), request('/items/before_after_cases?limit=-1'), request('/items/case_categories?limit=-1'),
]);
const category = categories.find(c => c.slug === 'apparatnaya-kosmetologiya');
const updates = content.map(({ device_name, result_files, slug, ...data }) => {
  const previous = procedures.find(p => p.slug === slug);
  if (!previous) throw new Error(`Missing procedure ${slug}`);
  const device = device_name && devices.find(d => d.name === device_name);
  if (device_name && !device) throw new Error(`Missing device ${device_name}`);
  for (const file of result_files) {
    if (!previous.gallery.some(g => g.directus_files_id === file)) throw new Error(`Gallery changed for ${slug}: ${file}`);
  }
  return { previous, data: { ...data, ...(device ? { device: device.id } : {}) }, device, result_files };
});
for (const { previous, result_files, device } of updates) console.log(`UPDATE /${previous.slug}: ${result_files.length} result photos, device ${device?.name || 'existing photos'}`);
if (!process.argv.includes('--apply')) process.exit(0);
const backupDir = new URL('./out/device-backups/', import.meta.url);
await mkdir(backupDir, { recursive: true });
await writeFile(new URL(`${Date.now()}.json`, backupDir), JSON.stringify({ procedures, devices, cases }, null, 2));
for (const { previous, data, device, result_files } of updates) {
  await request(`/items/procedures/${previous.id}`, 'PATCH', data);
  if (device) await request(`/items/devices/${device.id}`, 'PATCH', { procedure: previous.id });
  for (const [index, file] of result_files.entries()) {
    if (cases.some(c => c.procedure === previous.id && c.combined === file)) continue;
    const title = `${data.title} — пример ${index + 1}`;
    const existing = cases.find(c => c.title === title && c.procedure === previous.id);
    const entry = { title, procedure: previous.id, category: category?.id, combined: file, status: 'published', needs_review: false, show_on_home: false, sort: 100 + index, result: 'Пример из материалов о процедуре. Результат индивидуален.' };
    await request(`/items/before_after_cases${existing ? `/${existing.id}` : ''}`, existing ? 'PATCH' : 'POST', entry);
  }
  console.log(`Saved /${previous.slug}`);
}
