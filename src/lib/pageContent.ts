import { getCollection } from 'astro:content';
import { bySort } from './directus';

export async function getAllPages() {
  return bySort(await getCollection('pages'));
}

export async function getPageBySlug(slug: string) {
  const all = await getAllPages();
  return all.find((p) => p.data.slug === slug) ?? null;
}
