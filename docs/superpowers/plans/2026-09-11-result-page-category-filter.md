# Result Page Category Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/result` from a handful of stray before/after photos into a full gallery of all 28 published cases, each captioned, with an interactive category filter bar.

**Architecture:** `src/pages/result.astro` fetches `allCases` (already includes `category.slug`/`category.title`) and `caseCategories` (already sorted), flattens today's per-category `<section>` grouping into one grid, and renders a row of filter buttons above it. `CaseCard.astro` gains a `categorySlug` prop so each card carries `data-category` for filtering. A new `src/scripts/results-filter.ts` (same plain-DOM idiom as `menu.ts`/`header.ts`) wires button clicks to show/hide cards — no framework, no routing, no animation.

**Tech Stack:** Astro (`.astro` components + scoped `<style>`), vanilla TypeScript for behaviour (`src/scripts/`), existing `astro:content` collections — no new dependencies.

**Context you need before starting:**
- The content-visibility bug (`needs_review: true` hiding 25 of 28 cases) is already fixed in Directus — not part of this plan. This plan is UI-only.
- `src/content.config.ts:390-411` defines `allCases` — each entry's `.data` has `title: string`, `result: string | null`, `category: { slug: string; title: string } | null`, `before`/`after`/`combined` (file refs, pass through `directusImage()` from `src/lib/media.ts`).
- `src/content.config.ts:384-387` defines `caseCategories` — each entry's `.data` has `slug: string`, `title: string`, `sort: number | null`.
- `src/lib/directus.ts:57-59` exports `bySort()` — always wrap `getCollection()` results with it; Astro's content layer discards Directus `sort` order otherwise.
- Read `src/pages/result.astro` and `src/components/results/CaseCard.astro` in full before starting — Task 1 and Task 2 below replace most of both files.

---

### Task 1: Add `categorySlug` to `CaseCard`

**Files:**
- Modify: `src/components/results/CaseCard.astro`

- [ ] **Step 1: Add the prop and the `data-category` attribute**

In `src/components/results/CaseCard.astro`, the current top of the file is:

```astro
---
import { Image } from 'astro:assets';

interface ImgRef {
  src: string;
  width: number;
  height: number;
}
interface Props {
  title: string;
  result?: string;
  category?: string;
  before?: ImgRef | null;
  after?: ImgRef | null;
  combined?: ImgRef | null;
}
const { title, result, category, before, after, combined } = Astro.props;
const hasPair = before && after;
const single = combined ?? after ?? before;
---

<article class="case-card reveal">
```

Change it to:

```astro
---
import { Image } from 'astro:assets';

interface ImgRef {
  src: string;
  width: number;
  height: number;
}
interface Props {
  title: string;
  result?: string;
  category?: string;
  categorySlug?: string;
  before?: ImgRef | null;
  after?: ImgRef | null;
  combined?: ImgRef | null;
}
const { title, result, category, categorySlug, before, after, combined } = Astro.props;
const hasPair = before && after;
const single = combined ?? after ?? before;
---

<article class="case-card reveal" data-category={categorySlug ?? ''}>
```

Nothing else in the file changes — `category` (the title) was already rendered by the existing `{category && <p class="case-card__category">{category}</p>}` line further down.

- [ ] **Step 2: Sanity-check with astro check**

Run: `npm run check`
Expected: no new diagnostics (the added prop is optional, so existing callers that don't pass `categorySlug` still type-check).

- [ ] **Step 3: Commit**

```bash
git add src/components/results/CaseCard.astro
git commit -m "feat: CaseCard accepts categorySlug for filtering"
```

---

### Task 2: Create the filter behaviour script

**Files:**
- Create: `src/scripts/results-filter.ts`

- [ ] **Step 1: Write the script**

```ts
/**
 * Category filter for /result: clicking a [data-filter] button shows only the
 * [data-category] cards whose value matches (or all of them, for the "Все" button
 * whose data-filter is "all"). Plain show/hide — no routing, no animation — matching
 * the rest of the site's interactive scripts (see menu.ts, header.ts).
 */
export function initResultsFilter(root: HTMLElement | null): void {
  if (!root) return;
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-filter]');
  const cards = root.querySelectorAll<HTMLElement>('[data-category]');
  if (!buttons.length || !cards.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter ?? 'all';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      cards.forEach((card) => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });
}
```

There is no unit test for this file: the repo's `npm test` only covers pure-logic files under `src/lib/*.test.ts` (see `src/lib/markup.test.ts`) — DOM-manipulating scripts (`menu.ts`, `header.ts`, `contact-sheet.ts`, `rail.ts`) have none either, since there's no jsdom dependency in `package.json`. Verification for this file happens in Task 4 (real browser + a11y script), matching how the existing scripts are verified.

- [ ] **Step 2: Commit**

```bash
git add src/scripts/results-filter.ts
git commit -m "feat: add results category filter script"
```

---

### Task 3: Rewrite `/result` to use a flat grid + filter bar

**Files:**
- Modify: `src/pages/result.astro`

- [ ] **Step 1: Replace the frontmatter and template**

Replace the entire file content (frontmatter + template, keep going until the `<style>` block) with:

```astro
---
import Page from '../layouts/Page.astro';
import Breadcrumbs from '../components/seo/Breadcrumbs.astro';
import CaseCard from '../components/results/CaseCard.astro';
import { directusImage } from '../lib/media';
import { getCollection } from 'astro:content';
import { bySort } from '../lib/directus';

const cases = bySort(await getCollection('allCases'));
const categories = bySort(await getCollection('caseCategories')).filter((cat) =>
  cases.some((c) => c.data.category?.slug === cat.data.slug),
);
---

<Page title="Результаты до и после — PERI CLINIC" description="Реальные результаты пациентов PERI CLINIC: аппаратная и инъекционная косметология, эстетические процедуры. Каждый результат индивидуален.">
  <Breadcrumbs slot="head" items={[{ name: 'Результаты', href: '/result' }]} />

  <section class="results-hero reveal">
    <p class="eyebrow">До и после</p>
    <h1>Результаты,<br /><em>которые говорят сами</em></h1>
    <p class="results-hero__lead">Реальные пациенты PERI CLINIC. Каждый результат индивидуален и зависит от исходных данных и плана коррекции.</p>
  </section>

  <section class="section results-gallery" data-results-filter aria-labelledby="results-heading">
    <h2 id="results-heading" class="visually-hidden">Результаты по категориям</h2>

    <div class="results-filter" role="group" aria-label="Фильтр по категории">
      <button type="button" class="results-filter__btn" data-filter="all" aria-pressed="true">Все</button>
      {
        categories.map((cat) => (
          <button type="button" class="results-filter__btn" data-filter={cat.data.slug} aria-pressed="false">
            {cat.data.title}
          </button>
        ))
      }
    </div>

    <div class="results-gallery__grid">
      {
        cases.map((c) => (
          <CaseCard
            title={c.data.title}
            result={c.data.result ?? ''}
            category={c.data.category?.title}
            categorySlug={c.data.category?.slug}
            before={directusImage(c.data.before)}
            after={directusImage(c.data.after)}
            combined={directusImage(c.data.combined)}
          />
        ))
      }
    </div>
  </section>
</Page>
```

- [ ] **Step 2: Replace the `<style>` block**

The current file ends with a `<style>` block containing `.results-hero`, `.results-group`, `.results-group h2`, `.results-group__grid`. Replace the whole block with:

```astro
<style>
  .results-hero {
    max-width: var(--container);
    margin: auto;
    padding: 60px var(--gutter) 20px;
  }
  .results-hero h1 {
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(40px, 6vw, 76px);
    line-height: 0.98;
    margin: 0 0 28px;
  }
  .results-hero h1 em {
    color: var(--gold);
    font-style: italic;
  }
  .results-hero__lead {
    color: var(--muted);
    font-size: 15px;
    line-height: 1.7;
    max-width: 62ch;
  }
  .results-gallery {
    padding-top: 0;
  }
  .results-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0 0 32px;
  }
  .results-filter__btn {
    border: 1px solid var(--gold-deep);
    border-radius: 999px;
    background: transparent;
    color: var(--gold-deep);
    padding: 10px 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transition:
      background var(--dur-fast),
      color var(--dur-fast);
  }
  .results-filter__btn[aria-pressed='true'] {
    background: var(--gold-deep);
    color: #fff;
  }
  .results-gallery__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px;
  }
  .results-gallery__grid .is-hidden {
    display: none;
  }
</style>
```

- [ ] **Step 3: Add the behaviour script**

Immediately after the `<style>` block (end of file), add:

```astro
<script>
  import { initResultsFilter } from '../scripts/results-filter';
  initResultsFilter(document.querySelector('[data-results-filter]'));
</script>
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: no new diagnostics.

- [ ] **Step 5: Commit**

```bash
git add src/pages/result.astro
git commit -m "feat: interactive category filter on /result"
```

---

### Task 4: Verify against a real build

**Files:** none (verification only)

- [ ] **Step 1: Build against live Directus**

Run: `cd /root/peri-clinnic.ru && npm run build`
Expected: build succeeds, no errors mentioning `result.astro` or `CaseCard`.

- [ ] **Step 2: Preview and manually check the page**

Run: `npm run preview` (serves `dist/` on `http://127.0.0.1:4322`)

Open `http://127.0.0.1:4322/result` in a browser and confirm:
- All 8 category buttons + "Все" are visible, "Все" starts active (filled gold background).
- Every one of the 28 cards shows a title, a category eyebrow label, and (when present) result text — not just bare images.
- Clicking each category button leaves only that category's cards visible; clicking "Все" restores all of them.
- Keyboard-only pass: `Tab` through the filter bar, `Enter`/`Space` activates a button, focus ring visible (gold outline from `:focus-visible` in `base.css`).
- Confirm exactly one button has `aria-pressed="true"` at all times (inspect via devtools).

- [ ] **Step 3: Run the accessibility check**

Run: `node scripts/qa/a11y.mjs http://127.0.0.1:4322 /result`
Expected: exit code 0, no serious/critical violations reported.

- [ ] **Step 4: Stop the preview server**

Kill the `npm run preview` process (Ctrl+C) once steps 2–3 are done.
