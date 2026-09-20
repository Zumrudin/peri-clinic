import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** Derived files only: never alter the editor's original upload. Requires ffmpeg. */
export async function cacheReelVideo(input: string, name: string, directory: string) {
  await mkdir(directory, { recursive: true });
  const target = join(directory, name);
  if (await stat(target).then(s => s.size > 0).catch(() => false)) return target;
  const temporary = `${target}.${randomUUID()}.mp4`;
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', input,
        '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=min(540\\,iw):-2',
        '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '26',
        '-maxrate', '700k', '-bufsize', '1400k', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '30',
        '-c:a', 'aac', '-b:a', '48k', '-ac', '1', '-movflags', '+faststart', '-map_metadata', '-1', temporary],
        { stdio: ['ignore', 'ignore', 'pipe'], timeout: 300000 });
      let error = '';
      child.stderr.on('data', chunk => { error = (error + chunk).slice(-2000); });
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`Reel encoding failed (${code}): ${error}`)));
    });
    await rename(temporary, target);
    return target;
  } finally { await rm(temporary, { force: true }); }
}
