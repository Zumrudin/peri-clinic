# Homepage "Направления" block: desktop three-column card redesign

## Background

The homepage Categories block (`src/components/home/Categories.astro`) shows
the site's 3 top-level `service_categories` (Аппаратная / Инъекционная /
Эстетическая косметология). Today, at every width down to 800px, it's a
"bento" grid (`1.15fr 1fr 1fr`) of full-bleed portrait photo cards, fixed
`height: 610px` (520px ≤1100px), dark gradient scrim, white overlaid text, a
numbered chip (`01`/`02`/`03`) and a dark glass-chip round arrow (`↗`).

A prepared visual reference
(`https://dev.zumrudin.ru/peri-concepts/directions-desktop-2026-09-12/03-three-columns.png`,
1536×1024) shows a different desktop composition: three light cards in one
row (40/30/30 width split), each with a top photo (~55–60% of card height)
and a solid-colour text panel below (title, short description, gold circular
arrow), plus a consultation hint plaque underneath the row.

Decisions made during brainstorming:

- **Desktop only.** The mobile (`≤800px`) horizontal scroll-rail is left
  completely untouched. The already-approved "wide tile + two tiles"
  mobile composition
  (`docs/superpowers/specs/2026-09-12-directions-mobile-tiles-design.md`)
  is a **separate, not-yet-implemented task** — this spec does not build it,
  and is written so that task can land afterwards without conflict (see
  "Out of scope" and the `:global()`/media-query discipline used throughout
  §Design).
- Card tint mapping is **positional** (1st/2nd/3rd card), not by category
  slug — same trade-off the mobile spec already made, since these three
  categories are fixed, editorially-stable content, not a reorderable list.
- The mobile spec's `.round-arrow-gold` pattern (gold circle, white `→`,
  non-focusable, whole-card link) is reused here (sized up for desktop)
  instead of the sitewide dark `.round-arrow`/`↗`, so the two breakpoints
  converge on one arrow visual language once both ship.
- The two non-token background tints introduced by the mobile spec
  (`--tile-injection-bg`, `--tile-aesthetic-bg`) are reused verbatim rather
  than re-derived, so column 2/3 read identically at every breakpoint.
- The consultation hint plaque's copy ("Не знаете, что выбрать? / Начните с
  консультации") is user-facing marketing copy, so per this project's core
  rule ("nothing user-facing is hardcoded") it gets **two new Directus
  fields** on the `home` singleton rather than being hardcoded in the
  template — mirroring the existing `categories_eyebrow`/`_title`/`_lead`
  pattern already on that same collection.
- Photos: no code/asset changes. `item.cover` (the existing Directus-driven
  `<Image>`) keeps rendering exactly as it does today — the redesign is
  purely a CSS/markup change around it. For review, three photos are cropped
  directly from the reference PNG and can be uploaded as the three
  categories' `cover` field on the **dev** Directus (`peri-cms.zumrudin.ru`)
  as a temporary, reviewer-only content change — not part of the code
  change, and not something to carry into production. Real clinic photos are
  selected and set by the client before merge.

## Design

### 1. Scope of changes

- `src/components/home/Categories.astro` — markup: pass `class` to
  `SectionHeading`, add one new arrow `<span>`, add the hint-plaque block.
  Scoped `<style>`: new rules, all either naturally inert on mobile (see
  each subsection) or explicitly gated behind `@media (min-width: 801px)`.
  **No line inside the existing `@media (max-width: 800px)` block is
  touched.**
- `directus/setup/collections.mjs` — 2 new fields on the `home` singleton,
  under the existing `d_categories` divider.
- `src/content.config.ts` — extend the `home` collection's zod schema and
  field-picking list with the 2 new keys.
- `src/lib/homeContent.ts` — surface the 2 new fields as `categories.hint`.
- No changes to `service_categories`, `src/content.config.ts`'s category
  schema, or any other homepage section.

### 2. Heading (desktop only)

`SectionHeading`'s existing `layout="grid"` default (title left, lead
right-column bottom-aligned, `src/components/ui/SectionHeading.astro:28-33`)
already matches the reference layout — no markup/structure change needed.
Pass `class="services__heading"` from `Categories.astro` (the prop already
exists, unused today) and, in `Categories.astro`'s own scoped `<style>`,
target the child component's internals with `:global()` — required because
`SectionHeading` has its own Astro scope hash, distinct from
`Categories.astro`'s (same technique the mobile spec uses for its own
`≤800px` heading tweaks, just gated the other direction):

```css
@media (min-width: 801px) {
  :global(.services__heading) {
    margin-bottom: 32px; /* was 66px */
  }
  :global(.services__heading h2) {
    font-size: clamp(44px, 3.6vw, 58px); /* was clamp(40px, 4.6vw, 72px) */
  }
  :global(.services__heading .section-heading__lead) {
    font-size: 19px; /* was 14px */
    line-height: 1.6;
  }
}
```

The eyebrow (`.eyebrow` — gold, uppercase, `0.18em` tracking, ~13px) already
matches the brief and needs no change. This override only fires `≥801px` and
only targets elements carrying `services__heading`, so every other page's
`SectionHeading` and this same page's `≤800px` rendering are unaffected.

### 3. Grid (desktop only)

Delete the existing `@media (max-width: 1100px)` block (it currently forces
equal 3 columns + fixed `520px` height — exactly what this redesign removes).
`.service-grid--bento { grid-template-columns: 1.15fr 1fr 1fr }` then applies
unconditionally from `801px` up to any width (≈40/30/30, matching the brief),
with a slightly wider gap on desktop:

```css
@media (min-width: 801px) {
  .service-grid--bento {
    gap: 20px;
  }
}
```

Three columns are preserved all the way down to the existing `800px`
boundary — below that, the (untouched) mobile rail takes over, satisfying
"adapt sizes first, never drop below 3 columns before switching to the
approved mobile composition."

### 4. Card container (desktop only)

```css
@media (min-width: 801px) {
  .service-card {
    height: auto;
    display: flex;
    flex-direction: column;
    background: none;
    color: var(--ink);
  }
  .service-card::after {
    display: none; /* remove the dark gradient scrim */
  }
  .service-card:hover {
    transform: none;
    box-shadow: none; /* hover feedback moves to the arrow, §7 */
  }
}
```

`overflow: hidden` and `border-radius: var(--radius-lg)` (existing,
unconditional rules) are left as-is — they already clip the photo's top
corners and the panel's bottom corners into one continuous rounded shape, so
no new radius rules are needed.

### 5. Photo (desktop only)

```css
@media (min-width: 801px) {
  .service-card :global(img) {
    flex: 0 0 auto;
    height: clamp(250px, 27vw, 300px); /* ~55–60% of a 440–520px card */
    filter: none; /* drop the mobile/legacy saturate(0.8) */
  }
  .service-card:hover :global(img) {
    transform: none;
    filter: none;
  }
}
```

`width: 100%; object-fit: cover` (existing, unconditional) is unaffected, so
each column's differently-cropped photo (col 1 wider than col 2/3) is
handled automatically. No `<Image>`/`sizes` prop changes — the current
`sizes="(max-width: 800px) 84vw, 33vw"` is a close enough approximation of
the real ~30–40% column widths for this task's scope.

### 6. Content panel (desktop only)

```css
@media (min-width: 801px) {
  .service-card__content {
    position: static;
    inset: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 28px;
    background: var(--sand);
  }
  .service-card:nth-child(2) .service-card__content {
    background: var(--tile-injection-bg);
  }
  .service-card:nth-child(3) .service-card__content {
    background: var(--tile-aesthetic-bg);
  }
  .service-card__content h3 {
    order: 1;
    font-size: clamp(30px, 2.6vw, 38px);
    line-height: 1.08;
    color: var(--ink);
  }
  .service-card__content p {
    order: 2;
    display: block;
    background: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    padding: 0;
    border-radius: 0;
    margin: 12px 0 0;
    font-size: clamp(15px, 1.1vw, 17px);
    line-height: 1.6;
    letter-spacing: normal;
    text-transform: none;
    opacity: 1;
    color: var(--muted);
  }
}
```

- `--tile-injection-bg: #e4dccf` / `--tile-aesthetic-bg: #dee1d6` are the
  same two custom properties the mobile spec introduces (§7 there),
  declared once on `.service-grid--bento` so both breakpoints share
  identical values once the mobile task lands. Column 1 reuses the existing
  `--sand` token, also matching the mobile spec's top-tile colour.
- The `p` override resets every property the global `.glass-chip`/
  `.glass-chip--dark` classes set (`display`, `background`,
  `backdrop-filter`, `padding`, `border-radius` — see `base.css:299-310`),
  turning the pill/chip into plain descriptive text. This is a
  component-scoped override of elements *rendered by this same file*
  (no `:global()` needed, unlike §2) and only fires `≥801px`, so the
  `≤800px` chip look (driven by the untouched global classes) is unaffected.
- `order: 1/2` visually reorders title-before-description (matching the
  reference) without changing the DOM, which stays tag-then-title — the
  same order used today — so mobile's stacking is untouched. This creates a
  visual/reading-order divergence on desktop only; verified acceptable
  against this project's a11y gate (§11), but flagged here as a deliberate,
  documented trade-off rather than an oversight.
- The `<h3>`'s "…косметология" line break relies on natural word-wrap at
  this column width/font-size — no manual `<br>` — so it keeps working if a
  title is edited in Directus.

### 7. Arrow button (desktop only, `.round-arrow-gold`)

One new, always-present-but-inert `<span>`, added after the existing
`<h3>` inside `.service-card__content`:

```html
<span class="round-arrow-gold" aria-hidden="true">→</span>
```

The existing `<span class="round-arrow glass-chip glass-chip--dark">↗</span>`
stays in the markup untouched, for mobile.

```css
.round-arrow-gold {
  display: none; /* inert until a breakpoint turns it on */
}
@media (min-width: 801px) {
  .round-arrow {
    display: none;
  }
  .round-arrow-gold {
    display: grid;
    place-items: center;
    order: 3;
    margin-top: auto;
    align-self: flex-end;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--gold);
    color: #fff;
    font-size: 20px;
    transition:
      transform var(--dur-fast),
      background var(--dur-fast);
  }
  .service-card:hover .round-arrow-gold {
    transform: translateX(3px);
    background: var(--gold-hover);
  }
}
```

`margin-top: auto` inside the flex column pins the arrow to the
bottom-right of the panel regardless of description length; combined with
§8's equal-height stretch, all three arrows land on the same horizontal
line. Not a separate focusable control — the whole `<a class="service-card">`
stays the single link. Keyboard focus uses the sitewide gold
`:focus-visible` outline (`base.css:70-73`) on that anchor; the outline is
not clipped by the card's own `overflow: hidden` (an element's outline is
never clipped by its own `overflow`).

### 8. Equal card heights, aligned edges

No explicit height rule is needed: `.service-grid--bento`'s default
`align-items: stretch` already makes every `.service-card` in the row match
the tallest one. The photo has a fixed `clamp()` height (§5) and the content
panel is `flex: 1` (§6), so any extra height (e.g. a description wrapping to
a 3rd line) is absorbed by the panel growing — keeping the photo/panel
seam and the card bottoms aligned across all three cards, per the brief.

### 9. Consultation hint plaque (new)

Markup, appended after the grid, inside the existing
`<section class="section services">`:

```html
<div class="services__hint glass-panel">
  <p class="services__hint-title">{categories.hint.title}</p>
  <button type="button" class="services__hint-cta" data-open-sheet data-context="Консультация">
    {categories.hint.ctaLabel} <span aria-hidden="true">→</span>
  </button>
</div>
```

- `[data-open-sheet][data-context="Консультация"]` reuses the sitewide
  contact-sheet convention exactly as `Cta.astro`/`TreatmentPage.astro` do
  — no new booking mechanism, opens the existing `<dialog>`.
- Styling (desktop only — see "Out of scope" for `≤800px`):
  `margin-top: 22px; min-height: 130px; padding: 32px 40px; display: flex;
  align-items: center; gap: 24px; border-radius: var(--radius-lg);`,
  composing the existing `glass-panel` utility class as-is (cream glass
  background) rather than redeclaring it. `.services__hint-title`:
  `font-size: 20px; color: var(--ink)`. `.services__hint-cta`: gold link
  styling matching the existing `.booking__quick a` pattern
  (`Cta.astro:104-118` — `color: var(--gold-deep)`, arrow in `var(--gold)`).
- No decorative leaf illustration in this pass (see "Out of scope") — the
  plaque is text-only for v1; a background image can be layered in later
  without a markup change.

**CMS**: two new fields on the `home` singleton
(`directus/setup/collections.mjs`), under the existing `d_categories`
divider, following the same `f.str(...)` pattern as the block's other
fields:

```js
f.str('categories_hint_title', 'Плашка: текст', { default: 'Не знаете, что выбрать?' }),
f.str('categories_hint_cta_label', 'Плашка: текст ссылки', { default: 'Начните с консультации' }),
```

Surfaced in `src/lib/homeContent.ts` as
`categories.hint = { title: h.categories_hint_title, ctaLabel: h.categories_hint_cta_label }`,
added to the `home` collection's zod schema and field-picking list in
`src/content.config.ts` (both currently at lines ~53-55 and ~98-100).
Requires re-running `schema.mjs` against `peri-cms.zumrudin.ru` and filling
the two values in Directus (the field defaults above act as the initial
value so the banner has real copy immediately after the schema apply).

### 10. Placeholder photos for review (not a code change)

Three photos cropped directly from the reference PNG
(`https://dev.zumrudin.ru/peri-concepts/directions-desktop-2026-09-12/03-three-columns.png`,
1536×1024), already verified clean (no card-corner artefacts, subject/action
visible):

| Crop rect (x1,y1,x2,y2) | Size | Intended category |
|---|---|---|
| `44,275,626,582` | 582×307 | Аппаратная косметология |
| `643,275,1055,582` | 412×307 | Инъекционная косметология |
| `1071,275,1493,582` | 422×307 | Эстетическая косметология |

Since the component keeps using `item.cover` unchanged (§1), these are not
added to the repo as assets. For a realistic review screenshot, upload them
as the three `service_categories` records' `cover` field on the **dev**
Directus instance only, take the QA screenshots (§11) against that content,
then leave the real photo choice to the client before this branch is
considered mergeable — reverting or replacing that dev-content change is
the client's call, not part of this code change.

### 11. Testing / QA

- `npm run check` — TS/Astro diagnostics.
- `node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/directions-desktop /`
  at 1024/1280/1440/1920 widths, committed under `docs/qa/directions-desktop/`.
  Also re-run the standard 375/800/1440 set to confirm `≤800px` is visually
  unchanged from `main`.
- `node scripts/qa/a11y.mjs http://127.0.0.1:4322 /` — 0 serious/critical;
  specifically re-check contrast for `var(--muted)` description text on all
  three panel tints, and the visual/DOM order divergence from §6.
- Manual checks: three columns at all four widths, no text clipping/overlap
  with the arrow, photo-top/panel-bottom seams and card bottoms aligned,
  all three cards still link to their existing category pages, hint button
  opens the contact sheet, keyboard focus ring visible on all three cards
  and the hint button, `≤800px` rail behaviour matches `main` pixel-for-pixel.

## Out of scope / follow-ups

- Implementing the approved mobile "wide tile + two tiles" composition
  (`docs/superpowers/specs/2026-09-12-directions-mobile-tiles-design.md`)
  — separate task; this change is written to not conflict with it landing
  afterward (shared `services__heading` class, shared tint variables, shared
  `.round-arrow-gold`/hint-plaque naming).
- Sitewide header/nav redesign shown in the reference for context.
- Selecting/uploading the real production photos for the three categories.
- A decorative leaf/plant graphic on the hint plaque.
- The secondary "ВАШИ ЦЕЛИ / НАША ПОДДЕРЖКА / …" micro-copy column shown in
  the reference's hint plaque — explicitly dropped per the brief.
