import { defineCollection, z } from 'astro:content';
import aboutDemoContent from './data/about-demo.json';
import type { Loader } from 'astro/loaders';
import { directusGet, directusQuery } from './lib/directus';

const fileRef = z.object({ id: z.string(), width: z.number().nullable().optional(), height: z.number().nullable().optional() }).nullable().optional();
/** `fileFields('hero_image')` → `'hero_image.id,hero_image.width,hero_image.height'` (Directus needs each nested field spelled out, not a shared suffix). */
const fileFields = (prefix: string) => ['id', 'width', 'height'].map((f) => `${prefix}.${f}`).join(',');

/**
 * A loader that fetches one Directus item/list per build and stores it.
 *
 * Must call `parseData()` — a custom loader that just does `store.set({id, data})` with
 * the raw fetched JSON never runs the collection's `schema` at all (schema is only used
 * for `astro:content` TypeScript types in that case, not applied to the actual values).
 * That silently skipped every `.catch()`/`.default()`/`.nullable()` fallback in every
 * schema below — e.g. Directus stores an unset JSON/repeater field as `null`, not `[]`,
 * and without parseData() that null reached templates as `p.steps === null` instead of
 * `[]`, crashing on `.length`. Found the hard way on /pigment-lumec (see phase-5 plan).
 */
function directusLoader(name: string, fetchData: () => Promise<unknown>): Loader {
  return {
    name: `directus-${name}`,
    load: async ({ store, logger, parseData }) => {
      const data = await fetchData();
      store.clear();
      if (Array.isArray(data)) {
        for (const item of data as Array<{ id: string | number }>) {
          const id = String(item.id);
          const parsed = await parseData({ id, data: item as Record<string, unknown> });
          store.set({ id, data: parsed });
        }
        logger.info(`loaded ${data.length} item(s)`);
      } else {
        const parsed = await parseData({ id: name, data: data as Record<string, unknown> });
        store.set({ id: name, data: parsed });
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
  'devices_all_label',
  'devices_consultation_title',
  'devices_consultation_label',
  'devices_catalog_title',
  'devices_catalog_lead',
  'devices_catalog_seo_title',
  'devices_catalog_seo_description',
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
    hero_facts: z.array(z.object({ value: z.string(), label: z.string() })).catch([]),
    ticker_items: z.array(z.string()).catch([]),
    categories_eyebrow: z.string(),
    categories_title: z.string(),
    categories_lead: z.string().nullable().optional(),
    approach_eyebrow: z.string(),
    approach_title: z.string(),
    approach_lead: z.string().nullable().optional(),
    approach_image: fileRef,
    approach_image_alt: z.string().nullable().optional(),
    approach_badge: z.string().nullable().optional(),
    principles: z.array(z.object({ title: z.string(), text: z.string() })).catch([]),
    approach_link_label: z.string().nullable().optional(),
    approach_link_href: z.string().nullable().optional(),
    devices_eyebrow: z.string(),
    devices_title: z.string(),
    devices_lead: z.string().nullable().optional(),
    devices_all_label: z.string().nullable().optional(),
    devices_consultation_title: z.string().nullable().optional(),
    devices_consultation_label: z.string().nullable().optional(),
    devices_catalog_title: z.string().nullable().optional(),
    devices_catalog_lead: z.string().nullable().optional(),
    devices_catalog_seo_title: z.string().nullable().optional(),
    devices_catalog_seo_description: z.string().nullable().optional(),
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
        fields: `id,sort,slug,title,short_title,tagline,description,intro_title,cover_alt,seo_title,seo_description,${fileFields('cover')}`,
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
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
    description: z.string().nullable().optional(),
    intro_title: z.string().nullable().optional(),
    cover: fileRef,
    cover_alt: z.string().nullable().optional(),
    seo_title: z.string().nullable().optional(),
    seo_description: z.string().nullable().optional(),
  }),
});

const devices = defineCollection({
  loader: directusLoader('devices', () =>
    directusGet(
      `/items/devices${directusQuery({
        fields: `id,sort,name,short,procedure.slug,${fileFields('image')}`,
        filter: JSON.stringify({ status: { _eq: 'published' }, show_on_home: { _eq: true } }),
        sort: 'sort',
        limit: '-1',
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

const allDevices = defineCollection({
  loader: directusLoader('allDevices', () =>
    directusGet(
      `/items/devices${directusQuery({
        fields: `id,sort,name,short,manufacturer,country,procedure.slug,procedure.status,${fileFields('image')}`,
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    name: z.string(),
    short: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    image: fileRef,
    procedure: z.object({ slug: z.string(), status: z.string() }).nullable().optional(),
  }),
});

const homeCases = defineCollection({
  loader: directusLoader('homeCases', () =>
    directusGet(
      `/items/before_after_cases${directusQuery({
        fields: `id,sort,title,result,category.title,${fileFields('after')},${fileFields('combined')}`,
        filter: JSON.stringify({ status: { _eq: 'published' }, show_on_home: { _eq: true }, needs_review: { _eq: false } }),
        sort: 'sort',
        limit: '-1',
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
        limit: '-1',
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

const galleryFileRef = z.object({ directus_files_id: fileRef });

const procedures = defineCollection({
  loader: directusLoader('procedures', () =>
    directusGet(
      `/items/procedures${directusQuery({
        fields: [
          'id',
          'sort',
          'slug',
          'title',
          'icd10',
          'subtitle',
          'category.slug',
          'category.title',
          'device.name',
          'device.short',
          fileFields('device.image'),
          'summary',
          'lead',
          'body',
          'steps',
          'benefits',
          'indications',
          'contraindications',
          'duration',
          'rehab',
          'effect_duration',
          'sessions',
          'cover_alt',
          'seo_title',
          'seo_description',
          fileFields('cover'),
          'gallery.directus_files_id.id',
          'gallery.directus_files_id.width',
          'gallery.directus_files_id.height',
        ].join(','),
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    slug: z.string(),
    title: z.string(),
    icd10: z.string().nullable().optional(),
    subtitle: z.string().nullable().optional(),
    category: z.object({ slug: z.string(), title: z.string() }).nullable().optional(),
    device: z.object({ name: z.string(), short: z.string().nullable().optional(), image: fileRef }).nullable().optional(),
    summary: z.string().nullable().optional(),
    lead: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    steps: z.array(z.object({ title: z.string(), text: z.string() })).catch([]),
    benefits: z.array(z.object({ title: z.string(), text: z.string() })).catch([]),
    indications: z.string().nullable().optional(),
    contraindications: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    rehab: z.string().nullable().optional(),
    effect_duration: z.string().nullable().optional(),
    sessions: z.string().nullable().optional(),
    cover: fileRef,
    cover_alt: z.string().nullable().optional(),
    seo_title: z.string().nullable().optional(),
    seo_description: z.string().nullable().optional(),
    gallery: z.array(galleryFileRef).catch([]),
  }),
});

const pages = defineCollection({
  loader: directusLoader('pages', () =>
    directusGet(
      `/items/pages${directusQuery({
        fields: 'id,sort,slug,title,template,lead,body,noindex,seo_title,seo_description',
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    slug: z.string(),
    title: z.string(),
    template: z.enum(['info', 'legal', 'loyalty', 'spravka']).default('info'),
    lead: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    noindex: z.boolean().default(false),
    seo_title: z.string().nullable().optional(),
    seo_description: z.string().nullable().optional(),
  }),
});

const caseCategories = defineCollection({
  loader: directusLoader('caseCategories', () => directusGet(`/items/case_categories${directusQuery({ fields: 'id,sort,slug,title', sort: 'sort', limit: '-1' })}`)),
  schema: z.object({ id: z.number(), sort: z.number().nullable().optional(), slug: z.string(), title: z.string() }),
});

/** Every published, reviewer-approved before/after case (not just the homepage teaser set) — feeds /result and each procedure page's own case list. */
const allCases = defineCollection({
  loader: directusLoader('allCases', () =>
    directusGet(
      `/items/before_after_cases${directusQuery({
        fields: `id,sort,title,result,category.slug,category.title,procedure.slug,${fileFields('before')},${fileFields('after')},${fileFields('combined')}`,
        filter: JSON.stringify({ status: { _eq: 'published' }, needs_review: { _eq: false } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    title: z.string(),
    result: z.string().nullable().optional(),
    category: z.object({ slug: z.string(), title: z.string() }).nullable().optional(),
    procedure: z.object({ slug: z.string() }).nullable().optional(),
    before: fileRef,
    after: fileRef,
    combined: fileRef,
  }),
});

/** All published FAQ items (general + per-procedure) — /uslugi-i-ceny uses scope=general, procedure pages filter by procedure.slug. */
const allFaq = defineCollection({
  loader: directusLoader('allFaq', () =>
    directusGet(
      `/items/faq_items${directusQuery({
        fields: 'id,sort,question,answer,scope,procedure.slug',
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    question: z.string(),
    answer: z.string().nullable().optional(),
    scope: z.enum(['general', 'procedure']).default('procedure'),
    procedure: z.object({ slug: z.string() }).nullable().optional(),
  }),
});

/** All price rows (procedure pages filter by procedure.slug; /uslugi-i-ceny groups via getPriceListGrouped()). */
const allPriceItems = defineCollection({
  loader: directusLoader('allPriceItems', () =>
    directusGet(
      `/items/price_items${directusQuery({
        fields: 'id,sort,name,price,price_max,price_group,price_group_category,price_group_sort,price_head_doctor,unit,note,medical_service_code,medical_service_name,procedure.slug',
        filter: JSON.stringify({ _or: [{ procedure: { status: { _eq: 'published' } } }, { _and: [{ procedure: { _null: true } }, { price_group: { _nnull: true } }] }] }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    name: z.string(),
    price: z.number().nullable().optional(),
    price_max: z.number().nullable().optional(),
    price_group: z.string().nullable().optional(),
    price_group_category: z.string().nullable().optional(),
    price_group_sort: z.number().nullable().optional(),
    price_head_doctor: z.number().nullable().optional(),
    medical_service_code: z.string().nullable().optional(),
    medical_service_name: z.string().nullable().optional(),
    unit: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    procedure: z.object({ slug: z.string() }).nullable().optional(),
  }),
});

/** All published reviews (not just show_on_home) — /otzyvy. */
const allReviews = defineCollection({
  loader: directusLoader('allReviews', () =>
    directusGet(
      `/items/reviews${directusQuery({
        fields: 'id,sort,author_name,date,rating,text,procedure_label,source,source_url',
        filter: JSON.stringify({ status: { _eq: 'published' } }),
        sort: 'sort',
        limit: '-1',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    author_name: z.string(),
    date: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    text: z.string(),
    procedure_label: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    source_url: z.string().nullable().optional(),
  }),
});


const clinicAbout = defineCollection({
  loader: directusLoader('clinicAbout', () => (import.meta.env.ABOUT_DEMO ?? process.env.ABOUT_DEMO) === 'true' ? Promise.resolve(aboutDemoContent) : directusGet('/items/clinic_about')),
  schema: z.object({ eyebrow: z.string(), title: z.string(), description: z.string(), rooms_title: z.string(), team_title: z.string(), details_label: z.string(),
    reels_title: z.string().nullable().optional(), reels_description: z.string().nullable().optional(), reels_hint: z.string().nullable().optional(),
    license_label: z.string().nullable().optional(), license_href: z.string().regex(/^\/(?!\/)[^\s]*$/).nullable().optional(), demo_notice: z.string(), }),
});

const aboutCollection = (name: string) => directusLoader(name, () => (import.meta.env.ABOUT_DEMO ?? process.env.ABOUT_DEMO) === 'true' ? Promise.resolve([]) : directusGet(`/items/${name}${directusQuery({
  fields: '*,' + fileFields('image') + (name === 'specialists' ? ',media_items.*,media_items.image.id,media_items.image.width,media_items.image.height,media_items.video.id,media_items.video.type,media_items.video.filesize,media_items.video.modified_on,media_items.video.uploaded_on' : ''), filter: JSON.stringify({ status: { _eq: 'published' } }), sort: 'sort',
        limit: '-1',
})}`));
const clinicPhotos = defineCollection({ loader: aboutCollection('clinic_photos'), schema: z.object({
  is_demo: z.boolean().default(false),
  id: z.number(), sort: z.number().nullable().optional(), title: z.string(), image: fileRef, image_alt: z.string().nullable().optional(),
}) });
const specialists = defineCollection({ loader: aboutCollection('specialists'), schema: z.object({
  is_demo: z.boolean().default(false),
  id: z.number(), sort: z.number().nullable().optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string(), role: z.string(),
  image: fileRef, image_alt: z.string().nullable().optional(), focus_y: z.number().min(0).max(100).nullable().optional(), body: z.string().nullable().optional(),
  seo_title: z.string().nullable().optional(), seo_description: z.string().nullable().optional(),
  media_title: z.string().nullable().optional(), media_description: z.string().nullable().optional(),
  media: z.unknown().optional(),
  media_items: z.array(z.object({ id: z.number(), sort: z.number().nullable().optional(), title: z.string(), description: z.string().nullable().optional(), image: fileRef, image_alt: z.string().nullable().optional(), video: z.object({ id: z.string(), type: z.string(), filesize: z.union([z.number(), z.string()]), modified_on: z.string().nullable().optional(), uploaded_on: z.string().nullable().optional() }).nullable().optional() })).nullable().optional(),
}) });

export const collections = {
  clinicAbout,
  clinicPhotos,
  specialists,
  home,
  siteSettings,
  serviceCategories,
  devices,
  allDevices,
  homeCases,
  homeReviews,
  procedures,
  pages,
  caseCategories,
  allCases,
  allFaq,
  allPriceItems,
  allReviews,
};
