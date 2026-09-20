/** Additive migration: preserves editor values and existing specialist media. */
import { get, post, log } from './lib.mjs';
import { collections } from './collections.mjs';

const existing = await get('/fields/clinic_about');
for (const field of collections.find(c => c.collection === 'clinic_about').fields.filter(f => f.field.startsWith('reels_'))) {
  if (!existing.some(f => f.field === field.field)) await post('/fields/clinic_about', field);
}
log('Mobile reels text fields ready. Videos come from published specialists.');
