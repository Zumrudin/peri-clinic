import { getEntry, getCollection } from 'astro:content';
import { directusImage } from './media';
import { formatRuDate } from './markup';
import { bySort } from './directus';
import { getAllDevices } from './deviceContent';

/** These three placements require an image; fail at the CMS boundary with a useful error. */
function requiredImage(file: Parameters<typeof directusImage>[0], field: string) {
  const image = directusImage(file);
  if (!image) throw new Error(`Required home image is missing: ${field}`);
  return image;
}

/**
 * Reshapes the `home` singleton + related collections (fetched via Content Layer loaders,
 * see src/content.config.ts) into the same nested shape the former `src/data/home.json`
 * fixture had, so every `src/components/home/*.astro` section keeps its existing template
 * code — only the `import home from '../../data/home.json'` line changes to a call here.
 */
export async function getHomeContent() {
  const home = await getEntry('home', 'home');
  if (!home) throw new Error('Directus "home" singleton is empty — run directus/setup/seed-home.mjs');
  const h = home.data;

  const [categories, devices, cases, reviews, allDevices] = await Promise.all([
    getCollection('serviceCategories').then(bySort),
    getCollection('devices').then(bySort),
    getCollection('homeCases').then(bySort),
    getCollection('homeReviews').then(bySort),
    getAllDevices(),
  ]);

  return {
    seo: { title: h.seo_title || 'PERI CLINIC', description: h.seo_description || '' },
    hero: {
      eyebrow: h.hero_eyebrow,
      title: h.hero_title,
      lead: h.hero_lead,
      primary_label: h.hero_primary_label,
      secondary_label: h.hero_secondary_label,
      secondary_href: '#results',
      image: requiredImage(h.hero_image, 'hero_image'),
      image_alt: h.hero_image_alt || '',
      note: h.hero_note || '',
      facts: h.hero_facts,
    },
    ticker: h.ticker_items,
    categories: {
      eyebrow: h.categories_eyebrow,
      title: h.categories_title,
      lead: h.categories_lead || '',
      items: categories.map(({ data: c }) => ({
        slug: c.slug,
        title: c.title,
        tagline: c.tagline || '',
        cover: requiredImage(c.cover, `category ${c.slug}`),
        alt: c.cover_alt || c.title,
      })),
    },
    approach: {
      eyebrow: h.approach_eyebrow,
      title: h.approach_title,
      lead: h.approach_lead || '',
      image: directusImage(h.approach_image),
      image_alt: h.approach_image_alt || '',
      badge: h.approach_badge || '',
      principles: h.principles,
      link_label: h.approach_link_label || '',
      link_href: h.approach_link_href || '/kontakty',
    },
    devices: {
      eyebrow: h.devices_eyebrow,
      title: h.devices_title,
      lead: h.devices_lead || '',
      all_label: h.devices_all_label || '',
      consultation_title: h.devices_consultation_title || '',
      consultation_label: h.devices_consultation_label || '',
      catalog_title: h.devices_catalog_title || '',
      catalog_lead: h.devices_catalog_lead || '',
      catalog_seo_title: h.devices_catalog_seo_title || '',
      catalog_seo_description: h.devices_catalog_seo_description || '',

      items: allDevices.filter(device => devices.some(entry => entry.data.id === device.id)),
    },
    cases: {
      eyebrow: h.cases_eyebrow,
      title: h.cases_title,
      lead: h.cases_lead || '',
      all_label: 'Все результаты',
      items: cases.map(({ data: c }) => ({
        category: c.category?.title || '',
        title: c.title,
        result: c.result || '',
        image: directusImage(c.after) || directusImage(c.combined),
        alt: c.title,
      })),
    },
    reviews: {
      eyebrow: h.reviews_eyebrow,
      title: h.reviews_title,
      rating: h.reviews_rating || '5.0',
      rating_label: h.reviews_rating_label || 'рейтинг клиники',
      items: reviews.map(({ data: r }) => ({
        author: r.author_name,
        date: formatRuDate(r.date),
        text: r.text,
        procedure_label: r.procedure_label || '',
      })),
    },
    giftCertificate: {
      eyebrow: h.gift_eyebrow || '',
      title: h.gift_title || '',
      lead: h.gift_lead || '',
      button_label: h.gift_button_label || '',
      context: h.gift_context || '',
      video_url: h.gift_video_url || '',
      poster_url: h.gift_poster_url || '',
      video_label: h.gift_video_label || '',
      play_label: h.gift_play_label || '',
      pause_label: h.gift_pause_label || '',
    },
    cta: {
      eyebrow: h.cta_eyebrow,
      title: h.cta_title,
      lead: h.cta_lead || '',
      button_label: h.cta_button_label,
      image: requiredImage(h.cta_image, 'cta_image'),
      image_alt: h.cta_image_alt || '',
    },
  };
}

export type HomeContent = Awaited<ReturnType<typeof getHomeContent>>;
