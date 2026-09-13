/**
 * Creates two Flows that call the rebuild receiver:
 *   1. «Автопубликация» — after any create/update/delete in content collections (non-blocking).
 *   2. «Опубликовать сайт» — manual button in every content collection.
 * Requires FLOWS_ENV_ALLOW_LIST=REBUILD_URL,REBUILD_TOKEN in Directus .env.
 * Run: node directus/setup/flows.mjs
 */
import { get, post, patch, log } from './lib.mjs';
import { contentCollections } from './collections.mjs';

const request = (flowId, name) => ({
  flow: flowId,
  name,
  key: 'call_rebuild',
  type: 'request',
  position_x: 19,
  position_y: 1,
  options: {
    method: 'POST',
    url: '{{$env.REBUILD_URL}}',
    headers: [
      { header: 'X-Rebuild-Token', value: '{{$env.REBUILD_TOKEN}}' },
      { header: 'Content-Type', value: 'application/json' },
    ],
    body: '{"triggered_by":"{{$trigger.collection}}"}',
  },
});

async function ensureFlow(name, flowBody) {
  const found = (await get(`/flows?filter[name][_eq]=${encodeURIComponent(name)}`))[0];
  if (found) {
    await patch(`/flows/${found.id}`, flowBody);
    return found;
  }
  log('create flow', name);
  const flow = await post('/flows', { name, ...flowBody });
  const op = await post('/operations', request(flow.id, 'Запрос на пересборку'));
  await patch(`/flows/${flow.id}`, { operation: op.id });
  return flow;
}

async function main() {
  await ensureFlow('Автопубликация', {
    icon: 'autorenew',
    color: '#aa892f',
    description: 'Пересобирает сайт через ~20 секунд после любого изменения контента',
    status: 'active',
    trigger: 'event',
    accountability: 'all',
    options: { type: 'action', scope: ['items.create', 'items.update', 'items.delete', 'items.sort'], collections: contentCollections },
  });
  await ensureFlow('Опубликовать сайт', {
    icon: 'publish',
    color: '#aa892f',
    description: 'Ручной запуск публикации',
    status: 'active',
    trigger: 'manual',
    accountability: 'all',
    options: { collections: contentCollections, requireSelection: false, requireConfirmation: true, confirmationDescription: 'Пересобрать и опубликовать сайт?' },
  });
  log('flows applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
