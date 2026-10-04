import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheReelPoster, cacheReelVideo } from './reelVideoFiles.ts';

const clip = (path: string, size: string) => execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=30`, '-t', '1', '-c:v', 'libx264', '-threads', '1', path]);
const dimensions = (path: string) => {
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', path], { encoding: 'utf8' }));
  return [info.streams[0].width, info.streams[0].height];
};

test('posters are small WebP frames, never upscaled, and reused once published', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reel-poster-'));
  try {
    clip(join(dir, 'tall.mp4'), '720x1280');
    clip(join(dir, 'small.mp4'), '360x640');
    const poster = await cacheReelPoster(join(dir, 'tall.mp4'), 'tall-poster-v1.webp', dir);
    const bytes = await readFile(poster);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.deepEqual(dimensions(poster), [540, 960]);
    assert.deepEqual(dimensions(await cacheReelPoster(join(dir, 'small.mp4'), 'small-poster-v1.webp', dir)), [360, 640]);
    const before = (await stat(poster)).mtimeMs;
    assert.equal(await cacheReelPoster('/missing-input', 'tall-poster-v1.webp', dir), poster);
    assert.equal((await stat(poster)).mtimeMs, before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('mobile encodes stay H.264 MP4 capped at 540 px', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reel-video-'));
  try {
    clip(join(dir, 'tall.mp4'), '720x1280');
    const video = await cacheReelVideo(join(dir, 'tall.mp4'), 'tall-mobile-v1.mp4', dir);
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width', '-of', 'json', video], { encoding: 'utf8' }));
    assert.deepEqual([info.streams[0].codec_name, info.streams[0].width], ['h264', 540]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
