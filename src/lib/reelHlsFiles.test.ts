import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheReelHls } from './reelHlsFiles.ts';

test('HLS build emits aligned short segments and reuses complete packages', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reel-hls-'));
  try {
    const input = join(dir, 'input.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '4.5', '-c:v', 'libx264', '-threads', '1', '-c:a', 'aac', input]);
    const target = await cacheReelHls(input, 'clip-hls-v1', dir);
    const master = await readFile(join(target, 'master.m3u8'), 'utf8');
    assert.match(master, /avc1\.4d401f,mp4a\.40\.2/);
    for (const variant of ['low', 'high']) {
      const playlist = await readFile(join(target, variant, 'index.m3u8'), 'utf8');
      assert.deepEqual([...playlist.matchAll(/#EXTINF:([\d.]+)/g)].map(m => Number(m[1])), [2, 2, .5]);
      assert.match(playlist, /#EXT-X-ENDLIST/);
      const fragment = await readFile(join(target, variant, 'segment-0000.m4s'));
      assert.ok(fragment.includes(Buffer.from('moof')));
      assert.ok(fragment.length < 250000, 'short startup segment');
    }
    const before = (await stat(join(target, 'master.m3u8'))).mtimeMs;
    assert.equal(await cacheReelHls('/missing-input', 'clip-hls-v1', dir), target);
    assert.equal((await stat(join(target, 'master.m3u8'))).mtimeMs, before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
