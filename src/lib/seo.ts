/** JSON-LD builders. Each returns a plain object ready for JSON.stringify — no HTML escaping needed here. */

interface SiteForSchema {
  name: string;
  phone: string;
  email?: string | null;
  address_short?: string | null;
  nearest_metro?: string | null;
  metro_walk_time?: string | null;
  metro_directions?: string | null;
  hours?: string | null;
  city?: string;
  map_link?: string;
  vk_url?: string;
  telegram_url?: string;
}

export function medicalClinicJsonLd(site: SiteForSchema, url: string, logoUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    '@id': `${url}#clinic`,
    name: site.name,
    url,
    telephone: site.phone,
    email: site.email || undefined,
    image: logoUrl,
    address: site.address_short
      ? { '@type': 'PostalAddress', streetAddress: site.address_short, addressLocality: site.city || undefined, addressCountry: 'RU' }
      : undefined,
    // Schema openingHours requires day codes, not the human-readable Russian label.
    openingHours: site.hours?.match(/ежедневно/i) ? `Mo-Su ${site.hours.match(/\d{2}:\d{2}/g)?.join('-') || ''}`.trim() : undefined,
    hasMap: site.map_link || undefined,
    amenityFeature: site.nearest_metro ? {
      '@type': 'LocationFeatureSpecification',
      name: `Метро ${site.nearest_metro}${site.metro_walk_time ? ` — ${site.metro_walk_time}` : ''}`,
      value: true,
    } : undefined,
    directions: site.metro_directions || undefined,
    sameAs: [site.vk_url, site.telegram_url].filter(Boolean),
    medicalSpecialty: 'Dermatology',
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer.replace(/<[^>]+>/g, ' ').trim() },
    })),
  };
}

/**
 * Public path for <link rel="canonical"> / og:url. With `build.format: 'file'` Astro reports
 * `Astro.url.pathname` as the emitted file (`/result.html`, `/index.html`), but nginx serves
 * clean URLs (`try_files $uri $uri.html`) and the sitemap lists them without the extension —
 * so the canonical must be the clean form too, or every page declares a duplicate of itself.
 */
export function canonicalPath(pathname: string): string {
  let path = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

/** CMS rich text is not HTML in a meta attribute. Preserve words, remove editor markup. */
export function seoText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/_([^_]+)_/g, '$1').replace(/\s+/g, ' ').trim();
}

export function webPageJsonLd(url: string, title: string, description: string, origin: string) {
  return {
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${url}#webpage`,
    url, name: title, description, inLanguage: 'ru-RU',
    isPartOf: { '@id': `${origin}#website` }, about: { '@id': `${origin}#clinic` },
  };
}
