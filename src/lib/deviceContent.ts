import { getCollection } from 'astro:content';
import { bySort } from './directus';
import { directusImage } from './media';

export async function getAllDevices() {
  const [devices, procedures] = await Promise.all([getCollection('allDevices'), getCollection('procedures')]);
  const publishedSlugs = new Set(procedures.map(({ data }) => data.slug));
  return bySort(devices).map(({ data: d }) => ({
    id: d.id,
    name: d.name,
    short: d.short || '',
    image: directusImage(d.image),
    href: d.procedure?.status === 'published' && publishedSlugs.has(d.procedure.slug) ? `/${d.procedure.slug}` : undefined,
  }));
}
