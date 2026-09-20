import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectHomeReels } from './homeReels.ts';
import { reelVideoUrl, reelHlsUrl } from './reelVideoUrl.ts';

test('mobile encodes are versioned and only replace owned specialist files', () => {
  assert.equal(reelVideoUrl('/media/specialists/abcd-1234.mp4'), '/media/reels/abcd-1234-mobile-v1.mp4');
  assert.equal(reelVideoUrl('/media/specialists/abcd-1234.webm'), '/media/reels/abcd-1234-mobile-v1.mp4');
  assert.equal(reelVideoUrl('https://example.com/clip.mp4'), 'https://example.com/clip.mp4');
});

test('independent feed respects publication and manual order, retains reused files', () => {
  const video = { id: 'file', type: 'video/mp4', filesize: 100 };
  const item = { id: 1, title: 'Подпись', status: 'published', video, sort: 10 };
  const items = selectHomeReels([
    item, { ...item, id: 2, sort: 1, status: 'draft' }, { ...item, id: 3, sort: 2 },
    { ...item, id: 4, video: null }, { ...item, id: 5, title: ' ' },
    { ...item, id: 6, sort: null }, { ...item, id: 7, status: 'archived' },
  ]);
  assert.deepEqual(items.map(i => i.id), [3, 1, 6]);
  assert.deepEqual(selectHomeReels([]), []);
});

test('HLS packages are versioned and external videos keep native delivery', () => {
  assert.equal(reelHlsUrl('/media/specialists/abcd-1234.mp4'), '/media/reels/abcd-1234-hls-v1/master.m3u8');
  assert.equal(reelHlsUrl('https://example.com/clip.mp4'), undefined);
});
