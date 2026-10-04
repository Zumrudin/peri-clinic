import { getCollection } from 'astro:content';
import { selectHomeReels } from './homeReels';
import { videoFileName, type VideoFile } from './videoFiles';

// Pages share derived streams, including service videos absent from the home selection.
export async function getReelSources(): Promise<VideoFile[]> {
  const files = new Map<string, VideoFile>();
  for (const { data: item } of await getCollection('homeReels')) {
    if (item.status === 'published' && item.title.trim() && item.video) files.set(videoFileName(item.video), item.video);
  }
  for (const { data: person } of await getCollection('specialists')) {
    if (!person.image?.id) continue;
    for (const item of person.media_items || []) {
      if (item.title.trim() && item.video) files.set(videoFileName(item.video), item.video);
    }
  }
  for (const { data: procedure } of await getCollection('procedures')) {
    for (const item of selectHomeReels(procedure.videos || [])) {
      files.set(videoFileName(item.video!), item.video!);
    }
  }
  return [...files.values()];
}
