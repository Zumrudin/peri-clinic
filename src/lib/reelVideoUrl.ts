// Version the encoding profile separately from the original CMS file.
export const reelEncodingVersion = 'mobile-v1';
export function reelVideoUrl(url: string): string {
  const match = url.match(/^\/media\/specialists\/([a-f0-9-]+)\.(?:mp4|webm)$/i);
  return match ? `/media/reels/${match[1]}-${reelEncodingVersion}.mp4` : url;
}

export function reelHlsUrl(url: string): string | undefined {
  const match = url.match(/^\/media\/specialists\/([a-f0-9-]+)\.(?:mp4|webm)$/i);
  return match ? `/media/reels/${match[1]}-hls-v1/master.m3u8` : undefined;
}
