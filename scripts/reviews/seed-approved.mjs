/** One-time promotion of the five reviews approved on dev; repeat runs preserve editor changes. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { get, post, patch } from '../../directus/setup/lib.mjs';
import { normalize } from './import.mjs';
const data = JSON.parse(await readFile(new URL('./approved-reviews.json', import.meta.url), 'utf8'));
normalize(data.reviews.map(r => ({ ...r, id: r.external_id.replace(/^yandex:/, '') })));
if (!process.argv.includes('--apply')) {
  console.log({ validated: data.reviews.length, dryRun: true });
} else {
  const home = await get('/items/home');
  const before = await get('/items/reviews?limit=-1');
  const fields = await get('/fields/reviews');
  const backup = resolve(process.env.REVIEWS_BACKUP_DIR || 'scripts/migrate/out/reviews-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(backup, { recursive: true, mode: 0o700 });
  await writeFile(`${backup}/before.json`, JSON.stringify({ home, reviews: before, fields }, null, 2), { mode: 0o600 });
  await import('./setup.mjs');
  let created = 0;
  for (const review of data.reviews) {
    if (before.some(r => r.external_id === review.external_id || (r.source === review.source && r.author_name === review.author_name && r.text === review.text))) continue;
    await post('/items/reviews', review);
    created++;
  }
  const platforms = home.reviews_platforms || [];
  const missing = data.platforms.filter(p => !platforms.some(existing => existing.label === p.label));
  if (missing.length) await patch('/items/home', { reviews_platforms: [...platforms, ...missing] });
  const after = await get('/items/reviews?limit=-1');
  for (const original of before) {
    const current = after.find(r => r.id === original.id);
    if (!current || Object.entries(original).some(([k, v]) => JSON.stringify(current[k]) !== JSON.stringify(v))) throw new Error(`Existing review changed: ${original.id}`);
  }
  for (const approved of data.reviews) {
    if (!after.some(r => r.external_id === approved.external_id || (r.source === approved.source && r.author_name === approved.author_name && r.text === approved.text))) throw new Error('Review missing after import');
  }
  console.log({ created, skipped: data.reviews.length - created, backup });
}
