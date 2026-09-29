import { createHash } from 'node:crypto';
import { getPageBySlug } from './pageContent';
import release from '../../scripts/migrate/certificate-consent-2026-09-28.json';

export async function getCertificateConsent() {
  const page = await getPageBySlug(release.slug);
  if (!page) throw new Error('Publish the certificate consent CMS page before building the form');
  const sha256 = createHash('sha256').update(page.data.title + '\n' + page.data.body).digest('hex');
  // The API archives this exact revision. A CMS edit requires a new reviewed release.
  if (sha256 !== release.sha256) throw new Error('Certificate consent CMS text differs from the archived API revision');
  return { version: release.version, sha256, url: `/${page.data.slug}` };
}
