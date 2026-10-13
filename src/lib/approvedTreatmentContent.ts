import type { CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { directusImage } from './media';

/** Resolve CMS file tokens at build time so no private asset URLs reach the browser. */
export async function getApprovedTreatmentContent(procedure: CollectionEntry<'procedures'>) {
  const layout = procedure.data.approved_layout;
  if (!layout) throw new Error('Approved treatment layout is missing');
  const images = await Promise.all(layout.assets.map(async asset => {
    const source = directusImage(asset)!;
    const image = await getImage({ ...source, format: 'webp' });
    return { token: asset.token, src: image.src };
  }));
  return layout.sections.map(section => section.kind === 'html'
    ? { ...section, html: images.reduce((html, image) => html.replaceAll(image.token, image.src), section.html) }
    : section.kind === 'videos' ? { ...section, items: section.items.map(item => ({ ...item, image_url: images.reduce((url, image) => url.replaceAll(image.token, image.src), item.image_url) })) } : section);
}
