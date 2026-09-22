/** Additive migration; preserve edits when rerun. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { get, post, patch, log } from './lib.mjs';
import { collections } from './collections.mjs';
const existing = await get('/fields/home');
const fields = collections.find(c => c.collection === 'home').fields.filter(f => f.field.startsWith('gift_') || f.field === 'd_gift');
for (const field of fields) {
  if (!existing.some(f => f.field === field.field)) await post('/fields/home', field);
}
const current = await get('/items/home');
const seed = JSON.parse(readFileSync(new URL('./gift-certificate-content.json', import.meta.url), 'utf8'));
const updates = Object.fromEntries(Object.entries(seed).filter(([key]) => current[key] == null));
if (Object.keys(updates).length) {
  const dir = 'scripts/migrate/out/gift-certificate-backups';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${Date.now()}.json`, JSON.stringify(current, null, 2));
  await patch('/items/home', updates);
}
log('Mobile gift certificate fields ready.');
