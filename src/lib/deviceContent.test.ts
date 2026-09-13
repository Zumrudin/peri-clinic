import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceChip } from './deviceContent.ts';

test('deviceChip(): joins manufacturer and country with a comma', () => {
  assert.equal(deviceChip('InMode Ltd.', 'Израиль'), 'InMode Ltd., Израиль');
});

test('deviceChip(): falls back to whichever value is present', () => {
  assert.equal(deviceChip('InMode Ltd.', null), 'InMode Ltd.');
  assert.equal(deviceChip(null, 'Израиль'), 'Израиль');
});

test('deviceChip(): empty string when both are missing', () => {
  assert.equal(deviceChip(null, null), '');
  assert.equal(deviceChip(undefined, undefined), '');
});
