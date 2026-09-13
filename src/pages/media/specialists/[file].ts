import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cacheVideo, videoFileName, type VideoFile } from '../../../lib/videoFiles';
import { directusUrl, directusToken } from '../../../lib/directus';

export async function getStaticPaths() {
  const files = new Map<string, VideoFile>();
  for (const { data: person } of await getCollection('specialists')) {
    if (!person.image?.id) continue;
    for (const item of person.media_items || []) {
      if (item.title.trim() && item.video) files.set(videoFileName(item.video), item.video);
    }
  }
  return [...files].map(([file, video]) => ({ params: { file }, props: { video } }));
}

// Astro writes these bytes into the release. Visitors never contact Directus or need its token.
export async function GET({ props }: APIContext) {
  const video = props.video as VideoFile;
  const path = await cacheVideo(video, {
    baseUrl: directusUrl(), token: directusToken(),
    cacheDir: process.env.VIDEO_CACHE_DIR || resolve('.cache/specialist-videos'),
  });
  return new Response(new Uint8Array(await readFile(path)), { headers: { 'Content-Type': video.type } });
}
