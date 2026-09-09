import { getEntry, getCollection } from 'astro:content';
import { nav, clientLinks } from '../config/nav';
import { bySort } from './directus';

/**
 * Reshapes the `site_settings` singleton into the same shape the former
 * `src/data/site.json` fixture had. `categories` now comes from the real
 * `service_categories` collection instead of a hardcoded duplicate list.
 */
export async function getSiteSettings() {
  const settings = await getEntry('siteSettings', 'siteSettings');
  if (!settings) throw new Error('Directus "site_settings" singleton is empty — run directus/setup/seed-home.mjs');
  const s = settings.data;
  const categories = bySort(await getCollection('serviceCategories'));

  return {
    name: 'PERI CLINIC',
    tagline: s.tagline || '',
    phone: s.phone,
    email: s.email || '',
    city: s.city || 'Москва',
    address_short: s.address_short || '',
    address_lines: s.address_lines || '',
    hours: s.hours || '',
    telegram_url: s.telegram_url || '',
    whatsapp_phone: s.whatsapp_phone || s.phone,
    whatsapp_text: s.whatsapp_text || '',
    max_url: s.max_url || '',
    vk_url: s.vk_url || '',
    instagram_url: s.instagram_url || '',
    shop_url: s.shop_url || '',
    privacy_url: '/politika',
    non_offer_text: s.non_offer_text || '',
    instagram_disclaimer: s.instagram_disclaimer || '',
    contraindications_text: s.contraindications_text || '',
    show_prices: s.show_prices,
    nav,
    categories: categories.map(({ data: c }) => ({ slug: c.slug, title: c.title })),
    client_links: clientLinks,
  };
}

export type SiteSettings = Awaited<ReturnType<typeof getSiteSettings>>;
