import { directusUrl, directusToken } from './directus.ts';

export interface DirectusFileRef {
  id: string;
  width?: number | null;
  height?: number | null;
}

/**
 * Maps a Directus file relation (fetched with `.id,.width,.height`) to the shape
 * `astro:assets`' `<Image>`/`<Picture>` expects for a remote source. `src` carries an
 * `access_token` query param because Directus requires auth to read `/assets/:id` and
 * Astro's own remote-image fetch can't send our Authorization header (see directusToken()
 * for why this is safe). `width`/`height` are the file's real dimensions, for components
 * that don't already crop to a fixed design box.
 * Requires the Directus host to be listed in astro.config.mjs `image.remotePatterns`.
 */
export function directusImage(file: DirectusFileRef | null | undefined) {
  if (!file?.id) return null;
  return {
    src: `${directusUrl()}/assets/${file.id}?access_token=${encodeURIComponent(directusToken())}`,
    width: file.width || 1600,
    height: file.height || 1600,
  };
}
