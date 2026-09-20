import type { VideoFile } from './videoFiles';

/** Preserve explicitly configured cards, even if editors reuse a file with another caption. */
export function selectHomeReels<T extends { id: number; status: string; sort?: number | null; title: string; video?: VideoFile | null }>(items: T[]) {
  return items.filter(item => item.status === 'published' && item.title.trim() && item.video)
    .sort((a, b) => (a.sort ?? Infinity) - (b.sort ?? Infinity) || a.id - b.id);
}
