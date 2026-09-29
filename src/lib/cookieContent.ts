import { createHash } from 'node:crypto';
import { getPageBySlug } from './pageContent';

export async function getCookieConsent() {
  const page = await getPageBySlug('soglasie-analitika-2026-09-28');
  if (!page) throw new Error('Analytics consent must be published before building');
  return {
    url: '/' + page.data.slug,
    version: 'analytics-2026-09-28-v1',
    sha256: createHash('sha256').update(page.data.title + '\n' + page.data.body).digest('hex'),
  };
}
