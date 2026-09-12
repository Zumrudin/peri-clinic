# Directions Desktop Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the desktop (`>800px`) rendering of the homepage "Направления" block (`src/components/home/Categories.astro`) into three light, photo-top/panel-bottom cards with a consultation hint plaque underneath, per `docs/superpowers/specs/2026-09-12-directions-desktop-cards-design.md`, without changing anything at `≤800px`.

**Architecture:** All CSS/markup changes live in one file, `Categories.astro`, gated behind a single new `@media (min-width: 801px)` block that replaces the existing `@media (max-width: 1100px)` block; the existing `@media (max-width: 800px)` block is never edited. Two new Directus fields on the `home` singleton (applied via the existing idempotent `schema.mjs` script) feed a new consultation-hint banner through the existing Directus → `content.config.ts` → `homeContent.ts` → template pipeline — no new content pipeline mechanism.

**Tech Stack:** Astro 7 (`.astro` components, scoped `<style>`), Directus REST (schema-as-code in `directus/setup/collections.mjs`), zod (`src/content.config.ts`), Node's built-in test runner (existing convention — see Task 3 note on why no new unit tests are added).

**Branch:** All work happens on `feature/directions-desktop-redesign`, created from `main` in Task 1.

---

### Task 1: Create the feature branch

**Files:** none (git operation only)

- [ ] **Step 1: Confirm a clean working tree on `main`**

Run: `git status --short`
Expected: no output for tracked files relevant to this work (the repo may have unrelated pre-existing untracked/modified files from other work — do not touch those).

- [ ] **Step 2: Create and switch to the feature branch**

```bash
git checkout -b feature/directions-desktop-redesign
```

Expected: `Switched to a new branch 'feature/directions-desktop-redesign'`. All subsequent commits in this plan happen on this branch.

---

### Task 2: Add the two consultation-hint fields to the Directus schema

**Files:**
- Modify: `directus/setup/collections.mjs:181-184`

- [ ] **Step 1: Add the two new field definitions**

Current (`directus/setup/collections.mjs:181-184`):
```js
      f.divider('d_categories', 'Блок «Направления»'),
      f.str('categories_eyebrow', 'Надзаголовок'),
      f.text('categories_title', 'Заголовок'),
      f.text('categories_lead', 'Текст'),
```

Replace with:
```js
      f.divider('d_categories', 'Блок «Направления»'),
      f.str('categories_eyebrow', 'Надзаголовок'),
      f.text('categories_title', 'Заголовок'),
      f.text('categories_lead', 'Текст'),
      f.str('categories_hint_title', 'Плашка консультации: текст', { default: 'Не знаете, что выбрать?' }),
      f.str('categories_hint_cta_label', 'Плашка консультации: текст ссылки', { default: 'Начните с консультации' }),
```

- [ ] **Step 2: ⚠️ Confirm before applying — this touches the live shared dev Directus**

This box (`peri-directus` under pm2, `127.0.0.1:8055`) is a shared VPS running other tenants' services alongside the CMS. Applying the schema is additive/idempotent (matches the pattern already used for every other field on this collection, e.g. `07-devices.mjs`'s migration), but it is a real write to a live, shared system. **Stop and get explicit user confirmation before running the command in Step 3**, even though this is the recommended path in the spec.

- [ ] **Step 3: Apply the schema**

Run (using the same admin credentials pattern documented in `directus/roles.md:58-59`; check `.env` or ask the user for `DIRECTUS_ADMIN_TOKEN` or `DIRECTUS_ADMIN_EMAIL`/`DIRECTUS_ADMIN_PASSWORD` if not already exported):

```bash
DIRECTUS_URL=http://127.0.0.1:8055 node directus/setup/schema.mjs
```

Expected output includes a line like:
```
add field home.categories_hint_title
add field home.categories_hint_cta_label
```

- [ ] **Step 4: Verify the fields exist and the singleton row got the defaults**

```bash
curl -s "http://127.0.0.1:8055/items/home?fields=categories_hint_title,categories_hint_cta_label" \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" | python3 -m json.tool
```

Expected: a JSON object with both keys populated with the default Russian strings (Postgres backfills existing rows when a column is added with a `DEFAULT`, so this should already show real values, not `null`).

- [ ] **Step 5: Commit**

```bash
git add directus/setup/collections.mjs
git commit -m "feat: add consultation-hint fields to home CMS schema"
```

---

### Task 3: Wire the new fields through `content.config.ts` and `homeContent.ts`

**Files:**
- Modify: `src/content.config.ts:53-55` and `:98-100`
- Modify: `src/lib/homeContent.ts:39-50`

No new unit test is added in this task: the only existing test file in the project (`src/lib/markup.test.ts`) covers pure string-escaping helpers, and there is no precedent or harness for unit-testing `homeContent.ts` (it calls Astro's `getEntry`/`getCollection`, which need the Content Layer runtime). Correctness here is verified by `npm run check` (the zod schema will fail loudly at build time if a field is missing) and by the visual/QA checks in Task 6.

- [ ] **Step 1: Add the two keys to `homeFields` (the REST `fields=` query list)**

Current (`src/content.config.ts:53-55`):
```ts
  'categories_eyebrow',
  'categories_title',
  'categories_lead',
```

Replace with:
```ts
  'categories_eyebrow',
  'categories_title',
  'categories_lead',
  'categories_hint_title',
  'categories_hint_cta_label',
```

- [ ] **Step 2: Add the two keys to the `home` zod schema**

Current (`src/content.config.ts:98-100`):
```ts
    categories_eyebrow: z.string(),
    categories_title: z.string(),
    categories_lead: z.string().nullable().optional(),
```

Replace with:
```ts
    categories_eyebrow: z.string(),
    categories_title: z.string(),
    categories_lead: z.string().nullable().optional(),
    categories_hint_title: z.string().nullable().optional(),
    categories_hint_cta_label: z.string().nullable().optional(),
```

- [ ] **Step 3: Surface `categories.hint` in `getHomeContent()`**

Current (`src/lib/homeContent.ts:39-50`):
```ts
    categories: {
      eyebrow: h.categories_eyebrow,
      title: h.categories_title,
      lead: h.categories_lead || '',
      items: categories.map(({ data: c }) => ({
        slug: c.slug,
        title: c.title,
        tagline: c.tagline || '',
        cover: directusImage(c.cover),
        alt: c.cover_alt || c.title,
      })),
    },
```

Replace with:
```ts
    categories: {
      eyebrow: h.categories_eyebrow,
      title: h.categories_title,
      lead: h.categories_lead || '',
      hint: {
        title: h.categories_hint_title || 'Не знаете, что выбрать?',
        ctaLabel: h.categories_hint_cta_label || 'Начните с консультации',
      },
      items: categories.map(({ data: c }) => ({
        slug: c.slug,
        title: c.title,
        tagline: c.tagline || '',
        cover: directusImage(c.cover),
        alt: c.cover_alt || c.title,
      })),
    },
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: `0 errors`. (If Directus wasn't reachable when Astro last synced content types, re-run `npm run dev` briefly first so the generated types in `.astro/` pick up the two new schema fields.)

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts src/lib/homeContent.ts
git commit -m "feat: surface consultation-hint CMS fields in home content pipeline"
```

---

### Task 4: Desktop heading spacing/typography override

**Files:**
- Modify: `src/components/home/Categories.astro:13` (markup)
- Modify: `src/components/home/Categories.astro` scoped `<style>` (new block)

- [ ] **Step 1: Pass a class to `SectionHeading`**

Current (`src/components/home/Categories.astro:13`):
```astro
  <SectionHeading eyebrow={categories.eyebrow} title={categories.title} lead={categories.lead} />
```

Replace with:
```astro
  <SectionHeading eyebrow={categories.eyebrow} title={categories.title} lead={categories.lead} class="services__heading" />
```

- [ ] **Step 2: Add the desktop-only heading override**

Add this new rule set at the end of the existing `<style>` block, immediately before the existing `@media (max-width: 800px)` block (i.e. right after the `.service-card:hover .round-arrow { ... }` rule, `Categories.astro:132-137`):

```css
  @media (min-width: 801px) {
    :global(.services__heading) {
      margin-bottom: 32px;
    }
    :global(.services__heading h2) {
      font-size: clamp(44px, 3.6vw, 58px);
    }
    :global(.services__heading .section-heading__lead) {
      font-size: 19px;
      line-height: 1.6;
    }
  }
```

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

### Task 5: Desktop grid, card container, and photo

**Files:**
- Modify: `src/components/home/Categories.astro` scoped `<style>`

- [ ] **Step 1: Delete the old 1100px breakpoint block, replace with a new 801px block**

Current (`src/components/home/Categories.astro:139-146`):
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
    .service-card :global(img) {
      flex: 0 0 auto;
      height: clamp(250px, 27vw, 300px);
      filter: none;
    }
    .service-card:hover :global(img) {
      transform: none;
      filter: none;
    }
  }
```

This removes the old "equal 3 columns + fixed 520px height" tablet behaviour entirely — the bento's `1.15fr 1fr 1fr` ratio (unconditional rule at `Categories.astro:49-51`) now applies fluidly from `801px` upward, and the card grows from its content instead of a fixed height.

- [ ] **Step 2: Verify in the dev server**

With `npm run dev` still running, reload at 1024px, 1280px, and 1440px widths. Confirm: three columns, first column visibly wider than the other two, photos no longer dark/scrimmed (they'll look "wrong" — no text panel yet, that's Task 6 — but the photo box itself should now be a fixed-ish height near the top of each card, not filling the whole card).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: switch desktop Directions cards to auto-height photo-top layout"
```

---

### Task 6: Desktop content panel, title/description, equal heights

**Files:**
- Modify: `src/components/home/Categories.astro` scoped `<style>` (extends the `@media (min-width: 801px)` block added in Task 5)

- [ ] **Step 1: Add the two new local colour custom properties**

Current (`src/components/home/Categories.astro:49-51`):
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

- [ ] **Step 2: Add the content-panel rules inside the `@media (min-width: 801px)` block**

Append these rules inside the `@media (min-width: 801px) { ... }` block added in Task 5 (after the `.service-card:hover :global(img) { ... }` rule, still inside the same media block):

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

Reload at 1024/1280/1440px. Confirm: each card has a solid-colour panel below the photo (cream / sandy-pink / sage, left to right), title reads large serif with "косметология" wrapping to its own line, description is plain grey text below the title (no pill/chip look), and the `01`/`02`/`03` number badges are gone. The circular arrow will still look wrong (dark, bottom-right of photo) — that's Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: desktop Directions card content panel with per-column tint"
```

---

### Task 7: Desktop gold arrow button

**Files:**
- Modify: `src/components/home/Categories.astro` markup (`:32-34`)
- Modify: `src/components/home/Categories.astro` scoped `<style>`

- [ ] **Step 1: Add the new arrow span next to the existing one**

Current (`src/components/home/Categories.astro:29-35`):
```astro
          <div class="service-card__content">
            <p class="glass-chip glass-chip--dark">{item.tagline}</p>
            <h3 set:html={em(item.title)} />
            <span class="round-arrow glass-chip glass-chip--dark" aria-hidden="true">
              ↗
            </span>
          </div>
```

Replace with:
```astro
          <div class="service-card__content">
            <p class="glass-chip glass-chip--dark">{item.tagline}</p>
            <h3 set:html={em(item.title)} />
            <span class="round-arrow glass-chip glass-chip--dark" aria-hidden="true">
              ↗
            </span>
            <span class="round-arrow-gold" aria-hidden="true">→</span>
          </div>
```

- [ ] **Step 2: Add the base (inert) rule and the desktop rule**

Add the base rule right after the existing `.round-arrow` / `.service-card:hover .round-arrow` rules (`Categories.astro:117-137`, just before the `@media (min-width: 801px)` block):

```css
  .round-arrow-gold {
    display: none;
  }
```

Then, inside the existing `@media (min-width: 801px) { ... }` block (added in Task 5, extended in Task 6), append:

```css
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
```

- [ ] **Step 3: Verify in the dev server**

Reload at 1024/1280/1440/1920px. Confirm: gold circle with a white `→` sits bottom-right of each panel, aligned on the same horizontal line across all three cards (this comes from the grid's default `align-items: stretch` plus `margin-top: auto` — no extra rule needed for that alignment). Hover a card: arrow nudges right slightly, no other card in the row shifts. Reload at 375/800px: confirm the old dark `↗` chip is still there, unchanged.

- [ ] **Step 4: Keyboard-focus check**

Tab to each of the three cards. Confirm a visible gold outline appears around the whole card (not just the arrow), per the sitewide `:focus-visible` rule (`src/styles/base.css:70-73`) — no new CSS should be needed for this, it's verifying nothing broke it.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: gold arrow button for desktop Directions cards"
```

---

### Task 8: Consultation hint plaque

**Files:**
- Modify: `src/components/home/Categories.astro` markup (after the grid, `:39` area)
- Modify: `src/components/home/Categories.astro` scoped `<style>`

- [ ] **Step 1: Add the plaque markup**

Current (`src/components/home/Categories.astro:15-40`, showing just the closing structure):
```astro
  <div class:list={['service-grid', 'rail', { 'service-grid--bento': isBento }]}>
    {
      categories.items.map((item, i) => (
        ...
      ))
    }
  </div>
</section>
```

Replace the closing `</div>\n</section>` with:
```astro
  <div class:list={['service-grid', 'rail', { 'service-grid--bento': isBento }]}>
    {
      categories.items.map((item, i) => (
        ...
      ))
    }
  </div>

  <div class="services__hint glass-panel">
    <p class="services__hint-title">{categories.hint.title}</p>
    <button type="button" class="services__hint-cta" data-open-sheet data-context="Консультация">
      {categories.hint.ctaLabel} <span aria-hidden="true">→</span>
    </button>
  </div>
</section>
```
(the `...` above is the existing, unchanged card-mapping JSX — do not retype it, just insert the new `<div class="services__hint">` block between the existing grid `</div>` and the closing `</section>`.)

- [ ] **Step 2: Add the plaque styles**

Append at the very end of the existing `<style>` block (after the existing, untouched `@media (max-width: 800px) { ... }` block):

```css
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
    margin: 0;
    font-size: 20px;
    color: var(--ink);
  }
  .services__hint-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-weight: 600;
    color: var(--gold-deep);
    cursor: pointer;
  }
  .services__hint-cta span {
    color: var(--gold);
  }
  @media (max-width: 800px) {
    .services__hint {
      display: none;
    }
  }
```

The final `@media (max-width: 800px)` rule here is a **new, separate** block (not an edit to the existing mobile block higher up in the file) — it exists purely so this new element doesn't appear at all on mobile until the separate mobile-composition task designs a treatment for it.

- [ ] **Step 3: Verify in the dev server**

Reload at 1280px: confirm a cream banner sits below the three cards with "Не знаете, что выбрать?" and a gold "Начните с консультации →" button. Click the button: confirm the existing contact `<dialog>` (Позвонить / Telegram / WhatsApp / MAX) opens. Reload at 375px: confirm the banner is not present at all (mobile unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: add consultation hint plaque below desktop Directions cards"
```

---

### Task 9: Full QA pass

**Files:** none (verification only; may add screenshots under `docs/qa/`)

- [ ] **Step 1: Type-check**

Run: `npm run check`
Expected: `0 errors`.

- [ ] **Step 2: ⚠️ Confirm before this step — temporary content change on the shared dev CMS**

To get realistic screenshots (rather than whatever photo currently lives in each category's `cover` field), the three placeholder photos cropped from the reference can be uploaded as the three `service_categories` records' `cover` field on the dev Directus (`peri-directus`, same shared box as Task 2). This is optional and purely for this review; **confirm with the user first**, and plan to revert it (or leave it — the user's call) once they've picked real photography. Skip this step entirely if the user would rather review with the current photos.

- [ ] **Step 3: Build and preview**

```bash
npm run build && npm run preview
```
(`npm run build` needs `DIRECTUS_URL`/`DIRECTUS_TOKEN` in `.env`, already present per the repo's existing `.env`.)

- [ ] **Step 4: Screenshot the desktop breakpoints**

```bash
node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/directions-desktop / 1024 1280 1440 1920
```
Expected: PNG files land under `docs/qa/directions-desktop/`. Open them and confirm against the four success criteria from the spec: three columns visible, no text/arrow clipping, photo/panel seams and card bottoms aligned across all three cards, links present.

- [ ] **Step 5: Confirm mobile is untouched**

```bash
node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/directions-desktop / 375 800
```
Compare these against the equivalent screenshots on `main` (e.g. `docs/qa/hero-redesign/` or any recent set that includes the homepage at 375/800) — the Directions block region should be pixel-equivalent.

- [ ] **Step 6: Accessibility check**

```bash
node scripts/qa/a11y.mjs http://127.0.0.1:4322 /
```
Expected: exit code 0, no serious/critical violations. Pay particular attention to any contrast violation on the three panel tints or the gold arrow button — if one appears, darken `var(--muted)` usage or adjust the offending tint slightly and re-run, rather than suppressing the check.

- [ ] **Step 7: Manual link check**

```bash
node scripts/qa/check-links.mjs
```
Expected: no broken internal links (the three category links and the contact-sheet trigger aren't real `<a href>` targets for the sheet, so this mainly guards the category slugs).

- [ ] **Step 8: Commit the QA screenshots**

```bash
git add docs/qa/directions-desktop/
git commit -m "docs: add QA screenshots for desktop Directions card redesign"
```

---

## Self-review notes

- **Spec coverage:** every numbered section of `2026-09-12-directions-desktop-cards-design.md` (§1 scope, §2 heading, §3 grid, §4 card container, §5 photo, §6 panel, §7 arrow, §8 equal heights, §9 hint plaque + CMS fields, §10 placeholder photos, §11 QA) maps to Task 2–9 above. §1's "no line inside the existing `≤800px` block is touched" constraint is upheld throughout — the only mobile-facing addition is the new, separate `@media (max-width: 800px) { .services__hint { display: none; } }` rule in Task 8, which hides a brand-new element rather than editing existing mobile behaviour.
- **Placeholder scan:** no TBD/TODO; every step shows full code, not a description of code.
- **Type consistency:** `categories.hint.title` / `categories.hint.ctaLabel` (Task 3) match the property names used in the Task 8 markup (`categories.hint.title`, `categories.hint.ctaLabel`) exactly. `--tile-injection-bg` / `--tile-aesthetic-bg` (Task 6) are declared and consumed within the same task, matching the mobile spec's naming so a future mobile-composition task can reuse them without renaming.
