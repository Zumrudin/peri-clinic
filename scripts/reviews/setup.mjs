/** Targeted schema migration; intentionally leaves unrelated CMS settings alone. */
import { collections } from '../../directus/setup/collections.mjs';
import { get, post, patch } from '../../directus/setup/lib.mjs';
for (const [collection, names] of [['home', ['reviews_platforms']], ['reviews', ['external_id', 'source', 'source_url']]]) {
  const fields = collections.find(c => c.collection === collection).fields;
  const have = await get(`/fields/${collection}`);
  for (const name of names) {
    const field = fields.find(f => f.field === name);
    if (have.some(f => f.field === name)) await patch(`/fields/${collection}/${name}`, { meta: field.meta });
    else await post(`/fields/${collection}`, field);
  }
}
console.log('Review fields ready');
