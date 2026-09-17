/** JSON-LD builders. Each returns a plain object ready for JSON.stringify — no HTML escaping needed here. */

interface SiteForSchema {
  name: string;
  phone: string;
  email?: string | null;
  address_short?: string | null;
  hours?: string | null;
}

export function medicalClinicJsonLd(site: SiteForSchema, url: string, logoUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: site.name,
    url,
    telephone: site.phone,
    email: site.email || undefined,
    image: logoUrl,
    address: site.address_short
      ? { '@type': 'PostalAddress', streetAddress: site.address_short, addressCountry: 'RU' }
      : undefined,
    openingHours: site.hours || undefined,
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
