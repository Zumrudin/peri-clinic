import type { APIContext } from 'astro';
import { getReelSources } from '../../../lib/reelSources';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cacheVideo, videoFileName, type VideoFile } from '../../../lib/videoFiles';
import { cacheReelPoster } from '../../../lib/reelVideoFiles';
import { reelPosterUrl } from '../../../lib/reelVideoUrl';
import { directusUrl, directusToken } from '../../../lib/directus';

export async function getStaticPaths() {
  const files = new Map<string, VideoFile>();
  for (const video of await getReelSources()) {
    files.set(reelPosterUrl(`/media/specialists/${videoFileName(video)}`)!.split('/').pop()!, video);
  }
  return [...files].map(([file, video]) => ({ params: { file }, props: { video } }));
}
export async function GET({ props, params }: APIContext) {
  const input = await cacheVideo(props.video as VideoFile, {
    baseUrl: directusUrl(), token: directusToken(), cacheDir: process.env.VIDEO_CACHE_DIR || resolve('.cache/specialist-videos'),
  });
  const path = await cacheReelPoster(input, params.file!, process.env.REEL_POSTER_CACHE_DIR || resolve('.cache/reel-posters'));
  return new Response(new Uint8Array(await readFile(path)), { headers: { 'Content-Type': 'image/webp' } });
}
