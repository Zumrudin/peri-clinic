import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, rename, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function command(program: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    let output = '', error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-2000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(output) : reject(new Error(`${program} failed (${code}): ${error}`)));
  });
}

/** Publish a complete immutable VOD package atomically; interrupted builds leave no partial cache. */
export async function cacheReelHls(input: string, name: string, directory: string) {
  const target = join(directory, name);
  if (await stat(join(target, 'master.m3u8')).then(s => s.size > 0).catch(() => false)) return target;
  const temporary = `${target}.${randomUUID()}`;
  await mkdir(temporary, { recursive: true });
  try {
    const master = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
    for (const profile of [
      { name: 'low', width: 360, rate: '280k', buffer: '560k', bandwidth: 340000 },
      { name: 'high', width: 540, rate: '700k', buffer: '1400k', bandwidth: 800000 },
    ]) {
      const variant = join(temporary, profile.name);
      await mkdir(variant);
      await command('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', input,
        '-map', '0:v:0', '-map', '0:a:0?', '-vf', `scale=min(${profile.width}\\,iw):-2`,
        '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '26', '-profile:v', 'main', '-level:v', '3.1',
        '-maxrate', profile.rate, '-bufsize', profile.buffer, '-pix_fmt', 'yuv420p', '-r', '30',
        '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-force_key_frames', 'expr:gte(t,n_forced*2)',
        '-c:a', 'aac', '-b:a', '48k', '-ac', '1', '-map_metadata', '-1',
        '-f', 'hls', '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4',
        '-hls_flags', 'independent_segments', '-hls_fmp4_init_filename', 'init.mp4',
        '-hls_segment_filename', join(variant, 'segment-%04d.m4s'), join(variant, 'index.m3u8')]);
      const init = await readFile(join(variant, 'init.mp4'));
      const avc = init.indexOf(Buffer.from('avcC'));
      if (avc < 0) throw new Error('Missing AVC initialization data');
      const codec = `avc1.${init.subarray(avc + 5, avc + 8).toString('hex')}`;
      const info = JSON.parse(await command('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', join(variant, 'init.mp4')]));
      const video = info.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
      const audio = info.streams.some((s: { codec_type: string }) => s.codec_type === 'audio');
      master.push(`#EXT-X-STREAM-INF:BANDWIDTH=${profile.bandwidth},RESOLUTION=${video.width}x${video.height},CODECS="${codec}${audio ? ',mp4a.40.2' : ''}"`, `${profile.name}/index.m3u8`);
    }
    await writeFile(join(temporary, 'master.m3u8'), master.join('\n') + '\n');
    await rename(temporary, target);
    return target;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
