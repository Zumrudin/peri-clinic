import { getEntry } from 'astro:content';
import { createHash } from 'node:crypto';

// Mirror CMS-selected media at build time so phones need only the site's origin.
// Content hashes also invalidate cached files when an editor replaces an upload.
let pending: ReturnType<typeof download> | undefined;
async function download() {
  const home = await getEntry('home', 'home');
  const sources = [home?.data.gift_video_url, home?.data.gift_poster_url];
  if (!sources.every(Boolean)) return [];
  return Promise.all(sources.map(async (source, index) => {
    const response = await fetch(source!, { signal: AbortSignal.timeout(60000) });
    const type = response.headers.get('content-type')?.split(';')[0] || '';
    const extensions: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
    if (!response.ok || !extensions[type] || !type.startsWith(index === 0 ? 'video/' : 'image/')) {
      throw new Error(`Gift media download failed: HTTP ${response.status}, ${type}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error('Gift media is empty');
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const file = `${index === 0 ? 'certificate' : 'poster'}-${hash}.${extensions[type]}`;
    return { file, url: `/media/gift/${file}`, type, bytes };
  }));
}
export function getGiftMedia() { return pending ??= download(); }
