# Directions Desktop Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the desktop (`>800px`) rendering of the homepage "Направления" block (`src/components/home/Categories.astro`) into three light, photo-top/panel-bottom cards with a consultation hint plaque underneath, per `docs/superpowers/specs/2026-09-12-directions-desktop-cards-design.md`, without changing anything at `≤800px`.

**Architecture:** All CSS/markup changes live in one file, `Categories.astro`, gated behind a single new `@media (min-width: 801px)` block that replaces the existing `@media (max-width: 1100px)` block; the existing `@media (max-width: 800px)` block is never edited. This plan was revised on 2026-09-12 after discovering that the "wide tile + two tiles" mobile redesign (a separate, previously-unimplemented spec) was merged to `main` while this plan was being written — see the spec's "Amendment" section. That merge means: the photo is already wrapped in `<picture>`, the consultation-hint plaque markup/copy already exists (hardcoded, hidden on desktop), and the arrow already has a working "reskin the same element via `font-size:0` + `::before`" technique for mobile. This plan reuses all three rather than adding parallel new elements/fields, and **drops the "add 2 Directus fields" idea entirely** — desktop reuses the mobile implementation's exact hardcoded hint-plaque copy so the two breakpoints can't drift apart.

**Tech Stack:** Astro 7 (`.astro` components, scoped `<style>`), Node's built-in test runner (existing convention — see Task 1 note on why no new unit tests are added).

**Branch/worktree:** Already created — `.worktrees/directions-desktop-redesign` on branch `feature/directions-desktop-redesign`, forked from `main` at commit `303e699` (which already includes the merged mobile redesign). All tasks below run inside that worktree.

---

### Task 0 (done, no subagent needed): Branch/worktree setup and spec/plan correction

The worktree and branch were created by the controller before task execution began. While setting up, the controller discovered the mobile-redesign merge described above and corrected both `docs/superpowers/specs/2026-09-12-directions-desktop-cards-design.md` and this plan file to match the real, current `Categories.astro`. Commit that correction before starting Task 1:

```bash
cd .worktrees/directions-desktop-redesign
git add docs/superpowers/specs/2026-09-12-directions-desktop-cards-design.md docs/superpowers/plans/2026-09-12-directions-desktop-cards.md
git commit -m "docs: correct desktop Directions spec/plan for already-merged mobile redesign"
```

---

### Task 1: Desktop heading spacing/typography override

**Files:**
- Modify: `src/components/home/Categories.astro` (markup line ~33, scoped `<style>`)

No new unit test is added in this task or any other task in this plan: the only existing test file in the project (`src/lib/markup.test.ts`) covers pure string-escaping helpers, and there's no precedent for unit-testing Astro component markup/CSS in this codebase. Correctness is verified via `npm run check` plus the visual/QA checks below (this matches how the already-merged mobile redesign was itself verified — see its QA section).

- [ ] **Step 1: Confirm the markup already has the class (no edit needed)**

Read `src/components/home/Categories.astro` around line 33 and confirm it already reads:
```astro
<SectionHeading eyebrow={categories.eyebrow} title={categories.title} lead={categories.lead} class="services__heading" />
```
This was added by the merged mobile work — if for any reason it's missing, add it, but expect no change needed here.

- [ ] **Step 2: Add the desktop-only heading override**

Add this new rule set at the end of the existing `<style>` block, immediately before the existing `@media (max-width: 800px)` block (i.e. right after the `.service-card:hover .round-arrow { ... }` rule):

```css
  @media (min-width: 801px) {
    :global(#services .section-heading.services__heading) {
      margin-bottom: 32px;
    }
    :global(#services .services__heading h2) {
      font-size: clamp(44px, 3.6vw, 58px);
    }
    :global(#services .services__heading .section-heading__lead) {
      font-size: 19px;
      line-height: 1.6;
    }
  }
```

(This mirrors the `#services`-qualified selector pattern the mobile work already uses for its own `≤800px` heading override, a few lines below in the same file — see the code comment there explaining why the ID qualifier is needed.)

- [ ] **Step 3: Visually verify in the dev server**

```bash
npm run dev
```

Open `http://127.0.0.1:4321/` at a desktop width (e.g. resize browser to 1440px) and confirm: the eyebrow/title/lead layout is unchanged in structure, the gap between the heading block and the card row is visibly tighter than before, and the lead paragraph text is noticeably larger. Then resize to `<800px` and confirm the heading looks identical to `main` (unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: tighten desktop heading spacing for Directions block"
```

---

### Task 2: Desktop grid, card container, and photo

**Files:**
- Modify: `src/components/home/Categories.astro` scoped `<style>`

- [ ] **Step 1: Delete the old 1100px breakpoint block, replace with a new 801px block**

Current (`src/components/home/Categories.astro`, currently around lines 186-193):
```css
  @media (max-width: 1100px) {
    .service-card {
      height: 520px;
    }
    .service-grid--bento {
      grid-template-columns: repeat(3, 1fr);
    }
  }
```

Replace with:
```css
  @media (min-width: 801px) {
    .service-grid--bento {
      gap: 20px;
    }
    .service-card {
      height: auto;
      display: flex;
      flex-direction: column;
      background: none;
      color: var(--ink);
    }
    .service-card::after {
      display: none;
    }
    .service-card:hover {
      transform: none;
      box-shadow: none;
    }
    .service-card picture {
      flex: 0 0 auto;
      height: clamp(250px, 27vw, 300px);
    }
    .service-card :global(img) {
      filter: none;
    }
    .service-card:hover :global(img) {
      transform: none;
      filter: none;
    }
  }
```

Note: size the `<picture>` element (`.service-card picture`), not the `<img>` — the file already has an unconditional `.service-card picture { display: block; width: 100%; height: 100% }` rule (added by the merged mobile work for its own art-direction `<source>`), so sizing must happen on `picture`, not `img`, or the two rules will conflict.

This removes the old "equal 3 columns + fixed 520px height" tablet behaviour entirely — the bento's `1.15fr 1fr 1fr` ratio (unconditional rule, a few lines above) now applies fluidly from `801px` upward, and the card grows from its content instead of a fixed height.

- [ ] **Step 2: Verify in the dev server**

With `npm run dev` still running, reload at 1024px, 1280px, and 1440px widths. Confirm: three columns, first column visibly wider than the other two, photos no longer dark/scrimmed (they'll look "wrong" — no text panel yet, that's Task 3 — but the photo box itself should now be a fixed-ish height near the top of each card, not filling the whole card). Reload at 375px and 800px and confirm no visual change from `main`.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: switch desktop Directions cards to auto-height photo-top layout"
```

---

### Task 3: Desktop content panel, title/description, equal heights

**Files:**
- Modify: `src/components/home/Categories.astro` scoped `<style>` (extends the `@media (min-width: 801px)` block added in Task 2)

- [ ] **Step 1: Add the two colour custom properties unconditionally**

Current (`src/components/home/Categories.astro`, near the top of the `<style>` block):
```css
  .service-grid--bento {
    grid-template-columns: 1.15fr 1fr 1fr;
  }
```

Replace with:
```css
  .service-grid--bento {
    grid-template-columns: 1.15fr 1fr 1fr;
    --tile-injection-bg: #e4dccf;
    --tile-aesthetic-bg: #dee1d6;
  }
```

These two custom properties already exist elsewhere in the file, declared by the merged mobile work *inside* its own `@media (max-width: 800px)` block, so they aren't visible outside that query. Declaring them again here, unconditionally, on the same selector, makes them available to the new desktop rules below without touching the existing mobile declaration (harmless duplication — same values, different media contexts).

- [ ] **Step 2: Add the content-panel rules inside the `@media (min-width: 801px)` block**

Append these rules inside the `@media (min-width: 801px) { ... }` block added in Task 2 (after the `.service-card:hover :global(img) { ... }` rule, still inside the same media block):

```css
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
```

- [ ] **Step 3: Verify in the dev server**

Reload at 1024/1280/1440px. Confirm: each card has a solid-colour panel below the photo (cream / sandy-pink / sage, left to right), title reads large serif with "косметология" wrapping to its own line, description is plain grey text below the title (no pill/chip look), and the `01`/`02`/`03` number badges are gone. The circular arrow will still look wrong (dark, bottom-right of photo) — that's Task 4. Reload at 375/800px and confirm no visual change from `main`.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: desktop Directions card content panel with per-column tint"
```

---

### Task 4: Desktop gold arrow (reuse the existing `.round-arrow` element)

**Files:**
- Modify: `src/components/home/Categories.astro` scoped `<style>`

No markup change in this task — the existing `<span class="round-arrow glass-chip glass-chip--dark" aria-hidden="true">↗</span>` (already in the markup) is reused as-is.

- [ ] **Step 1: Add the desktop arrow override**

Append these rules inside the `@media (min-width: 801px) { ... }` block (after the rules added in Task 3):

```css
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
```

This mirrors the exact technique the merged mobile work already uses on the same element for `≤800px` (`font-size: 0` on `.round-arrow` collapses the sitewide `↗` glyph to nothing, `::before` draws the new glyph) — reusing it for desktop instead of adding a second arrow element. The `.service-card:hover .round-arrow` rule here overrides the existing unconditional hover rule (`background: #fff; color: var(--ink); transform: rotate(45deg); box-shadow: var(--shadow-glow)`), which would otherwise still apply at desktop widths.

- [ ] **Step 2: Verify in the dev server**

Reload at 1024/1280/1440/1920px. Confirm: gold circle with a white `→` sits bottom-right of each panel, aligned on the same horizontal line across all three cards (this comes from the grid's default `align-items: stretch` plus `margin-top: auto` — no extra rule needed for that alignment). Hover a card: arrow nudges right slightly, no rotation, no other card in the row shifts. Reload at 375/800px: confirm the mobile gold arrow (already shipped) is unchanged.

- [ ] **Step 3: Keyboard-focus check**

Tab to each of the three cards. Confirm a visible gold outline appears around the whole card (not just the arrow), per the sitewide `:focus-visible` rule (`src/styles/base.css:70-73`) — no new CSS should be needed for this, it's verifying nothing broke it.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: gold arrow button for desktop Directions cards"
```

---

### Task 5: Enable the consultation hint plaque on desktop

**Files:**
- Modify: `src/components/home/Categories.astro` scoped `<style>`

No markup or copy change in this task. The plaque (`<div class="services__hint glass-panel">...</div>`, with hardcoded copy "Не знаете, что выбрать?" / "Начните с консультации") already exists, added by the merged mobile work, and is currently hidden at all widths above 800px by the existing unconditional rule `.services__hint { display: none; }`.

- [ ] **Step 1: Add a new desktop-only display/sizing rule**

Add this as a new, separate rule block, appended at the very end of the `<style>` block (after the existing, untouched `@media (max-width: 800px)` and `@media (max-width: 379px)` blocks):

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

`.services__hint` already composes the global `glass-panel` class in its markup (cream glass background) — this rule only adds layout/sizing on top, it doesn't touch background.

- [ ] **Step 2: Verify in the dev server**

Reload at 1280px: confirm a cream banner sits below the three cards with "Не знаете, что выбрать?" and a gold "Начните с консультации →" button. Click the button: confirm the existing contact `<dialog>` (Позвонить / Telegram / WhatsApp / MAX) opens. Reload at 375px: confirm the banner still renders exactly as it did on `main` (unchanged mobile styling).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: enable consultation hint plaque on desktop Directions block"
```

---

### Task 6: Full QA pass

**Files:** none (verification only; may add screenshots under `docs/qa/`)

- [ ] **Step 1: Type-check**

Run: `npm run check`
Expected: `0 errors`.

- [ ] **Step 2: ⚠️ Confirm before this step — temporary content change on the shared dev CMS**

To get realistic screenshots (rather than whatever photo currently lives in each category's `cover` field), the three placeholder photos cropped from the reference (see spec §10 for crop rectangles, already cropped to `/tmp/placeholder-*.png` and mirrored at `https://dev.zumrudin.ru/peri-concepts/directions-desktop-2026-09-12/crops/` during brainstorming) can be uploaded as the three `service_categories` records' `cover` field on the dev Directus (`peri-directus`, pm2-managed on this same shared box). This is optional and purely for this review; **confirm with the user first**, and plan to revert it (or leave it — the user's call) once they've picked real photography. Skip this step entirely if the user would rather review with the current photos.

- [ ] **Step 3: Build and preview**

```bash
npm run build && npm run preview
```
(`npm run build` needs `DIRECTUS_URL`/`DIRECTUS_TOKEN` in `.env` — copy the root repo's `.env` into this worktree if it's not already present, since `.env` is gitignored and worktrees don't share untracked files.)

- [ ] **Step 4: Screenshot the desktop breakpoints**

```bash
node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/directions-desktop / 1024 1280 1440 1920
```
Expected: PNG files land under `docs/qa/directions-desktop/`. Open them and confirm against the spec's success criteria: three columns visible, no text/arrow clipping, photo/panel seams and card bottoms aligned across all three cards, links present.

- [ ] **Step 5: Confirm mobile is untouched**

```bash
node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/directions-desktop / 375 800
```
Compare these against equivalent screenshots taken from `main` before this branch's changes — the Directions block region should be pixel-equivalent.

- [ ] **Step 6: Accessibility check**

```bash
node scripts/qa/a11y.mjs http://127.0.0.1:4322 /
```
Expected: exit code 0, no serious/critical violations. Pay particular attention to any contrast violation on the three panel tints or the gold arrow button — if one appears, darken `var(--muted)` usage or adjust the offending tint slightly and re-run, rather than suppressing the check.

- [ ] **Step 7: Manual link check**

```bash
node scripts/qa/check-links.mjs
```
Expected: no broken internal links.

- [ ] **Step 8: Commit the QA screenshots**

```bash
git add docs/qa/directions-desktop/
git commit -m "docs: add QA screenshots for desktop Directions card redesign"
```

---

## Self-review notes

- **Spec coverage:** every numbered section of the (corrected)
  `2026-09-12-directions-desktop-cards-design.md` (§1 scope, §2 heading, §3
  grid, §4 card container, §5 photo, §6 panel, §7 arrow, §8 equal heights,
  §9 hint plaque, §10 placeholder photos, §11 QA) maps to Task 1–6 above.
  §1's "no line inside the existing `≤800px` block is touched" constraint
  is upheld throughout — every new rule lives in a new `@media (min-width:
  801px)` block or a standalone new block.
- **Placeholder scan:** no TBD/TODO; every step shows full code, not a
  description of code.
- **Type consistency:** N/A for this revision — no new TypeScript/zod types
  are introduced (the CMS-field task was dropped). Selector names
  (`.services__hint`, `.round-arrow`, `--tile-injection-bg`,
  `--tile-aesthetic-bg`) are used identically across Tasks 3–5, matching
  the names already present in the merged mobile code.
