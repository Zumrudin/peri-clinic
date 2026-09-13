import { bySort } from './directus.ts';
import { directusImage } from './media.ts';

/** "Производитель, Страна" chip text for a device card — omits whichever half is missing. */
export function deviceChip(manufacturer?: string | null, country?: string | null): string {
  return [manufacturer, country].filter(Boolean).join(', ');
}

export async function getAllDevices() {
  // Deferred (not a static top-level import like every other src/lib/*Content.ts) because astro:content
  // is a Vite/Astro virtual module that plain `node --test` cannot resolve, and this file now also exports
  // the pure deviceChip() tested directly by node --test in deviceContent.test.ts.
  const { getCollection } = await import('astro:content');
  const [devices, procedures] = await Promise.all([getCollection('allDevices'), getCollection('procedures')]);
  const publishedSlugs = new Set(procedures.map(({ data }) => data.slug));
  return bySort(devices).map(({ data: d }) => ({
    id: d.id,
    name: d.name,
    short: d.short || '',
    chip: deviceChip(d.manufacturer, d.country),
    image: directusImage(d.image),
    href: d.procedure?.status === 'published' && publishedSlugs.has(d.procedure.slug) ? `/${d.procedure.slug}` : undefined,
  }));
}
