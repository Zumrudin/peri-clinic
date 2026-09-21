import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validateMasks, overlaySvg } from '../src/geometry.js';
const mask = { x: .5, y: .3, width: .5, height: .2, angle: 0 };
test('Rejects empty, oversized, malformed and injected coordinates', () => {
  for (const masks of [[], Array(13).fill(mask), [{ ...mask, x: NaN }], [{ ...mask, height: 0 }], [{ ...mask, angle: '<svg>' }], [{ ...mask, x: 2 }], null]) assert.throws(() => validateMasks(masks));
  assert.deepEqual(validateMasks([mask, { ...mask, angle: -25 }]), [mask, { ...mask, angle: -25 }]);
});
test('Strip overwrites pixels opaquely and preserves pixels outside it', async () => {
  const { data, info } = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ff0000' } }).composite([{ input: Buffer.from(overlaySvg([mask], 400, 300)) }]).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
  assert.deepEqual(pixel(110, 75), [36, 35, 31]);
  assert.deepEqual(pixel(10, 10), [255, 0, 0]);
});
test('Multiple rotated strips render at full image dimensions', async () => {
  const { info } = await sharp(Buffer.from(overlaySvg([mask, { ...mask, x: .8, y: .7, angle: 45 }], 1200, 800))).png().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1200); assert.equal(info.height, 800);
});
