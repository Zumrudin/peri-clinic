import { getCollection, getEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { bySort } from './directus';
import { directusImage } from './media';
import reception from '../assets/about/reception.webp';
import cabinet from '../assets/about/cabinet.webp';
import waiting from '../assets/about/waiting.webp';
import portrait1 from '../assets/about/specialist-1.webp';
import portrait2 from '../assets/about/specialist-2.webp';
import portrait3 from '../assets/about/specialist-3.webp';

export interface GalleryItem { id: string; title: string; alt: string; thumbnail: string; full: string; width: number; height: number; focus: number; demo: boolean; }
export interface Specialist extends GalleryItem { slug: string; role: string; body: string; seoTitle: string; seoDescription: string; }
export const aboutDemo = (import.meta.env.ABOUT_DEMO ?? process.env.ABOUT_DEMO) === 'true';
async function picture(src: ImageMetadata | string, width: number, height: number) {
  const [thumb, full] = await Promise.all([getImage({ src, width: Math.min(width, 700), height: Math.round(height * Math.min(width, 700) / width), format: 'webp' }), getImage({ src, width: Math.min(width, 1800), height: Math.round(height * Math.min(width, 1800) / width), format: 'webp' })]);
  return { thumbnail: thumb.src, full: full.src, width, height };
}
export async function getClinicPhotos(): Promise<GalleryItem[]> {
  const entries = bySort(aboutDemo ? [] : await getCollection('clinicPhotos')).filter(e => e.data.image?.id);
  if (entries.length || !aboutDemo) return Promise.all(entries.map(async ({data:p}) => {
    const img = directusImage(p.image)!;
    return { id: String(p.id), title: p.title, alt: p.image_alt || p.title, ...await picture(img.src, img.width, img.height), focus: 50, demo: p.is_demo };
  }));
  return Promise.all([reception, cabinet, waiting].map(async (src, i) => ({ id: `demo-room-${i}`, title: ['Ресепшен', 'Кабинет', 'Зона ожидания'][i], alt: 'Временное изображение интерьера из дизайн-концепции', ...await picture(src, src.width, src.height), focus: 50, demo: true })));
}
export async function getSpecialists(): Promise<Specialist[]> {
  const entries = bySort(aboutDemo ? [] : await getCollection('specialists')).filter(e => e.data.image?.id);
  if (entries.length || !aboutDemo) return Promise.all(entries.map(async ({data:p}) => {
    const img = directusImage(p.image)!;
    return { id: String(p.id), slug: p.slug, title: p.name, role: p.role, alt: p.image_alt || p.name, body: p.body || '', seoTitle: p.seo_title || '', seoDescription: p.seo_description || '', ...await picture(img.src, img.width, img.height), focus: p.focus_y ?? 35, demo: p.is_demo };
  }));
  return Promise.all([portrait1, portrait2, portrait3].map(async (src, i) => ({ id: `demo-doctor-${i}`, slug: `demo-specialist-${i + 1}`, title: `Специалист ${i + 1}`, role: i === 0 ? 'Главный врач' : 'Врач-косметолог', alt: 'Условный портрет из дизайн-концепции', body: '<p>Здесь будет описание специалиста: знакомство с врачом, направления работы, образование и опыт.</p><p>Это демонстрационная страница. Портрет вырезан из утверждённого референса и будет заменён настоящей фотографией.</p>', seoTitle: '', seoDescription: 'Демонстрационная страница специалиста', ...await picture(src, src.width, src.height), focus: 35, demo: true })));
}

export async function getAboutContent() {
  const entry = await getEntry('clinicAbout', 'clinicAbout');
  if (!entry) throw new Error('Clinic about content is empty — run directus/setup/seed-about.mjs');
  return entry.data;
}
