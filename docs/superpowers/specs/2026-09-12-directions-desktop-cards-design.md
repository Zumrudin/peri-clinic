# Homepage "Направления" block: desktop three-column card redesign

## Background

The homepage Categories block (`src/components/home/Categories.astro`) shows
the site's 3 top-level `service_categories` (Аппаратная / Инъекционная /
Эстетическая косметология). At desktop widths (`>800px`) it's a "bento" grid
(`1.15fr 1fr 1fr`) of full-bleed portrait photo cards, fixed `height: 610px`
(520px at `≤1100px`), dark gradient scrim, white overlaid text, a numbered
chip (`01`/`02`/`03`) and a dark glass-chip round arrow (`↗`).

A prepared visual reference
(`https://dev.zumrudin.ru/peri-concepts/directions-desktop-2026-09-12/03-three-columns.png`,
1536×1024) shows a different desktop composition: three light cards in one
row (40/30/30 width split), each with a top photo (~55–60% of card height)
and a solid-colour text panel below (title, short description, gold circular
arrow), plus a consultation hint plaque underneath the row.

Decisions made during brainstorming:

- **Desktop only.** The mobile (`≤800px`) composition is left completely
  untouched.
- Card tint mapping is **positional** (1st/2nd/3rd card), not by category
  slug — same trade-off the mobile implementation already made, since these
  three categories are fixed, editorially-stable content, not a reorderable
  list.
- Photos: no code/asset changes. `item.cover` (the existing Directus-driven
  `<Image>`) keeps rendering exactly as it does today — the redesign is
  purely a CSS/markup change around it. For review, three photos are cropped
  directly from the reference PNG and can be uploaded as the three
  categories' `cover` field on the **dev** Directus (`peri-cms.zumrudin.ru`)
  as a temporary, reviewer-only content change — not part of the code
  change, and not something to carry into production. Real clinic photos are
  selected and set by the client before merge.

### Amendment (2026-09-12, post-brainstorm): the mobile redesign landed on `main` first

This spec was originally written believing the "wide tile + two tiles"
mobile composition
(`docs/superpowers/specs/2026-09-12-directions-mobile-tiles-design.md`) was
still unbuilt, and was designed to not conflict with it landing later. While
this desktop spec/plan were being written, that mobile work was actually
implemented and merged (`303e699 Merge branch
'feature/directions-mobile-tiles'`) — so `Categories.astro` on `main` today
already contains real mobile-only CSS/markup, not just the pre-existing
dark-overlay bento. This changes several concrete details below (each
section says so explicitly):

- The photo is now wrapped in `<picture>` (for mobile art-direction crops),
  not a bare `<Image>`. Desktop sizing rules must target `.service-card
  picture`, not `.service-card :global(img)` directly, or they'll fight the
  unconditional `.service-card picture { display: block; width: 100%;
  height: 100% }` rule the mobile work added.
- Card 1 already has a `.service-card--wide` class (added by the mobile
  work, currently mobile-only styled). Desktop styling can use `nth-child`
  as originally planned; `.service-card--wide` is not required but is
  available.
- The arrow does **not** get a new `.round-arrow-gold` element. The mobile
  work already re-themes the existing `<span class="round-arrow
  glass-chip glass-chip--dark">↗</span>` into a solid gold `→` via a
  `font-size: 0` + `::before { content: '→' }` trick (see
  `Categories.astro`'s `≤800px` block). §7 below reuses that exact
  technique for desktop on the same element, rather than adding a second
  arrow element.
- The consultation hint plaque markup **already exists** (added by the
  mobile work), hidden on desktop (`display: none` by default, shown only
  `≤800px`) with **hardcoded** Russian copy (not Directus-driven) — the
  mobile work didn't add the CMS fields this desktop spec originally
  proposed adding. Since both breakpoints render the *same* `.services__hint`
  DOM node, making desktop pull from Directus while mobile stays hardcoded
  would let an editor change the CMS copy and have mobile silently keep
  showing the old text. **Decision: desktop reuses the exact same hardcoded
  copy already in the markup.** No Directus schema change in this task —
  §9 is rewritten accordingly, and the "two new Directus fields" idea from
  the original brainstorm is dropped.
- The heading override already has a real-world selector precedent to
  follow: the mobile work uses `:global(#services .section-heading
  .services__heading)` (ID-qualified) rather than a bare
  `:global(.services__heading)`, specifically to reliably out-specificity
  `SectionHeading`'s own scoped rules regardless of CSS bundle order (see
  the code comment at `Categories.astro`'s mobile block). §2 below follows
  the same pattern for its desktop override, for the same reason.

## Design

### 1. Scope of changes

- `src/components/home/Categories.astro` — markup: pass `class` to
  `SectionHeading` (only). No new elements are added — the hint plaque and
  the arrow both reuse markup that already exists from the merged mobile
  work. Scoped `<style>`: new rules, all gated behind
  `@media (min-width: 801px)`. **No line inside the existing
  `@media (max-width: 800px)` block is touched.**
- No changes to `directus/setup/collections.mjs`, `src/content.config.ts`,
  `src/lib/homeContent.ts`, `service_categories`, or any other homepage
  section.

### 2. Heading (desktop only)

`SectionHeading`'s existing `layout="grid"` default (title left, lead
right-column bottom-aligned, `src/components/ui/SectionHeading.astro:28-33`)
already matches the reference layout — no markup/structure change needed.
`class="services__heading"` is already passed to `SectionHeading` (added by
the mobile work). Add a desktop override using the same ID-qualified
selector pattern the mobile work already established (see Amendment above):

```css
@media (min-width: 801px) {
  :global(#services .section-heading.services__heading) {
    margin-bottom: 32px; /* was 66px */
  }
  :global(#services .services__heading h2) {
    font-size: clamp(44px, 3.6vw, 58px); /* was clamp(40px, 4.6vw, 72px) */
  }
  :global(#services .services__heading .section-heading__lead) {
    font-size: 19px; /* was 14px */
    line-height: 1.6;
  }
}
```

The eyebrow (`.eyebrow` — gold, uppercase, `0.18em` tracking, ~13px) already
matches the brief and needs no change. This override only fires `≥801px`
and only targets elements inside `#services` carrying `services__heading`,
so every other page's `SectionHeading` and this same page's `≤800px`
rendering are unaffected.

### 3. Grid (desktop only)

Delete the existing `@media (max-width: 1100px)` block (it currently forces
equal 3 columns + fixed `520px` height — exactly what this redesign
removes). `.service-grid--bento { grid-template-columns: 1.15fr 1fr 1fr }`
(unconditional, unchanged) then applies from `801px` up to any width
(≈40/30/30, matching the brief), with a slightly wider gap on desktop:

```css
@media (min-width: 801px) {
  .service-grid--bento {
    gap: 20px;
  }
}
```

Three columns are preserved all the way down to the existing `800px`
boundary — below that, the (untouched) mobile composition takes over,
satisfying "adapt sizes first, never drop below 3 columns before switching
to the mobile composition."

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

The photo now lives inside `<picture>` (added by the merged mobile work for
its art-direction `<source>`); size the `<picture>` element itself, not the
`<img>`, so this doesn't fight the existing unconditional
`.service-card picture { display: block; width: 100%; height: 100% }` rule:

```css
@media (min-width: 801px) {
  .service-card picture {
    flex: 0 0 auto;
    height: clamp(250px, 27vw, 300px); /* ~55–60% of a 440–520px card */
  }
  .service-card :global(img) {
    filter: none; /* drop the mobile/legacy saturate(0.8) */
  }
  .service-card:hover :global(img) {
    transform: none;
    filter: none;
  }
}
```

`width: 100%; object-fit: cover` on the `img` (existing, unconditional) is
unaffected, so each column's differently-cropped photo (col 1 wider than
col 2/3) is handled automatically. No `<Image>`/`sizes` prop changes — the
current `sizes="(max-width: 800px) 84vw, 33vw"` is a close enough
approximation of the real ~30–40% column widths for this task's scope. The
mobile `<source media="(max-width: 800px)">` inside the same `<picture>` is
unaffected since it simply doesn't match at `≥801px`.

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
  .service-card__number {
    display: none;
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

- `--tile-injection-bg: #e4dccf` / `--tile-aesthetic-bg: #dee1d6` already
  exist in the file (declared by the mobile work inside its own
  `≤800px` block, on `.service-grid--bento`). Custom properties declared
  inside one media query aren't visible outside it, so this task
  **redeclares the same two values** on `.service-grid--bento` again,
  this time unconditionally (or inside the new `≥801px` block — either
  works; declaring them unconditionally on `.service-grid--bento` once,
  outside any media query, is simplest and removes the duplication). Column
  1 reuses the existing `--sand` token, also matching the mobile
  implementation's top-tile colour.
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

### 7. Arrow button (desktop only — reuses the existing `.round-arrow` element)

No new markup. The mobile work already solves "same sitewide `↗` element,
different glyph/colour at a breakpoint" by zeroing the text out
(`font-size: 0`) and drawing the new glyph via `::before`; reuse that exact
technique for desktop instead of adding a second arrow element:

```css
@media (min-width: 801px) {
  .round-arrow {
    position: static;
    order: 3;
    margin-top: auto;
    align-self: flex-end;
    width: 52px;
    height: 52px;
    background: var(--gold);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    color: #fff;
    font-size: 0;
  }
  .round-arrow::before {
    content: '→';
    font-size: 20px;
  }
  .service-card:hover .round-arrow {
    background: var(--gold-hover);
    color: #fff;
    transform: translateX(3px);
    box-shadow: none;
  }
}
```

The last rule overrides the existing unconditional
`.service-card:hover .round-arrow { background: #fff; color: var(--ink);
transform: rotate(45deg); box-shadow: var(--shadow-glow) }` — without this
override, desktop hover would still show the old white-circle-rotate
behaviour instead of the gold nudge-right.

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
the tallest one. The photo (`<picture>`) has a fixed `clamp()` height (§5)
and the content panel is `flex: 1` (§6), so any extra height (e.g. a
description wrapping to a 3rd line) is absorbed by the panel growing —
keeping the photo/panel seam and the card bottoms aligned across all three
cards, per the brief.

### 9. Consultation hint plaque (enable existing markup on desktop)

The plaque markup and copy already exist in `Categories.astro` (added by
the merged mobile work) and are hidden on desktop by the existing
unconditional rule `.services__hint { display: none; }`:

```html
<div class="services__hint glass-panel">
  <p class="services__hint-title">Не знаете, что выбрать?</p>
  <button type="button" class="services__hint-cta" data-open-sheet data-context="Консультация">
    Начните с консультации <span aria-hidden="true">→</span>
  </button>
</div>
```

No markup change and **no new Directus fields** (see Amendment above —
desktop reuses the exact same hardcoded copy already shipped for mobile, so
the two breakpoints can never drift apart). `[data-open-sheet]
[data-context="Консультация"]` already reuses the sitewide contact-sheet
convention, unchanged.

Add desktop-only display + sizing, inside a new `@media (min-width: 801px)`
rule (leaving the existing `≤800px` styling of the same class untouched):

```css
@media (min-width: 801px) {
  .services__hint {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-top: 22px;
    min-height: 130px;
    padding: 32px 40px;
    border-radius: var(--radius-lg);
  }
  .services__hint-title {
    font-size: 20px;
    color: var(--ink);
  }
  .services__hint-cta {
    font-size: 16px;
  }
}
```

`.services__hint` already composes `glass-panel` in the markup (cream glass
background) — this override only changes layout/sizing, not background. No
decorative leaf illustration in this pass (see "Out of scope") — a
background image can be layered in later without a markup change.

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
  and the hint button, `≤800px` rendering matches `main` pixel-for-pixel.

## Out of scope / follow-ups

- Sitewide header/nav redesign shown in the reference for context.
- Selecting/uploading the real production photos for the three categories.
- A decorative leaf/plant graphic on the hint plaque.
- The secondary "ВАШИ ЦЕЛИ / НАША ПОДДЕРЖКА / …" micro-copy column shown in
  the reference's hint plaque — explicitly dropped per the brief.
- Moving the hint plaque's copy into Directus (would require also migrating
  the mobile implementation's hardcoded copy at the same time, to avoid the
  two breakpoints drifting — a follow-up affecting both, not this task).
