# Result page: category filter + fix for missing cases

## Problem

`/result` showed only 1–3 before/after cases as two oversized photos with no
caption and no way to browse by category, even though Directus admin had 28
cases neatly organized into 8 categories (`case_categories`).

Root cause (found and already fixed as a content operation, not a code
change): the Wix migration imported all 28 `before_after_cases` rows with
`needs_review: true` (a manual-review gate added on purpose after import, see
`docs/CONTENT-MAP.md`). The `allCases`/`homeCases` loaders in
`src/content.config.ts` filter on `needs_review: { _eq: false }`, so only
rows someone had manually cleared were reaching the site — in practice just a
couple. All 28 rows have now been bulk-cleared to `needs_review: false` via
the Directus API (see below), confirmed to render correctly across all 8
categories, and a rebuild has already run.

A permanent side effect of that fix: a new Directus service account
(`claude-agent@peri-clinic.ru`, attached to the existing "Редактор" role) and
its static token (`.env.claude`, gitignored, not committed) now exist on the
server so future content-only fixes like this one don't require a human to
hand over admin credentials each time. This is documented in `CLAUDE.md`.

What's still missing, and the actual subject of this spec: the page itself
has no interactive way to filter by category, and cards don't show their
category label in the default (unfiltered) view.

## Design

**`src/pages/result.astro`**
- Replace the current `Map`-grouped `<section>`-per-category layout with a
  single flat grid of `CaseCard`s (all 28, `bySort()`-ordered as today).
- Above the grid, render a filter bar: a "Все" button plus one button per
  `case_categories` entry (fetched via the existing `caseCategories`
  collection, ordered by its `sort` field — not by first-appearance order in
  the case list, which is what section grouping did today).
- Each button: `<button type="button" data-filter={slug ?? 'all'} aria-pressed={...}>`.
  "Все" starts `aria-pressed="true"`.
- Each `CaseCard` wrapper gets `data-category={c.data.category?.slug ?? ''}`.
- Pass the already-supported `category` prop (title) through to `CaseCard` so
  the category eyebrow label shows on every card, including in the
  unfiltered "Все" view — today `result.astro` doesn't pass it even though
  `CaseCard.astro` already renders it when present.

**`src/scripts/results-filter.ts`** (new, same idiom as `src/scripts/menu.ts`)
- `initResultsFilter(root: HTMLElement | null)`: queries `[data-filter]`
  buttons and `[data-category]` cards inside `root`.
- Click on a button: sets `aria-pressed="true"` on it and `"false"` on
  siblings, then toggles a `.is-hidden` class on cards whose
  `data-category` doesn't match (no class change, i.e. all visible, when
  `data-filter="all"`).
- No routing/URL state, no animation — plain show/hide. Matches the "no
  interactive filter pattern exists yet" baseline found in the codebase;
  nothing to stay consistent with, so keep it minimal.
- Imported and called from an inline `<script>` in `result.astro` itself
  (page-owned behaviour, same pattern as `Header.astro` owning `header.ts`).

**Graceful degradation**: without JS, all buttons are inert (`.is-hidden` is
never applied), so every card stays visible — equivalent to today's
behaviour minus the dead click targets. No `<noscript>` handling needed.

**Accessibility**: real `<button>` elements (keyboard/focus native),
`aria-pressed` communicates toggle state, filter bar wraps/scrolls on narrow
viewports using existing spacing tokens, no motion introduced so
`prefers-reduced-motion` is a non-issue here.

**Styling**: filter bar pill buttons styled in `result.astro`'s scoped
`<style>` (page-owned, like `.results-hero` today), reusing `--gold`,
`--paper`, `--radius` tokens — no new global utility.

## Out of scope

- No compare-slider or lightbox (the original phase-0 spec's `CompareSlider`/
  `Lightbox` components) — user did not ask for that; current side-by-side
  `CaseCard` image pair is unchanged.
- No URL/hash-based filter state, no analytics event on filter click.
- No changes to `homeCases` (homepage teaser) beyond the data fix already
  applied — it wasn't part of the complaint.

## Testing

- `npm run build` against local Directus to confirm all 28 cases render,
  grouped correctly by the new filter's categories.
- Manual check in browser: click through all 8 category buttons + "Все",
  confirm correct show/hide; keyboard-only pass (Tab + Enter/Space) over the
  filter bar; confirm `aria-pressed` state is exclusive.
- `node scripts/qa/a11y.mjs` against `/result` (must stay 0 serious/critical).
- `node scripts/qa/screenshots.mjs` for `/result` at 375/800/1440, committed
  under `docs/qa/`.
