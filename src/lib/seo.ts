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
