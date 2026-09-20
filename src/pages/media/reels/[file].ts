import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cacheVideo, videoFileName, type VideoFile } from '../../../lib/videoFiles';
import { cacheReelVideo } from '../../../lib/reelVideoFiles';
import { reelVideoUrl } from '../../../lib/reelVideoUrl';
import { directusUrl, directusToken } from '../../../lib/directus';

export async function getStaticPaths() {
  const files = new Map<string, VideoFile>();
  for (const { data: person } of await getCollection('specialists')) {
    if (!person.image?.id || person.is_demo) continue;
    for (const item of person.media_items || []) {
      if (item.title.trim() && item.video) {
        const name = reelVideoUrl(`/media/specialists/${videoFileName(item.video)}`).split('/').pop()!;
        files.set(name, item.video);
      }
    }
  }
  return [...files].map(([file, video]) => ({ params: { file }, props: { video } }));
}
export async function GET({ props, params }: APIContext) {
  const input = await cacheVideo(props.video as VideoFile, {
    baseUrl: directusUrl(), token: directusToken(), cacheDir: process.env.VIDEO_CACHE_DIR || resolve('.cache/specialist-videos'),
  });
  const path = await cacheReelVideo(input, params.file!, process.env.REEL_CACHE_DIR || resolve('.cache/reel-videos'));
  return new Response(new Uint8Array(await readFile(path)), { headers: { 'Content-Type': 'video/mp4' } });
}
