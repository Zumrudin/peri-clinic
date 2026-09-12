import { getCollection } from 'astro:content';
import { directusImage } from './media';
import { bySort } from './directus';
import { getAllCategories } from './categoryContent';

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

export function procedureGallery(gallery: { directus_files_id?: { id: string; width?: number | null; height?: number | null } | null }[]) {
  return gallery.map((g) => directusImage(g.directus_files_id)).filter((img): img is NonNullable<typeof img> => !!img);
}

export interface PriceItem {
  name: string;
  price: number | null;
  priceHeadDoctor: number | null;
  unit: string | null;
  note: string | null;
}

/** Price rows for a single procedure, from the shared allPriceItems collection. */
export async function getPriceItemsForProcedure(procedureSlug: string): Promise<PriceItem[]> {
  const all = bySort(await getCollection('allPriceItems'));
  return all
    .filter((item) => item.data.procedure?.slug === procedureSlug)
    .map((item) => ({
      name: item.data.name,
      price: item.data.price ?? null,
      priceHeadDoctor: item.data.price_head_doctor ?? null,
      unit: item.data.unit ?? null,
      note: item.data.note ?? null,
    }));
}

export interface PricedProcedure {
  slug: string;
  title: string;
  icd10: string | null;
  items: PriceItem[];
}

export interface PriceCategoryGroup {
  slug: string;
  title: string;
  procedures: PricedProcedure[];
}

/**
 * Full price list grouped by category → procedure, in the same display order as the rest
 * of the site (service_categories.sort, procedures.sort) rather than price_items.sort (which
 * only orders rows within one procedure). Categories/procedures with no priced items are
 * omitted, so an empty price_items table simply produces an empty array.
 */
export async function getPriceListGrouped(): Promise<PriceCategoryGroup[]> {
  const categories = await getAllCategories();
  const groups: PriceCategoryGroup[] = [];
  for (const cat of categories) {
    const procedures = await getProceduresByCategory(cat.data.slug);
    const procEntries: PricedProcedure[] = [];
    for (const proc of procedures) {
      const items = await getPriceItemsForProcedure(proc.data.slug);
      if (items.length > 0) {
        procEntries.push({ slug: proc.data.slug, title: proc.data.title, icd10: proc.data.icd10 ?? null, items });
      }
    }
    if (procEntries.length > 0) {
      groups.push({ slug: cat.data.slug, title: cat.data.title, procedures: procEntries });
    }
  }
  return groups;
}
