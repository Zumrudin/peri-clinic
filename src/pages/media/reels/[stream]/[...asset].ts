import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cacheVideo, videoFileName, type VideoFile } from '../../../../lib/videoFiles';
import { cacheReelHls } from '../../../../lib/reelHlsFiles';
import { reelHlsUrl } from '../../../../lib/reelVideoUrl';
import { directusUrl, directusToken } from '../../../../lib/directus';

export async function getStaticPaths() {
  const files = new Map<string, VideoFile>();
  for (const { data: person } of await getCollection('specialists')) {
    if (!person.image?.id || person.is_demo) continue;
    for (const item of person.media_items || []) {
      if (item.title.trim() && item.video) {
        const stream = reelHlsUrl(`/media/specialists/${videoFileName(item.video)}`)!.split('/')[3];
        files.set(stream, item.video);
      }
    }
  }
  const paths = [];
  for (const [stream, video] of files) {
    const input = await cacheVideo(video, { baseUrl: directusUrl(), token: directusToken(), cacheDir: process.env.VIDEO_CACHE_DIR || resolve('.cache/specialist-videos') });
    const directory = await cacheReelHls(input, stream, process.env.REEL_HLS_CACHE_DIR || resolve('.cache/reel-hls'));
    for (const asset of await readdir(directory, { recursive: true })) {
      if (!/\.(m3u8|mp4|m4s)$/.test(asset)) continue;
      paths.push({ params: { stream, asset }, props: { path: join(directory, asset), playlist: asset.endsWith('.m3u8') } });
    }
  }
  return paths;
}
export async function GET({ props }: APIContext) {
  return new Response(new Uint8Array(await readFile(props.path)), { headers: { 'Content-Type': props.playlist ? 'application/vnd.apple.mpegurl' : 'video/mp4' } });
}
