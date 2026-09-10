import { getCollection } from 'astro:content';
import { directusImage } from './media';
import { bySort } from './directus';

export async function getAllProcedures() {
  return bySort(await getCollection('procedures'));
}

export async function getProcedureBySlug(slug: string) {
  const all = await getAllProcedures();
  return all.find((p) => p.data.slug === slug) ?? null;
}

export async function getProceduresByCategory(categorySlug: string) {
  const all = await getAllProcedures();
  return all.filter((p) => p.data.category?.slug === categorySlug);
}

/** Cases (before/after) linked to a specific procedure, from the shared allCases collection. */
export async function getCasesForProcedure(procedureSlug: string) {
  const all = bySort(await getCollection('allCases'));
  return all.filter((c) => c.data.procedure?.slug === procedureSlug).map((c) => ({
    title: c.data.title,
    result: c.data.result ?? '',
    before: directusImage(c.data.before),
    after: directusImage(c.data.after),
    combined: directusImage(c.data.combined),
  }));
}

/** FAQ items scoped to a specific procedure. */
export async function getFaqForProcedure(procedureSlug: string) {
  const all = bySort(await getCollection('allFaq'));
  return all
    .filter((f) => f.data.scope === 'procedure' && f.data.procedure?.slug === procedureSlug)
    .map((f) => ({ question: f.data.question, answer: f.data.answer ?? '' }));
}

export function procedureGallery(gallery: { directus_files_id: { id: string; width?: number | null; height?: number | null } | null | undefined | null }[]) {
  return gallery.map((g) => directusImage(g.directus_files_id)).filter((img): img is NonNullable<typeof img> => !!img);
}
