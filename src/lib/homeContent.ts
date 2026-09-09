import { getEntry, getCollection } from 'astro:content';
import { directusImage } from './media';
import { formatRuDate } from './markup';

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

  const [categories, devices, cases, reviews] = await Promise.all([
    getCollection('serviceCategories'),
    getCollection('devices'),
    getCollection('homeCases'),
    getCollection('homeReviews'),
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
      image: directusImage(h.hero_image),
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
        cover: directusImage(c.cover),
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
      items: devices.map(({ data: d }) => ({
        name: d.name,
        short: d.short || '',
        image: directusImage(d.image),
        href: d.procedure?.slug ? `/${d.procedure.slug}` : '/uslugi-i-ceny',
      })),
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
    cta: {
      eyebrow: h.cta_eyebrow,
      title: h.cta_title,
      lead: h.cta_lead || '',
      button_label: h.cta_button_label,
      image: directusImage(h.cta_image),
      image_alt: h.cta_image_alt || '',
    },
  };
}

export type HomeContent = Awaited<ReturnType<typeof getHomeContent>>;
