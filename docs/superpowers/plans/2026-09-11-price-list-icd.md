# Price List + МКБ-10 Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old Wix site's runtime git-to-PDF price renderer with a build-time price list sourced from Directus, rendered on every procedure page and as a grouped accordion on `/uslugi-i-ceny`, plus a public ICD-10 (МКБ-10) code per procedure.

**Architecture:** The Directus schema already has a dormant `price_items` collection (m2o → `procedures`) and a `show_prices` flag on `site_settings` — neither is wired to Astro. This plan (1) adds one new field (`procedures.icd10`) to the Directus schema, (2) adds a Content Layer collection `allPriceItems` mirroring the existing `allFaq`/`allCases` pattern in `src/content.config.ts`, (3) adds two functions to `src/lib/procedureContent.ts` (`getPriceItemsForProcedure`, `getPriceListGrouped`) that reuse the existing `getAllCategories`/`getProceduresByCategory` helpers to keep price-list ordering consistent with the rest of the site, and (4) adds one new shared component (`PriceTable.astro`) rendered from both `ProcedurePage.astro` and `uslugi-i-ceny.astro`. Everything is resolved at `astro build` time — no client-side fetch, matching the rest of the site.

**Tech Stack:** Astro Content Layer (`astro:content`, zod), Directus REST (`src/lib/directus.ts`), existing `.astro` components/scoped styles — no new dependencies.

**Context you need before starting:**
- Read the approved design spec first: `docs/superpowers/specs/2026-09-11-price-list-icd-design.md`.
- `src/content.config.ts:390-432` — `allCases` and `allFaq` are the pattern to copy for `allPriceItems`: a top-level collection that queries the Directus child table directly (not nested inside the `procedures` query), filtered by the parent's `status`, exposing `procedure.slug` for callers to filter by.
- `src/lib/directus.ts:57-59` — `bySort()`. Always wrap `getCollection()` results with it; Astro's Content Layer discards Directus `sort` order otherwise.
- `src/lib/procedureContent.ts` (full file, 42 lines) and `src/lib/categoryContent.ts` (full file, 17 lines) — read both before starting Task 4; `getPriceListGrouped()` calls into both.
- `directus/setup/collections.mjs:240-274` — the `procedures` collection field list; `icd10` is inserted there. `directus/setup/collections.mjs:276-287` — `price_items`, unchanged by this plan (already correct).
- Local dev Directus is already running (`pm2` process `peri-directus`, `http://127.0.0.1:8055`). `.env.claude` (gitignored) holds a working `DIRECTUS_URL`/`DIRECTUS_TOKEN` pair for an Editor-role service account — sufficient for reading/writing content (procedures, price_items) but **not** for schema changes (adding a field requires admin credentials, see Task 1).
- The project root has no `.env` yet, which `astro build`/`astro dev` require (`src/lib/directus.ts:10-14` throws if `DIRECTUS_URL`/`DIRECTUS_TOKEN` are unset). Task 8 creates it by copying `.env.claude`, if it doesn't already exist by then.

---

### Task 1: Add the `icd10` field to the Directus `procedures` collection

**Files:**
- Modify: `directus/setup/collections.mjs:244-247`

- [ ] **Step 1: Add the field definition**

Current (`directus/setup/collections.mjs:244-247`):

```js
      f.m2o('category', 'Направление', 'service_categories', { required: true }),
      f.m2o('device', 'Аппарат', 'devices', { template: '{{name}}' }),
      f.str('subtitle', 'Подзаголовок', { note: 'Одна строка под названием' }),
```

Change to:

```js
      f.m2o('category', 'Направление', 'service_categories', { required: true }),
      f.m2o('device', 'Аппарат', 'devices', { template: '{{name}}' }),
      f.str('icd10', 'Код МКБ-10', { width: 'half', note: 'Например L90.5. Показывается на сайте рядом с ценами.' }),
      f.str('subtitle', 'Подзаголовок', { note: 'Одна строка под названием' }),
```

- [ ] **Step 2: Apply the schema change to the running Directus**

This needs admin credentials (the `.env.claude` token is Editor-role and cannot create fields). Run, substituting the real admin email/password for this dev stand (see `directus/roles.md` for where these are documented/stored):

```bash
cd /root/peri-clinnic.ru
DIRECTUS_URL=http://127.0.0.1:8055 DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... \
  node directus/setup/schema.mjs
```

Expected output includes a line like `add field procedures.icd10`. The script is idempotent (safe to re-run).

- [ ] **Step 3: Verify the field exists**

```bash
source .env.claude
curl -s "$DIRECTUS_URL/fields/procedures/icd10" -H "Authorization: Bearer $DIRECTUS_TOKEN" | head -c 300
```

Expected: a JSON object for the field (not a 403/404 error).

- [ ] **Step 4: Commit**

```bash
git add directus/setup/collections.mjs
git commit -m "feat: add icd10 field to procedures schema"
```

---

### Task 2: `formatPrice()` — pure price formatting helper

**Files:**
- Modify: `src/lib/markup.ts`
- Test: `src/lib/markup.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/markup.test.ts`:

```ts
test('formatPrice(): thousands-separated rubles, null passes through', () => {
  assert.equal(formatPrice(500), '500 ₽');
  assert.equal(formatPrice(15000), '15 000 ₽');
  assert.equal(formatPrice(2500000), '2 500 000 ₽');
  assert.equal(formatPrice(null), null);
});
```

And add `formatPrice` to the existing import line at the top of the file:

```ts
import { em, telHref, whatsappHref, phoneDigits, formatRuDate, formatPrice } from './markup.ts';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/markup.test.ts`
Expected: FAIL — `formatPrice is not a function` (or a TS "has no exported member" diagnostic).

- [ ] **Step 3: Implement `formatPrice`**

Append to `src/lib/markup.ts`:

```ts
/** `15000` → `"15 000 ₽"`. `null` (price on request) passes through unchanged for the caller to handle. */
export function formatPrice(price: number | null): string | null {
  if (price === null) return null;
  return `${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/markup.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/markup.ts src/lib/markup.test.ts
git commit -m "feat: add formatPrice() helper"
```

---

### Task 3: `allPriceItems` Content Layer collection + `procedures.icd10`

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: Add `icd10` to the `procedures` fields list and schema**

Current (`src/content.config.ts:302-304`):

```ts
          'slug',
          'title',
          'subtitle',
```

Change to:

```ts
          'slug',
          'title',
          'icd10',
          'subtitle',
```

Current (`src/content.config.ts:336-338`):

```ts
    slug: z.string(),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
```

Change to:

```ts
    slug: z.string(),
    title: z.string(),
    icd10: z.string().nullable().optional(),
    subtitle: z.string().nullable().optional(),
```

- [ ] **Step 2: Add the `allPriceItems` collection**

Insert directly after the `allFaq` collection block (`src/content.config.ts:432`, right before the `/** All published reviews... */` comment):

```ts
/** All price rows (procedure pages filter by procedure.slug; /uslugi-i-ceny groups via getPriceListGrouped()). */
const allPriceItems = defineCollection({
  loader: directusLoader('allPriceItems', () =>
    directusGet(
      `/items/price_items${directusQuery({
        fields: 'id,sort,name,price,unit,note,procedure.slug',
        filter: JSON.stringify({ procedure: { status: { _eq: 'published' } } }),
        sort: 'sort',
      })}`,
    ),
  ),
  schema: z.object({
    id: z.number(),
    sort: z.number().nullable().optional(),
    name: z.string(),
    price: z.number().nullable().optional(),
    unit: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    procedure: z.object({ slug: z.string() }).nullable().optional(),
  }),
});
```

- [ ] **Step 3: Register the collection**

Current (`src/content.config.ts:458-471`):

```ts
export const collections = {
  home,
  siteSettings,
  serviceCategories,
  devices,
  homeCases,
  homeReviews,
  procedures,
  pages,
  caseCategories,
  allCases,
  allFaq,
  allReviews,
};
```

Change to:

```ts
export const collections = {
  home,
  siteSettings,
  serviceCategories,
  devices,
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
```

- [ ] **Step 4: Regenerate Astro's content types and type-check**

Run: `npm run check`
Expected: no diagnostics referencing `content.config.ts`. (This also regenerates `.astro/types.d.ts` so `getCollection('allPriceItems')` type-checks in Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: add allPriceItems collection and procedures.icd10"
```

---

### Task 4: `getPriceItemsForProcedure()` and `getPriceListGrouped()`

**Files:**
- Modify: `src/lib/procedureContent.ts`

- [ ] **Step 1: Add the import and the two functions**

Current top of `src/lib/procedureContent.ts`:

```ts
import { getCollection } from 'astro:content';
import { directusImage } from './media';
import { bySort } from './directus';
```

Change to:

```ts
import { getCollection } from 'astro:content';
import { directusImage } from './media';
import { bySort } from './directus';
import { getAllCategories } from './categoryContent';
```

Append to the end of the file (after `procedureGallery`):

```ts
export interface PriceItem {
  name: string;
  price: number | null;
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
```

There's no unit test for these two functions: both call `astro:content`'s `getCollection()`, which only resolves inside an Astro build/dev context (the same reason `getCasesForProcedure`/`getFaqForProcedure` above them have none either — see `docs/superpowers/plans/2026-09-11-result-page-category-filter.md:131` for the precedent). Verification happens in Task 8 against the real build.

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new diagnostics. (This will still report the pre-existing "Directus unreachable" build error if `.env` doesn't exist yet — that's expected until Task 8; confirm there are no *type* errors in the diff specifically.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/procedureContent.ts
git commit -m "feat: add getPriceItemsForProcedure and getPriceListGrouped"
```

---

### Task 5: `PriceTable` component

**Files:**
- Create: `src/components/pricing/PriceTable.astro`

- [ ] **Step 1: Write the component**

```astro
---
import { formatPrice } from '../../lib/markup';
import type { PriceItem } from '../../lib/procedureContent';

interface Props {
  items: PriceItem[];
  showPrices: boolean;
  contextLabel: string;
  icd10?: string | null;
}
const { items, showPrices, contextLabel, icd10 } = Astro.props;
---

{
  items.length > 0 && (
    <div class="price-table">
      {icd10 && <p class="price-table__icd">МКБ-10: {icd10}</p>}
      <table>
        <tbody>
          {items.map((item) => {
            const amount = showPrices ? formatPrice(item.price) : null;
            return (
              <tr>
                <td>
                  {item.name}
                  {item.unit && <span class="price-table__unit"> · {item.unit}</span>}
                </td>
                <td class="price-table__amount">
                  {amount && amount}
                  {!amount && showPrices && item.note && <span class="price-table__note">{item.note}</span>}
                  {!amount && (!showPrices || !item.note) && (
                    <button type="button" class="text-link price-table__cta" data-open-sheet data-context={contextLabel}>
                      Узнать цену <span>↗</span>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )
}

<style>
  .price-table {
    max-width: 760px;
  }
  .price-table__icd {
    margin: 0 0 16px;
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .price-table table {
    width: 100%;
    border-collapse: collapse;
  }
  .price-table td {
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
    vertical-align: baseline;
  }
  .price-table__unit {
    color: var(--muted);
    font-size: 12px;
  }
  .price-table__amount {
    text-align: right;
    white-space: nowrap;
    padding-left: 20px;
    font: 400 16px var(--display);
    color: var(--gold-deep);
  }
  .price-table__note {
    font-size: 13px;
    color: var(--muted);
  }
  .price-table__cta {
    gap: 8px;
    padding: 0;
    border-bottom: none;
    font-size: 11px;
  }
  .price-table__cta span {
    font-size: 14px;
  }
</style>
```

`amount` is a plain string (from `formatPrice`), never itself falsy-but-truthy-looking except `""`, which `formatPrice` never returns — the three branches above are mutually exclusive: formatted amount, or a "price on request" note (only when prices are shown but this row has none), or the "ask" CTA (prices hidden site-wide, or no note was written for an on-request row).

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new diagnostics.

- [ ] **Step 3: Commit**

```bash
git add src/components/pricing/PriceTable.astro
git commit -m "feat: add PriceTable component"
```

---

### Task 6: Render prices on the procedure page

**Files:**
- Modify: `src/templates/ProcedurePage.astro`

- [ ] **Step 1: Import and fetch**

Current (`src/templates/ProcedurePage.astro:1-11`):

```astro
---
import { Image } from 'astro:assets';
import Page from '../layouts/Page.astro';
import Breadcrumbs from '../components/seo/Breadcrumbs.astro';
import Faq from '../components/faq/Faq.astro';
import CaseCard from '../components/results/CaseCard.astro';
import { em, telHref, whatsappHref } from '../lib/markup';
import { getSiteSettings } from '../lib/siteContent';
import { getCasesForProcedure, getFaqForProcedure, procedureGallery } from '../lib/procedureContent';
import { directusImage } from '../lib/media';
import type { CollectionEntry } from 'astro:content';
```

Change to:

```astro
---
import { Image } from 'astro:assets';
import Page from '../layouts/Page.astro';
import Breadcrumbs from '../components/seo/Breadcrumbs.astro';
import Faq from '../components/faq/Faq.astro';
import CaseCard from '../components/results/CaseCard.astro';
import PriceTable from '../components/pricing/PriceTable.astro';
import { em, telHref, whatsappHref } from '../lib/markup';
import { getSiteSettings } from '../lib/siteContent';
import { getCasesForProcedure, getFaqForProcedure, getPriceItemsForProcedure, procedureGallery } from '../lib/procedureContent';
import { directusImage } from '../lib/media';
import type { CollectionEntry } from 'astro:content';
```

Current (`src/templates/ProcedurePage.astro:19-22`):

```ts
const site = await getSiteSettings();
const cases = await getCasesForProcedure(p.slug);
const faq = await getFaqForProcedure(p.slug);
const gallery = procedureGallery(p.gallery);
```

Change to:

```ts
const site = await getSiteSettings();
const cases = await getCasesForProcedure(p.slug);
const faq = await getFaqForProcedure(p.slug);
const priceItems = await getPriceItemsForProcedure(p.slug);
const gallery = procedureGallery(p.gallery);
```

- [ ] **Step 2: Add the pricing section**

Current (`src/templates/ProcedurePage.astro:120-138`, the `proc-medical` section, immediately followed by the `proc-cases` section):

```astro
  {
    (p.indications || p.contraindications) && (
      <section class="section proc-medical reveal">
        {p.indications && (
          <div>
            <h2>Показания</h2>
            <div class="prose" set:html={p.indications} />
          </div>
        )}
        {p.contraindications && (
          <div>
            <h2>Противопоказания</h2>
            <div class="prose" set:html={p.contraindications} />
            <p class="proc-medical__disclaimer">{site.contraindications_text}</p>
          </div>
        )}
      </section>
    )
  }

  {
    cases.length > 0 && (
```

Change to (adds the new section between the two existing ones, nothing else in this range changes):

```astro
  {
    (p.indications || p.contraindications) && (
      <section class="section proc-medical reveal">
        {p.indications && (
          <div>
            <h2>Показания</h2>
            <div class="prose" set:html={p.indications} />
          </div>
        )}
        {p.contraindications && (
          <div>
            <h2>Противопоказания</h2>
            <div class="prose" set:html={p.contraindications} />
            <p class="proc-medical__disclaimer">{site.contraindications_text}</p>
          </div>
        )}
      </section>
    )
  }

  {
    priceItems.length > 0 && (
      <section class="section proc-pricing reveal" aria-labelledby="proc-pricing-title">
        <p class="eyebrow">Стоимость</p>
        <h2 id="proc-pricing-title">Цены на «{p.title}»</h2>
        <PriceTable items={priceItems} showPrices={site.show_prices} icd10={p.icd10} contextLabel={p.title} />
      </section>
    )
  }

  {
    cases.length > 0 && (
```

- [ ] **Step 3: Add the heading to the existing shared selector**

Current (`src/templates/ProcedurePage.astro:232-237`):

```css
  .proc-steps h2,
  .proc-cases h2,
  .proc-medical h2 {
    font-size: var(--t-h2-s);
    margin: 10px 0 36px;
  }
```

Change to:

```css
  .proc-steps h2,
  .proc-cases h2,
  .proc-medical h2,
  .proc-pricing h2 {
    font-size: var(--t-h2-s);
    margin: 10px 0 36px;
  }
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: no new diagnostics.

- [ ] **Step 5: Commit**

```bash
git add src/templates/ProcedurePage.astro
git commit -m "feat: render price table on procedure pages"
```

---

### Task 7: Price-list accordion on `/uslugi-i-ceny`

**Files:**
- Modify: `src/pages/uslugi-i-ceny.astro`

- [ ] **Step 1: Import and fetch**

Current (`src/pages/uslugi-i-ceny.astro:1-15`):

```astro
---
import { Image } from 'astro:assets';
import Page from '../layouts/Page.astro';
import Breadcrumbs from '../components/seo/Breadcrumbs.astro';
import Faq from '../components/faq/Faq.astro';
import { em } from '../lib/markup';
import { getAllCategories } from '../lib/categoryContent';
import { directusImage } from '../lib/media';
import { getCollection } from 'astro:content';
import { bySort } from '../lib/directus';

const categories = await getAllCategories();
const faq = bySort(await getCollection('allFaq'))
  .filter((f) => f.data.scope === 'general')
  .map((f) => ({ question: f.data.question, answer: f.data.answer ?? '' }));
---
```

Change to:

```astro
---
import { Image } from 'astro:assets';
import Page from '../layouts/Page.astro';
import Breadcrumbs from '../components/seo/Breadcrumbs.astro';
import Faq from '../components/faq/Faq.astro';
import PriceTable from '../components/pricing/PriceTable.astro';
import { em } from '../lib/markup';
import { getAllCategories } from '../lib/categoryContent';
import { getPriceListGrouped } from '../lib/procedureContent';
import { getSiteSettings } from '../lib/siteContent';
import { directusImage } from '../lib/media';
import { getCollection } from 'astro:content';
import { bySort } from '../lib/directus';

const categories = await getAllCategories();
const site = await getSiteSettings();
const priceGroups = await getPriceListGrouped();
const faq = bySort(await getCollection('allFaq'))
  .filter((f) => f.data.scope === 'general')
  .map((f) => ({ question: f.data.question, answer: f.data.answer ?? '' }));
---
```

- [ ] **Step 2: Add the pricing section**

Current (`src/pages/uslugi-i-ceny.astro:27-53`, everything between the services grid and the FAQ):

```astro
  <section class="section services-grid" aria-label="Направления услуг">
    <h2 class="visually-hidden">Направления услуг</h2>
    <div class="services-grid__list">
      {
        categories.map((c, i) => {
          const cover = directusImage(c.data.cover);
          return (
          <a class="services-card reveal" href={`/${c.data.slug}`}>
            {cover && (
              <Image src={cover.src} alt={c.data.cover_alt || c.data.title} width={700} height={900} sizes="(max-width: 800px) 84vw, 33vw" loading="lazy" />
            )}
            <span class="services-card__number">{String(i + 1).padStart(2, '0')}</span>
            <div class="services-card__content">
              <p>{c.data.tagline}</p>
              <h3 set:html={em(c.data.title)} />
              <span class="round-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </a>
          );
        })
      }
    </div>
  </section>

  <Faq items={faq} eyebrow="Перед визитом" title="Общие вопросы" />
```

Change to:

```astro
  <section class="section services-grid" aria-label="Направления услуг">
    <h2 class="visually-hidden">Направления услуг</h2>
    <div class="services-grid__list">
      {
        categories.map((c, i) => {
          const cover = directusImage(c.data.cover);
          return (
          <a class="services-card reveal" href={`/${c.data.slug}`}>
            {cover && (
              <Image src={cover.src} alt={c.data.cover_alt || c.data.title} width={700} height={900} sizes="(max-width: 800px) 84vw, 33vw" loading="lazy" />
            )}
            <span class="services-card__number">{String(i + 1).padStart(2, '0')}</span>
            <div class="services-card__content">
              <p>{c.data.tagline}</p>
              <h3 set:html={em(c.data.title)} />
              <span class="round-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </a>
          );
        })
      }
    </div>
  </section>

  {
    priceGroups.length > 0 && (
      <section class="section pricing reveal" aria-labelledby="pricing-title">
        <p class="eyebrow">Стоимость</p>
        <h2 id="pricing-title">Прайс-лист</h2>
        {
          priceGroups.map((group) => (
            <div class="pricing__category">
              <h3>{group.title}</h3>
              <div class="pricing__list">
                {
                  group.procedures.map((proc) => (
                    <details class="pricing__item">
                      <summary>
                        <span>{proc.title}</span>
                        <span class="pricing__chevron" aria-hidden="true">
                          ↓
                        </span>
                      </summary>
                      <PriceTable items={proc.items} showPrices={site.show_prices} icd10={proc.icd10} contextLabel={proc.title} />
                    </details>
                  ))
                }
              </div>
            </div>
          ))
        }
      </section>
    )
  }

  <Faq items={faq} eyebrow="Перед визитом" title="Общие вопросы" />
```

- [ ] **Step 3: Add styles**

Current end of `<style>` block in `src/pages/uslugi-i-ceny.astro` (the closing `@media (max-width: 800px)` rule, right before the file's final `</style>`):

```css
  @media (max-width: 800px) {
    .services-grid__list {
      display: flex;
      overflow-x: auto;
      gap: 10px;
      margin-right: -18px;
      padding-right: 18px;
    }
    .services-card {
      flex: 0 0 84vw;
      height: 520px;
    }
  }
</style>
```

Change to (adds the pricing rules, keeps the existing media query as-is):

```css
  @media (max-width: 800px) {
    .services-grid__list {
      display: flex;
      overflow-x: auto;
      gap: 10px;
      margin-right: -18px;
      padding-right: 18px;
    }
    .services-card {
      flex: 0 0 84vw;
      height: 520px;
    }
  }

  .pricing h2 {
    font-size: var(--t-h2-s);
    margin: 10px 0 36px;
  }
  .pricing__category {
    max-width: 760px;
    margin-bottom: 48px;
  }
  .pricing__category h3 {
    font: 400 26px var(--display);
    margin: 0 0 16px;
  }
  .pricing__list {
    border-top: 1px solid var(--line);
  }
  .pricing__item {
    border-bottom: 1px solid var(--line);
  }
  .pricing__item summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 18px 0;
    cursor: pointer;
    font-size: 15px;
  }
  .pricing__chevron {
    color: var(--gold-deep);
    transition: transform var(--dur-fast);
  }
  .pricing__item[open] .pricing__chevron {
    transform: rotate(180deg);
  }
  .pricing__item .price-table {
    padding-bottom: 20px;
  }
</style>
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: no new diagnostics.

- [ ] **Step 5: Commit**

```bash
git add src/pages/uslugi-i-ceny.astro
git commit -m "feat: price-list accordion on /uslugi-i-ceny"
```

---

### Task 8: Seed QA data and verify against a real build

**Files:** none (verification + one-off content seed)

- [ ] **Step 1: Create `.env` for local build/dev if it doesn't exist**

```bash
cd /root/peri-clinnic.ru
test -f .env || cp .env.claude .env
```

- [ ] **Step 2: Seed one procedure with price items and an ICD-10 code, for QA**

This writes real (but clearly placeholder) content to the dev Directus via the Editor token, so there's something to see in Steps 3–5. It uses `/botullinoterapiya` (a real procedure slug). Replace the placeholder numbers/code with real ones from the clinic before this goes live with `show_prices` on — that's a content task for the clinic, not part of this plan.

```bash
cd /root/peri-clinnic.ru
source .env.claude

proc_id=$(curl -s "$DIRECTUS_URL/items/procedures?filter[slug][_eq]=botullinoterapiya&fields=id" \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data[0].id))')
echo "procedure id: $proc_id"

curl -s -X PATCH "$DIRECTUS_URL/items/procedures/$proc_id" \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" -H "Content-Type: application/json" \
  -d '{"icd10":"L90.5 (плейсхолдер — уточнить у врача)"}'

curl -s -X POST "$DIRECTUS_URL/items/price_items" \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"procedure\":$proc_id,\"sort\":1,\"name\":\"Лоб\",\"price\":15000,\"unit\":\"за зону\"}"

curl -s -X POST "$DIRECTUS_URL/items/price_items" \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"procedure\":$proc_id,\"sort\":2,\"name\":\"Межбровье\",\"price\":12000,\"unit\":\"за зону\"}"

curl -s -X POST "$DIRECTUS_URL/items/price_items" \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"procedure\":$proc_id,\"sort\":3,\"name\":\"Коррекция гипергидроза\",\"note\":\"Цена определяется на консультации\"}"
```

Expected: three `201`-style JSON responses (each echoing back the created row with an `id`).

- [ ] **Step 3: Build with `show_prices` off (the default) and check the "hidden" behaviour**

```bash
npm run build && npm run preview &
sleep 2
```

Open `http://127.0.0.1:4322/botullinoterapiya` and `http://127.0.0.1:4322/uslugi-i-ceny` in a browser and confirm:
- The procedure page shows a "Цены на «Ботулинотерапия»" section with three rows (Лоб, Межбровье, Коррекция гипергидроза), each ending in an "Узнать цену" link (no numbers shown, since `show_prices` is `false` by default) that opens the contact sheet when clicked.
- The "МКБ-10: L90.5 (плейсхолдер — уточнить у врача)" line appears above the table.
- `/uslugi-i-ceny` has a "Прайс-лист" section below the 3 category cards, with "Инъекционная косметология" (or whichever category `botullinoterapiya` belongs to) containing a collapsed "Ботулинотерапия" row; clicking it expands to the same three price rows.

- [ ] **Step 4: Flip `show_prices` on and re-verify**

```bash
source .env.claude
site_id=$(curl -s "$DIRECTUS_URL/items/site_settings" -H "Authorization: Bearer $DIRECTUS_TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.id))')
curl -s -X PATCH "$DIRECTUS_URL/items/site_settings/$site_id" \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" -H "Content-Type: application/json" \
  -d '{"show_prices":true}'
kill %1 2>/dev/null
npm run build && npm run preview &
sleep 2
```

Reopen the same two pages and confirm:
- "Лоб" and "Межбровье" now show `15 000 ₽` / `12 000 ₽` instead of the CTA link.
- "Коррекция гипергидроза" shows the note text "Цена определяется на консультации" instead of a number or a CTA.

- [ ] **Step 5: Accessibility check**

```bash
node scripts/qa/a11y.mjs http://127.0.0.1:4322 /uslugi-i-ceny /botullinoterapiya
```

Expected: exit code 0, no serious/critical violations.

- [ ] **Step 6: Stop the preview server**

```bash
kill %1 2>/dev/null
```

- [ ] **Step 7: Decide what to do with the seed data**

The three price rows and the ICD-10 code created in Step 2 are real content now (not deleted automatically). Either: (a) leave them and ask the clinic to correct the numbers/code and set `show_prices` to the real intended value, or (b) delete the three `price_items` rows and clear `procedures.icd10`/`site_settings.show_prices` via the same curl pattern as above if this was purely a QA exercise. This is a decision for whoever owns the content, not an automated step — flag it explicitly when handing off this plan's result.
