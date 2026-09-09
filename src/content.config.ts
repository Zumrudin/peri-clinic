import { defineCollection, z } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { directusGet, directusQuery } from './lib/directus';

const fileRef = z.object({ id: z.string(), width: z.number().nullable().optional(), height: z.number().nullable().optional() }).nullable().optional();
/** `fileFields('hero_image')` → `'hero_image.id,hero_image.width,hero_image.height'` (Directus needs each nested field spelled out, not a shared suffix). */
const fileFields = (prefix: string) => ['id', 'width', 'height'].map((f) => `${prefix}.${f}`).join(',');

/** A loader that fetches one Directus item/list per build and stores it verbatim. */
function directusLoader(name: string, fetchData: () => Promise<unknown>): Loader {
  return {
    name: `directus-${name}`,
    load: async ({ store, logger }) => {
      const data = await fetchData();
      store.clear();
      if (Array.isArray(data)) {
        for (const item of data as Array<{ id: string | number }>) {
          store.set({ id: String(item.id), data: item as Record<string, unknown> });
        }
        logger.info(`loaded ${data.length} item(s)`);
      } else {
        store.set({ id: name, data: data as Record<string, unknown> });
        logger.info('loaded singleton');
      }
    },
  };
}

const homeFields = [
  'hero_eyebrow',
  'hero_title',
  'hero_lead',
  'hero_primary_label',
  'hero_secondary_label',
  fileFields('hero_image'),
  'hero_image_alt',
  'hero_note',
  'hero_facts',
  'ticker_items',
  'categories_eyebrow',
  'categories_title',
  'categories_lead',
  'approach_eyebrow',
  'approach_title',
  'approach_lead',
  fileFields('approach_image'),
  'approach_image_alt',
  'approach_badge',
  'principles',
  'approach_link_label',
  'approach_link_href',
  'devices_eyebrow',
  'devices_title',
  'devices_lead',
  'cases_eyebrow',
  'cases_title',
  'cases_lead',
  'reviews_eyebrow',
  'reviews_title',
  'reviews_rating',
  'reviews_rating_label',
  'cta_eyebrow',
  'cta_title',
  'cta_lead',
  'cta_button_label',
  fileFields('cta_image'),
  'cta_image_alt',
  'seo_title',
  'seo_description',
].join(',');

const home = defineCollection({
  loader: directusLoader('home', () => directusGet(`/items/home${directusQuery({ fields: homeFields })}`)),
  schema: z.object({
    hero_eyebrow: z.string(),
    hero_title: z.string(),
    hero_lead: z.string(),
    hero_primary_label: z.string(),
    hero_secondary_label: z.string(),
    hero_image: fileRef,
    hero_image_alt: z.string().nullable().optional(),
    hero_note: z.string().nullable().optional(),
    hero_facts: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    ticker_items: z.array(z.string()).default([]),
    categories_eyebrow: z.string(),
    categories_title: z.string(),
    categories_lead: z.string().nullable().optional(),
    approach_eyebrow: z.string(),
    approach_title: z.string(),
    approach_lead: z.string().nullable().optional(),
    approach_image: fileRef,
    approach_image_alt: z.string().nullable().optional(),
    approach_badge: z.string().nullable().optional(),
    principles: z.array(z.object({ title: z.string(), text: z.string() })).default([]),
    approach_link_label: z.string().nullable().optional(),
    approach_link_href: z.string().nullable().optional(),
    devices_eyebrow: z.string(),
    devices_title: z.string(),
    devices_lead: z.string().nullable().optional(),
    cases_eyebrow: z.string(),
    cases_title: z.string(),
    cases_lead: z.string().nullable().optional(),
    reviews_eyebrow: z.string(),
    reviews_title: z.string(),
    reviews_rating: z.string().nullable().optional(),
    reviews_rating_label: z.string().nullable().optional(),
    cta_eyebrow: z.string(),
    cta_title: z.string(),
    cta_lead: z.string().nullable().optional(),
    cta_button_label: z.string(),
    cta_image: fileRef,
    cta_image_alt: z.string().nullable().optional(),
    seo_title: z.string().nullable().optional(),
    seo_description: z.string().nullable().optional(),
  }),
});

const siteSettingsFields = [
  'phone',
  'email',
  'city',
  'hours',
  'address_short',
  'address_lines',
  'map_embed_src',
  'map_link',
  'telegram_url',
  'whatsapp_phone',
  'whatsapp_text',
  'max_url',
  'vk_url',
  'instagram_url',
  'telegram_channel_url',
  'shop_url',
  'spravka_form_url',
  'legal_entity',
  'ogrn',
  'inn',
  'kpp',
  'legal_address',
  'license_number',
  'license_date',
  'license_issuer',
  'contraindications_text',
  'non_offer_text',
  'instagram_disclaimer',
  'tagline',
  'metrika_id',
  'yandex_verification',
  'show_prices',
  'metrika_requires_consent',
].join(',');

const siteSettings = defineCollection({
  loader: directusLoader('siteSettings', () => directusGet(`/items/site_settings${directusQuery({ fields: siteSettingsFields })}`)),
  schema: z.object({
    phone: z.string(),
    email: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    hours: z.string().nullable().optional(),
    address_short: z.string().nullable().optional(),
    address_lines: z.string().nullable().optional(),
    map_embed_src: z.string().nullable().optional(),
    map_link: z.string().nullable().optional(),
    telegram_url: z.string().nullable().optional(),
    whatsapp_phone: z.string().nullable().optional(),
    whatsapp_text: z.string().nullable().optional(),
    max_url: z.string().nullable().optional(),
    vk_url: z.string().nullable().optional(),
    instagram_url: z.string().nullable().optional(),
    telegram_channel_url: z.string().nullable().optional(),
    shop_url: z.string().nullable().optional(),
    spravka_form_url: z.string().nullable().optional(),
    legal_entity: z.string().nullable().optional(),
    ogrn: z.string().nullable().optional(),
    inn: z.string().nullable().optional(),
    kpp: z.string().nullable().optional(),
    legal_address: z.string().nullable().optional(),
    license_number: z.string().nullable().optional(),
    license_date: z.string().nullable().optional(),
    license_issuer: z.string().nullable().optional(),
    contraindications_text: z.string().nullable().optional(),
    non_offer_text: z.string().nullable().optional(),
    instagram_disclaimer: z.string().nullable().optional(),
    tagline: z.string().nullable().optional(),
    metrika_id: z.string().nullable().optional(),
    yandex_verification: z.string().nullable().optional(),
    show_prices: z.boolean().default(false),
    metrika_requires_consent: z.boolean().default(true),
  }),
});

const serviceCategories = defineCollection({
  loader: directusLoader('serviceCategories', () =>
    directusGet(
      `/items/service_categories${directusQuery({
        fields: `id,sort,slug,title,short_title,tagline,cover_alt,${fileFields('cover')}`,
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    slug: z.string(),
    title: z.string(),
    short_title: z.string().nullable().optional(),
    tagline: z.string().nullable().optional(),
    cover: fileRef,
    cover_alt: z.string().nullable().optional(),
  }),
});

const devices = defineCollection({
  loader: directusLoader('devices', () =>
    directusGet(
      `/items/devices${directusQuery({
        fields: `id,sort,name,short,procedure.slug,${fileFields('image')}`,
        filter: JSON.stringify({ status: { _eq: 'published' }, show_on_home: { _eq: true } }),
        sort: 'sort',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    name: z.string(),
    short: z.string().nullable().optional(),
    image: fileRef,
    procedure: z.object({ slug: z.string() }).nullable().optional(),
  }),
});

const homeCases = defineCollection({
  loader: directusLoader('homeCases', () =>
    directusGet(
      `/items/before_after_cases${directusQuery({
        fields: `id,sort,title,result,category.title,${fileFields('after')},${fileFields('combined')}`,
        filter: JSON.stringify({ status: { _eq: 'published' }, show_on_home: { _eq: true }, needs_review: { _eq: false } }),
        sort: 'sort',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    title: z.string(),
    result: z.string().nullable().optional(),
    after: fileRef,
    combined: fileRef,
    category: z.object({ title: z.string() }).nullable().optional(),
  }),
});

const homeReviews = defineCollection({
  loader: directusLoader('homeReviews', () =>
    directusGet(
      `/items/reviews${directusQuery({
        fields: 'id,sort,author_name,date,text,procedure_label',
        filter: JSON.stringify({ status: { _eq: 'published' }, show_on_home: { _eq: true } }),
        sort: 'sort',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    author_name: z.string(),
    date: z.string().nullable().optional(),
    text: z.string(),
    procedure_label: z.string().nullable().optional(),
  }),
});

export const collections = { home, siteSettings, serviceCategories, devices, homeCases, homeReviews };
