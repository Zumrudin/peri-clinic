/** Extend existing publication flows without changing their status or other options. Run after seeding. */
import { get, patch, log } from './lib.mjs';
const additions = ['clinic_about', 'clinic_photos', 'specialists'];
for (const flow of await get('/flows?limit=-1')) {
  if (!['Автопубликация', 'Опубликовать сайт'].includes(flow.name)) continue;
  if (!Array.isArray(flow.options?.collections)) throw new Error(`Unexpected collection filter in flow: ${flow.name}`);
  const collections = [...new Set([...flow.options.collections, ...additions])];
  const options = { ...flow.options, collections };
  // Drag-and-drop emits items.sort, not items.update.
  if (flow.name === 'Автопубликация') options.scope = [...new Set([...(options.scope || []), 'items.sort'])];
  if (JSON.stringify(options) !== JSON.stringify(flow.options)) await patch(`/flows/${flow.id}`, { options });
  log('about collections registered in', flow.name);
}
