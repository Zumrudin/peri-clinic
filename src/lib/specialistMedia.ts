export interface SpecialistMedia {
  title: string;
  description?: string;
  image_url?: string;
  telegram_post?: string;
  image_alt?: string;
  focus_y?: number;
  video_url?: string;
  captions_url?: string;
}

// Media links are sent to the browser; CMS asset tokens must never appear here.
export function publicMediaUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return;
  const url = value.trim();
  if (/[\s\\]/.test(url)) return;
  if (!/^\/(?!\/)/.test(url) && !/^https:\/\//i.test(url)) return;
  try {
    const parsed = new URL(url, 'https://www.peri-clinic.ru');
    if (parsed.username || parsed.password || [...parsed.searchParams.keys()].some(key => /token|authorization|api[_-]?key/i.test(key))) return;
    return url;
  } catch { return; }
}

/** Accept only public message permalinks, never invites or private /c/ links. */
export function telegramPost(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(url.hostname) || url.port || url.username || url.password) return;
    const match = url.pathname.match(/^\/(?:s\/)?([a-zA-Z][a-zA-Z0-9_]{3,31})\/([1-9]\d*)\/?$/);
    if (!match) return;
    return `${match[1]}/${match[2]}`;
  } catch { return; }
}

export function normalizeSpecialistMedia(value: unknown): SpecialistMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const image_url = publicMediaUrl(item.image_url);
    const telegram_post = telegramPost(item.telegram_url || item.video_url);
    const video_url = telegram_post ? undefined : publicMediaUrl(item.video_url);
    if (item.telegram_url && !telegram_post) return [];
    if (!telegram_post && video_url) {
      const host = new URL(video_url, 'https://www.peri-clinic.ru').hostname;
      if (['t.me', 'telegram.me'].includes(host)) return [];
    }
    // An invalid video link must not silently turn a video into a photo.
    if (!title || (!telegram_post && (!image_url || (item.video_url && !video_url)))) return [];
    return [{ title, image_url, video_url, telegram_post, focus_y: typeof item.focus_y === 'number' && Number.isFinite(item.focus_y) ? Math.max(0,Math.min(100,item.focus_y)) : 50, captions_url: publicMediaUrl(item.captions_url),
      description: typeof item.description === 'string' ? item.description : '',
      image_alt: typeof item.image_alt === 'string' ? item.image_alt : title }];
  });
}
