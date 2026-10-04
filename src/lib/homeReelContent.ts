import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import { selectHomeReels } from './homeReels';
import { videoFileName } from './videoFiles';
import { reelVideoUrl, reelHlsUrl, reelPosterUrl } from './reelVideoUrl';
import { directusImage } from './media';

export async function getHomeReels() {
  const items = selectHomeReels((await getCollection('homeReels')).map(entry => entry.data));
  return prepareReels(items);
}

export async function prepareReels(items: Array<{ title: string; description?: string | null; video?: import('./videoFiles').VideoFile | null; image?: { id: string; width?: number | null; height?: number | null } | null }>) {
  return Promise.all(items.map(async item => {
    const source = `/media/specialists/${videoFileName(item.video!)}`;
    const image = directusImage(item.image);
    const poster = image ? await getImage({ src: image.src, width: 540, height: Math.round(image.height * 540 / image.width), format: 'webp' }) : undefined;
    // Without an editor cover, the build's first frame keeps waiting cards from looking empty.
    return { title: item.title, author: item.description || '', video_url: reelVideoUrl(source), hls_url: reelHlsUrl(source), image_url: poster?.src ?? reelPosterUrl(source) };
  }));
}
