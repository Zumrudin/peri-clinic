import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bySort } from './directus.ts';

test('CMS order survives entry-ID order, with unassigned positions last', () => {
  const entries = [
    { id: '1', data: { sort: 4 } },
    { id: '2', data: { sort: 1 } },
    { id: '3', data: { sort: null } },
    { id: '4', data: {} },
    { id: '5', data: { sort: 0 } },
  ];
  assert.deepEqual(bySort(entries).map(e => e.id), ['5', '2', '1', '3', '4']);
  assert.deepEqual(entries.map(e => e.id), ['1', '2', '3', '4', '5']);
});
