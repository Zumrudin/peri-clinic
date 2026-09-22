import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, importReviews } from './import.mjs';
const row = { id: 'one', author_name: 'Анна', text: 'Спасибо', rating: 4, date: '2026-09-01', source_url: 'https://yandex.ru/maps/org/38588977489/reviews/?reviewId=one' };
test('validates entire batch before writing', async () => {
  let calls = 0;
  await assert.rejects(importReviews([row, { ...row, id: 'two', rating: 6 }], { get: async () => { calls++; return []; }, post: async () => { calls++; } }));
  assert.equal(calls, 0);
});
test('reimport leaves existing editorial decisions untouched', async () => {
  const data = [{ external_id: 'yandex:one', status: 'archived', show_on_home: true }];
  const client = { get: async () => data, post: async (_, record) => data.push(record) };
  assert.deepEqual(await importReviews([row], client), { created: 0, skipped: 1 });
  assert.equal(data[0].status, 'archived');
  const next = { ...row, id: 'two', source_url: row.source_url.replace('=one', '=two') };
  assert.deepEqual(await importReviews([next], client), { created: 1, skipped: 0 });
  assert.equal(data[1].status, 'draft');
  assert.equal(data[1].show_on_home, false);
  assert.deepEqual(await importReviews([next], client), { created: 0, skipped: 1 });
});
test('rejects invalid dates, duplicate IDs and unsafe sources', () => {
  for (const patch of [{ date: '2026-02-30' }, { source_url: 'javascript:alert(1)' }, { source_url: 'https://evil.test/maps/' }]) assert.throws(() => normalize([{ ...row, ...patch }]));
  assert.throws(() => normalize([row, row]));
});
test('widget reviews can share an organization URL without collapsing into one record', async () => {
  const data = [];
  const client = { get: async () => data, post: async (_, record) => data.push(record) };
  const rows = ['one', 'two'].map(id => ({ ...row, id, source_url: 'https://yandex.ru/maps/org/38588977489/reviews/' }));
  assert.deepEqual(await importReviews(rows, client), { created: 2, skipped: 0 });
  assert.deepEqual(await importReviews(rows, client), { created: 0, skipped: 2 });
});
