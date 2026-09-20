import type { SpecialistMedia } from './specialistMedia';
import { reelVideoUrl, reelHlsUrl } from './reelVideoUrl.ts';

export function collectHomeReels(team: { title: string; demo: boolean; media: SpecialistMedia[] }[]) {
  const seen = new Set<string>();
  return team.filter(person => !person.demo).flatMap(person => person.media.flatMap(item => {
    if (!item.video_url || seen.has(item.video_url)) return [];
    seen.add(item.video_url);
    return [{ ...item, video_url: reelVideoUrl(item.video_url), hls_url: reelHlsUrl(item.video_url), author: person.title }];
  }));
}
