import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicMediaUrl, normalizeSpecialistMedia } from './specialistMedia.ts';

test('public media URLs exclude executable schemes, credentials and CMS tokens', () => {
  for (const url of ['javascript:alert(1)', '//external.test/a', '/\\external.test/a', 'http://external.test/a', 'https://user:pass@example.com/a', '/assets/a?access_token=secret', 'https://example.com/a?api_key=secret']) assert.equal(publicMediaUrl(url), undefined, url);
  assert.equal(publicMediaUrl('/media/photo.webp'), '/media/photo.webp');
  assert.equal(publicMediaUrl('https://example.com/video.mp4'), 'https://example.com/video.mp4');
});

test('old records and incomplete media are safe; photo/video order is preserved', () => {
  assert.deepEqual(normalizeSpecialistMedia(null), []);
  assert.deepEqual(normalizeSpecialistMedia(undefined), []);
  const items = normalizeSpecialistMedia([
    { title:'Фото', image_url:'/media/photo.webp' },
    null, { title:'Без обложки' },
    { title:'Некорректное видео', image_url:'/media/photo.webp', video_url:'javascript:alert(1)' },
    { title:'Видео', image_url:'/media/poster.webp', video_url:'/media/video.mp4', captions_url:'/media/captions.vtt' },
  ]);
  assert.deepEqual(items.map(item => item.title), ['Фото','Видео']);
  assert.equal(items[1].video_url, '/media/video.mp4');
  assert.equal(items[1].captions_url, '/media/captions.vtt');
});

test('public Telegram posts work without an uploaded cover, including old video fields', () => {
  const items = normalizeSpecialistMedia([
    {title: 'Видео', telegram_url: 'https://t.me/peri_clinic/123?single'},
    {title: 'Старое видео', video_url: 'https://t.me/s/peri_clinic/456'},
    {title: 'Закрытое старое', image_url: '/media/photo.webp', video_url: 'https://t.me/c/123456/12'},
    {title: 'Закрытое', telegram_url: 'https://t.me/c/123456/12'},
    {title: 'Приглашение', telegram_url: 'https://t.me/+abcdef'},
    {title: 'Чужой сайт', telegram_url: 'https://t.me.evil.test/clinic/123'},
    {title: 'Без сообщения', telegram_url: 'https://t.me/peri_clinic'},
  ]);
  assert.deepEqual(items.map(x => x.telegram_post), ['peri_clinic/123', 'peri_clinic/456']);
  assert.ok(items.every(x => !x.video_url));
});
