/** Extend existing publication flows without changing their status or other options. Run after seeding. */
import { get, patch, log } from './lib.mjs';
const additions = ['clinic_about', 'clinic_photos', 'specialists'];
for (const flow of await get('/flows?limit=-1')) {
  if (!['Автопубликация', 'Опубликовать сайт'].includes(flow.name)) continue;
  if (!Array.isArray(flow.options?.collections)) throw new Error(`Unexpected collection filter in flow: ${flow.name}`);
  const collections = [...new Set([...flow.options.collections, ...additions])];
  if (collections.length !== flow.options.collections.length) await patch(`/flows/${flow.id}`, { options: { ...flow.options, collections } });
  log('about collections registered in', flow.name);
}
