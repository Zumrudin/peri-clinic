import { getCollection } from 'astro:content';
import { directusImage } from './media';
import { bySort } from './directus';

export async function getAllCategories() {
  return bySort(await getCollection('serviceCategories'));
}

export async function getCategoryBySlug(slug: string) {
  const all = await getAllCategories();
  return all.find((c) => c.data.slug === slug) ?? null;
}

export function categoryCover(cat: Awaited<ReturnType<typeof getCategoryBySlug>>) {
  return cat ? directusImage(cat.data.cover) : null;
}
