/** Add the optional photo-frame setting without reapplying unrelated schema. */
import { get, post } from './lib.mjs';
import { collections } from './collections.mjs';
const collection = collections.find(c => c.collection === 'before_after_cases');
const fields = await get('/fields/before_after_cases');
if (!fields.some(f => f.field === 'natural_frame')) {
  await post('/fields/before_after_cases', collection.fields.find(f => f.field === 'natural_frame'));
}
console.log('Photo-frame schema ready');
