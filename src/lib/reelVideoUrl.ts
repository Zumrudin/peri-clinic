// Version the encoding profile separately from the original CMS file.
export const reelEncodingVersion = 'mobile-v1';
const ownedName = (url: string) => url.match(/^\/media\/specialists\/([a-f0-9-]+)\.(?:mp4|webm|mov)$/i)?.[1];

export function reelVideoUrl(url: string): string {
  const name = ownedName(url);
  return name ? `/media/reels/${name}-${reelEncodingVersion}.mp4` : url;
}

export function reelHlsUrl(url: string): string | undefined {
  const name = ownedName(url);
  return name ? `/media/reels/${name}-hls-v1/master.m3u8` : undefined;
}

// Not under /media/reels/: nginx narrows MIME types there to the streams, a WebP would leave as octet-stream.
export function reelPosterUrl(url: string): string | undefined {
  const name = ownedName(url);
  return name ? `/media/posters/${name}-v1.webp` : undefined;
}
