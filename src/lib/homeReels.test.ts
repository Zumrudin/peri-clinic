import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectHomeReels } from './homeReels.ts';
import { reelVideoUrl, reelHlsUrl } from './reelVideoUrl.ts';

test('mobile encodes are versioned and only replace owned specialist files', () => {
  assert.equal(reelVideoUrl('/media/specialists/abcd-1234.mp4'), '/media/reels/abcd-1234-mobile-v1.mp4');
  assert.equal(reelVideoUrl('/media/specialists/abcd-1234.webm'), '/media/reels/abcd-1234-mobile-v1.mp4');
  assert.equal(reelVideoUrl('https://example.com/clip.mp4'), 'https://example.com/clip.mp4');
});

test('home feed keeps specialist order, excludes photos and demos, deduplicates videos', () => {
  const clip = { title: 'Консультация', video_url: '/video.mp4', image_url: '/poster.webp' };
  const items = collectHomeReels([
    { title: 'Демо', demo: true, media: [{ ...clip, video_url: '/demo.mp4' }] },
    { title: 'Первый врач', demo: false, media: [{ title: 'Фото', image_url: '/photo.webp' }, clip] },
    { title: 'Второй врач', demo: false, media: [clip, { ...clip, video_url: '/second.mp4' }] },
  ]);
  assert.deepEqual(items.map(i => [i.video_url, i.author]), [['/video.mp4', 'Первый врач'], ['/second.mp4', 'Второй врач']]);
  assert.deepEqual(collectHomeReels([]), []);
});

test('HLS packages are versioned and external videos keep native delivery', () => {
  assert.equal(reelHlsUrl('/media/specialists/abcd-1234.mp4'), '/media/reels/abcd-1234-hls-v1/master.m3u8');
  assert.equal(reelHlsUrl('https://example.com/clip.mp4'), undefined);
});
