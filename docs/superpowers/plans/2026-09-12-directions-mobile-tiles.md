# Directions block mobile tile redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile (≤800px) horizontal photo-rail in the homepage "Направления" block with a "wide tile + two equal tiles" light-card composition matching `https://dev.zumrudin.ru/peri-concepts/directions-2026-09-12-v2/03-tiles.png`, leaving the desktop bento grid untouched.

**Architecture:** All changes live in one file, `src/components/home/Categories.astro` — its frontmatter gains a slug-keyed map from category to a locally-cropped mobile photo, its markup wraps each card's photo in a `<picture>` for breakpoint-based art-direction, and its scoped `<style>` gains a new `@media (max-width: 800px)` ruleset (replacing the old rail rules) plus a `@media (max-width: 379px)` single-column fallback. Three new static JPEGs (cropped from the approved reference mockup) are added under `src/assets/home/tiles/`.

**Tech Stack:** Astro 7 (`astro:assets` `Image`/`getImage`), plain scoped CSS (flexbox + CSS Grid), no new dependencies.

**Verification approach (adapted from TDD):** This is presentational Astro/CSS work with no existing unit-test coverage for templates (`npm test` only covers `src/lib/**/*.test.ts`). Each task's "test" step is `npm run check` (TS/Astro diagnostics) plus a visual check against the running dev server (`npm run dev`, http://127.0.0.1:4321) instead of an automated assertion. Task 9 runs the project's real QA scripts (screenshots + a11y) as the final verification gate.

---

## Task 1: Crop the three mobile tile photos from the reference mockup

**Files:**
- Create: `src/assets/home/tiles/apparatnaya.jpg`
- Create: `src/assets/home/tiles/injekcionnaya.jpg`
- Create: `src/assets/home/tiles/esteticheskaya.jpg`

- [ ] **Step 1: Download the reference mockup**

```bash
mkdir -p /tmp/directions-ref src/assets/home/tiles
curl -s -o /tmp/directions-ref/03-tiles.png https://dev.zumrudin.ru/peri-concepts/directions-2026-09-12-v2/03-tiles.png
python3 -c "from PIL import Image; print(Image.open('/tmp/directions-ref/03-tiles.png').size)"
```

Expected output: `(1024, 1536)`

- [ ] **Step 2: Crop the three photo regions and save as JPEGs**

```bash
python3 <<'EOF'
from PIL import Image
im = Image.open('/tmp/directions-ref/03-tiles.png').convert('RGB')
crops = {
    'src/assets/home/tiles/apparatnaya.jpg': (520, 337, 992, 712),
    'src/assets/home/tiles/injekcionnaya.jpg': (33, 727, 505, 1000),
    'src/assets/home/tiles/esteticheskaya.jpg': (520, 727, 992, 1000),
}
for path, box in crops.items():
    im.crop(box).save(path, quality=90)
    print(path, im.crop(box).size)
EOF
```

Expected output:
```
src/assets/home/tiles/apparatnaya.jpg (472, 375)
src/assets/home/tiles/injekcionnaya.jpg (472, 273)
src/assets/home/tiles/esteticheskaya.jpg (472, 273)
```

- [ ] **Step 3: Visually verify each crop**

Open each of the three new files (e.g. with the Read tool, or any image viewer). Confirm for each:
- The face and the working hand/device are both clearly visible (not cropped off).
- No burned-in text, logo, or ad caption is visible.
- Any rounded-corner artefact from the mockup's card edges is only in the outer few pixels (acceptable — Task 5/6's `object-fit: cover` will crop most of it away once the images render inside their real, differently-proportioned card boxes).

If a crop fails this check, adjust the box coordinates in Step 2 and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/assets/home/tiles/
git commit -m "feat: add mobile tile photo crops for Directions block redesign"
```

---

## Task 2: Wrap each card's photo in `<picture>` with mobile art-direction

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Import the new local images and build the slug→image map**

In the frontmatter (top of the file), change:

```astro
---
import { Image } from 'astro:assets';
import SectionHeading from '../ui/SectionHeading.astro';
import { em } from '../../lib/markup';
import { getHomeContent } from '../../lib/homeContent';

const home = await getHomeContent();
const { categories } = home;
const isBento = categories.items.length === 3;
---
```

to:

```astro
---
import { Image, getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import SectionHeading from '../ui/SectionHeading.astro';
import { em } from '../../lib/markup';
import { getHomeContent } from '../../lib/homeContent';
import tileApparatnaya from '../../assets/home/tiles/apparatnaya.jpg';
import tileInjekcionnaya from '../../assets/home/tiles/injekcionnaya.jpg';
import tileEsteticheskaya from '../../assets/home/tiles/esteticheskaya.jpg';

const home = await getHomeContent();
const { categories } = home;
const isBento = categories.items.length === 3;

// Mobile-only art-direction crops (see docs/superpowers/specs/2026-09-12-directions-mobile-tiles-design.md).
// Keyed by slug, not index, so a future re-ordering of service_categories in Directus
// doesn't silently pair the wrong crop with the wrong card.
const mobileTileBySlug: Record<string, ImageMetadata> = {
  'apparatnaya-kosmetologiya': tileApparatnaya,
  'injekcionnaya-cosmetologiya': tileInjekcionnaya,
  'esteticheskaya-kosmetologiya': tileEsteticheskaya,
};

const mobileTiles = await Promise.all(
  categories.items.map((item) => {
    const source = mobileTileBySlug[item.slug];
    return source ? getImage({ src: source, widths: [380, 472], format: 'jpg' }) : null;
  }),
);
---
```

- [ ] **Step 2: Wrap the `<Image>` in a `<picture>` with a mobile `<source>`**

The `.map()` callback needs a block body (instead of an implicit-return arrow function) so a `mobileTile` variable can be looked up once per card. Change the whole card-rendering expression from:

```astro
      categories.items.map((item, i) => (
        <a class:list={['service-card', 'reveal']} href={`/${item.slug}`}>
          <Image
            src={item.cover.src}
            alt={item.alt}
            width={700}
            height={900}
            widths={[420, 700, 1000]}
            sizes="(max-width: 800px) 84vw, 33vw"
            loading="lazy"
          />
          <span class="service-card__number glass-chip glass-chip--dark">{String(i + 1).padStart(2, '0')}</span>
          <div class="service-card__content">
            <p class="glass-chip glass-chip--dark">{item.tagline}</p>
            <h3 set:html={em(item.title)} />
            <span class="round-arrow glass-chip glass-chip--dark" aria-hidden="true">
              ↗
            </span>
          </div>
        </a>
      ))
    }
```

to:

```astro
      categories.items.map((item, i) => {
        const mobileTile = mobileTiles[i];
        return (
          <a class:list={['service-card', 'reveal', { 'service-card--wide': i === 0 }]} href={`/${item.slug}`}>
            <picture>
              {mobileTile && <source media="(max-width: 800px)" srcset={mobileTile.srcSet.attribute} />}
              <Image
                src={item.cover.src}
                alt={item.alt}
                width={700}
                height={900}
                widths={[420, 700, 1000]}
                sizes="(max-width: 800px) 84vw, 33vw"
                loading="lazy"
              />
            </picture>
            <span class="service-card__number glass-chip glass-chip--dark">{String(i + 1).padStart(2, '0')}</span>
            <div class="service-card__content">
              <p class="glass-chip glass-chip--dark">{item.tagline}</p>
              <h3 set:html={em(item.title)} />
              <span class="round-arrow glass-chip glass-chip--dark" aria-hidden="true">
                ↗
              </span>
            </div>
          </a>
        );
      })
    }
```

- [ ] **Step 3: Add the base (all-breakpoints) `<picture>` sizing rule**

In the `<style>` block, right after the existing `.service-card :global(img)` rule (around line 76-84), add:

```css
  .service-card picture {
    display: block;
    width: 100%;
    height: 100%;
  }
```

`<picture>` is written directly in this file's template, so it's scoped normally by Astro (no `:global()` needed) — only the `<img>` generated by the `<Image>` component needs `:global()`.

- [ ] **Step 4: Run diagnostics and verify desktop is unchanged**

```bash
npm run check
```

Expected: no new errors.

```bash
npm run dev
```

Open `http://127.0.0.1:4321/#services` at a desktop width (e.g. 1440px browser window). Confirm the three cards look pixel-identical to before this task (full-bleed portrait photo, dark scrim, white overlaid text) — the `<picture>`/`<source>` wrapper should be invisible at this width since the `media="(max-width: 800px)"` source doesn't match.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: art-direct mobile photo crops for Directions cards via picture/source"
```

---

## Task 3: Compact the section heading on mobile

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Pass a class to `SectionHeading`**

Change:

```astro
  <SectionHeading eyebrow={categories.eyebrow} title={categories.title} lead={categories.lead} />
```

to:

```astro
  <SectionHeading eyebrow={categories.eyebrow} title={categories.title} lead={categories.lead} class="services__heading" />
```

- [ ] **Step 2: Add the mobile override inside the existing `@media (max-width: 800px)` block**

`SectionHeading`'s own markup (`.section-heading`, `.section-heading__lead`) isn't written in `Categories.astro`, so reaching it requires `:global()`. `SectionHeading.astro`'s own mobile rule (`.section-heading, .section-heading--grid { margin-bottom: 35px; }`) has specificity `(0,1,0)`, so the override must combine two classes to reliably win regardless of stylesheet order — a bare `:global(.services__heading)` would tie on specificity and could lose. Add, inside the existing `@media (max-width: 800px)` block (the one that currently starts with `.service-grid, .service-grid--bento { display: flex; ... }`):

```css
    :global(.section-heading.services__heading) {
      margin-bottom: 20px;
    }
    :global(.services__heading .section-heading__lead) {
      margin-top: 10px;
      font-size: 15px;
      line-height: 1.5;
    }
```

- [ ] **Step 3: Verify**

```bash
npm run check
```

With `npm run dev` still running, open the page at a mobile width (375px, via browser devtools device toolbar) and confirm the gap between "Забота именно для вас" and the lead paragraph, and between the lead and the grid, is visibly tighter than before. Desktop (1440px) must look unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "fix: tighten Directions section heading spacing on mobile"
```

---

## Task 4: New mobile grid composition (wide tile + two, single-column fallback)

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Replace the mobile rail grid rules**

Find the existing `@media (max-width: 800px)` block's grid rules:

```css
  @media (max-width: 800px) {
    .service-grid,
    .service-grid--bento {
      display: flex;
      overflow-x: auto;
      gap: 10px;
      margin-right: -18px;
      padding-right: 18px;
    }
    .service-card {
      flex: 0 0 84vw;
      height: 520px;
      scroll-snap-align: center;
    }
    .service-card__content h3 {
      font-size: 31px;
    }
```

Replace with (this task only changes the grid container and drops the old flex/scroll-rail rules for the bento case — `.service-card` sizing and `.service-card__content h3` are rebuilt in Tasks 5-6, so remove those two rules here rather than editing them twice):

```css
  @media (max-width: 800px) {
    .service-grid {
      display: flex;
      overflow-x: auto;
      gap: 10px;
      margin-right: -18px;
      padding-right: 18px;
    }
    .service-grid--bento {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-areas: 'a a' 'b c';
      gap: 10px;
      overflow: visible;
      margin-right: 0;
      padding-right: 0;
    }
    .service-grid--bento .service-card:nth-child(1) {
      grid-area: a;
    }
    .service-grid--bento .service-card:nth-child(2) {
      grid-area: b;
    }
    .service-grid--bento .service-card:nth-child(3) {
      grid-area: c;
    }
    .service-grid .service-card {
      flex: 0 0 84vw;
      height: 520px;
      scroll-snap-align: center;
    }
```

(`.service-grid--bento` is used only when `items.length === 3` per the frontmatter's `isBento` check, so `.service-grid` above now only ever matches the non-bento fallback case — its old rail rules are preserved unchanged for that case.)

- [ ] **Step 2: Add the sub-380px single-column fallback**

After the `@media (max-width: 800px)` block's closing `}`, add a new block:

```css
  @media (max-width: 379px) {
    .service-grid--bento {
      grid-template-columns: 1fr;
      grid-template-areas: 'a' 'b' 'c';
    }
  }
```

- [ ] **Step 3: Verify**

```bash
npm run check
```

In the browser devtools device toolbar, check three widths:
- 800px→ down to 380px: grid shows one wide row, then two equal columns below it (cards will look unstyled/broken until Tasks 5-6 land — that's expected at this point, just confirm the *grid areas* stack correctly, e.g. by temporarily giving each `.service-card` a visible `outline: 2px solid red` in devtools to see the boxes).
- 375px and 320px: the two lower cards stack into a single column.
- Desktop (1440px): unchanged (this media query doesn't touch it).

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: switch mobile Directions grid to wide-tile-plus-two composition"
```

---

## Task 5: Mobile card layout — flex reordering, panel backgrounds, hide chip/scrim

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Declare the two new tile background colours**

Inside the `@media (max-width: 800px)` block, on the `.service-grid--bento` rule added in Task 4, add two custom properties:

```css
    .service-grid--bento {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-areas: 'a a' 'b c';
      gap: 10px;
      overflow: visible;
      margin-right: 0;
      padding-right: 0;
      --tile-injection-bg: #e4dccf;
      --tile-aesthetic-bg: #dee1d6;
    }
```

- [ ] **Step 2: Turn each card into a flex container and set its background/text colour**

Still inside `@media (max-width: 800px)`, add:

```css
    .service-grid--bento .service-card {
      display: flex;
      height: auto;
      min-height: 190px;
      color: var(--ink);
    }
    .service-grid--bento .service-card--wide {
      flex-direction: row-reverse;
      background: var(--sand);
    }
    .service-grid--bento .service-card:not(.service-card--wide) {
      flex-direction: column;
    }
    .service-grid--bento .service-card:nth-child(2) {
      background: var(--tile-injection-bg);
    }
    .service-grid--bento .service-card:nth-child(3) {
      background: var(--tile-aesthetic-bg);
    }
```

- [ ] **Step 3: Hide the numbered chip and the dark scrim**

```css
    .service-grid--bento .service-card__number {
      display: none;
    }
    .service-grid--bento .service-card::after {
      display: none;
    }
```

- [ ] **Step 4: Size the photo per card role, add the wide card's edge blend**

```css
    .service-grid--bento .service-card picture {
      position: relative;
      height: auto;
    }
    .service-grid--bento .service-card--wide picture {
      flex: 0 0 44%;
    }
    .service-grid--bento .service-card--wide picture::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 1;
      background: linear-gradient(90deg, var(--sand) 0%, transparent 35%);
      pointer-events: none;
    }
    .service-grid--bento .service-card:not(.service-card--wide) picture {
      flex: 0 0 auto;
      aspect-ratio: 4 / 3;
    }
```

- [ ] **Step 5: Turn the content block into an in-flow flex column**

```css
    .service-grid--bento .service-card__content {
      position: static;
      inset: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .service-grid--bento .service-card--wide .service-card__content {
      padding: 20px;
    }
    .service-grid--bento .service-card:not(.service-card--wide) .service-card__content {
      padding: 14px;
    }
```

- [ ] **Step 6: Verify**

```bash
npm run check
```

At 375px width: the top card should now show text on a cream background on the left and the apparatnaya photo on the right; the two lower cards should show their photo on top and a coloured panel (sand-ish / sage-ish) below. Text will still look oversized/misplaced (tagline still styled as an uppercase glass chip, arrow still floating via old absolute rules) — that's expected, fixed in Task 6-7. Desktop must still look unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: rebuild mobile Directions card layout as light text-plus-photo panels"
```

---

## Task 6: Mobile typography — title, tagline, per card role

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Size the title per card role**

Inside `@media (max-width: 800px)`, add:

```css
    .service-grid--bento .service-card--wide .service-card__content h3 {
      font-size: clamp(28px, 8vw, 34px);
    }
    .service-grid--bento .service-card:not(.service-card--wide) .service-card__content h3 {
      font-size: clamp(18px, 5vw, 22px);
      line-height: 1.15;
    }
```

- [ ] **Step 2: Turn the tagline from a dark glass chip into plain muted text**

```css
    .service-grid--bento .service-card__content p {
      display: block;
      background: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      padding: 0;
      border-radius: 0;
      text-transform: none;
      letter-spacing: normal;
      font-size: 14px;
      line-height: 1.4;
      opacity: 1;
      color: var(--ink-2);
      margin: 0 0 12px;
    }
```

(The existing rule `.service-grid { ... } .service-card__content h3 { font-size: 31px; }` was already removed from the old flat mobile block in Task 4 — this task's two role-specific selectors above are its replacement.)

- [ ] **Step 3: Verify**

```bash
npm run check
```

At 375px: titles should read at a comfortable size in both the wide and the two lower tiles, wrapping onto 2 lines without truncation (check "Аппаратная косметология", "Инъекционная косметология", "Эстетическая косметология" specifically, since these are the longest labels). Taglines should render as plain grey-ish text, not a dark pill badge.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "fix: resize Directions mobile card typography per tile role"
```

---

## Task 7: Gold arrow button on mobile

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Restyle `.round-arrow` as a solid gold circle with a right-arrow glyph**

Inside `@media (max-width: 800px)`, add:

```css
    .service-grid--bento .round-arrow {
      position: static;
      align-self: flex-end;
      margin-top: auto;
      background: var(--gold);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      color: #fff;
      font-size: 0;
      width: 44px;
      height: 44px;
    }
    .service-grid--bento .round-arrow::before {
      content: '→';
      font-size: 18px;
    }
    .service-grid--bento .service-card:not(.service-card--wide) .round-arrow {
      width: 40px;
      height: 40px;
    }
```

The existing sitewide `.round-arrow` rule (desktop hover state, `↗` glyph) is untouched — this is a mobile-only override scoped inside `@media (max-width: 800px)`, using the `.service-grid--bento` ancestor so it applies only to this block's cards (not any future non-bento 2-item variant of the section).

- [ ] **Step 2: Verify**

```bash
npm run check
```

At 375px: each card should show a solid gold circle with a white `→` pinned to the bottom-right of its text panel, with visible breathing room between the tagline text and the button (not overlapping). Compare the two lower cards' button positions — they should sit on the same visual baseline since both panels are equal-height grid cells with the button pushed down via `margin-top: auto`.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: solid gold right-arrow button for Directions mobile tiles"
```

---

## Task 8: "Не знаете, что выбрать?" hint plaque

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Add the markup after the grid, inside the section**

Change:

```astro
  </div>
</section>
```

(the closing tag of `.service-grid`/`.service-grid--bento` immediately before `</section>`) to:

```astro
  </div>

  <div class="services__hint glass-panel">
    <p class="services__hint-title">Не знаете, что выбрать?</p>
    <button type="button" class="services__hint-cta" data-open-sheet data-context="Консультация">
      Начните с консультации <span aria-hidden="true">→</span>
    </button>
  </div>
</section>
```

This reuses the sitewide `[data-open-sheet]` contact-sheet convention (`src/scripts/contact-sheet.ts`) — no new JS. `data-context="Консультация"` prefills the WhatsApp message the same way `PriceTable.astro`'s per-row CTAs already do.

- [ ] **Step 2: Style it — hidden by default, shown as a compact row on mobile**

Add to the `<style>` block (outside any media query, near the top with the other component-level rules):

```css
  .services__hint {
    display: none;
  }
```

Then inside the existing `@media (max-width: 800px)` block, add:

```css
    .services__hint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 14px;
      padding: 16px 18px;
    }
    .services__hint-title {
      margin: 0;
      font: 400 16px var(--display);
      color: var(--ink);
    }
    .services__hint-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: 0;
      padding: 0;
      font: 600 14px var(--sans);
      color: var(--gold-deep);
      cursor: pointer;
      white-space: nowrap;
    }
```

`.glass-panel` (composed in the markup, not redeclared here) supplies the background/blur/border/radius, per the sitewide "compose, don't redeclare" convention documented in `src/styles/base.css:249-251`.

- [ ] **Step 3: Verify**

```bash
npm run check
```

At 375px: below the three cards, confirm a light rounded plaque reading "Не знаете, что выбрать?" with a gold "Начните с консультации →" beneath/beside it. Click it — the site's existing contact `<dialog>` (Позвонить / Telegram / WhatsApp / MAX) should open. At 1440px (desktop): the plaque must not appear at all.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: add consultation hint plaque below Directions mobile tiles"
```

---

## Task 9: QA pass

**Files:** none (verification only)

- [ ] **Step 1: Full diagnostics**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 2: Build the site**

```bash
npm run build
```

If this fails because `DIRECTUS_URL`/`DIRECTUS_TOKEN` aren't set in a local `.env` (see `deploy/site.env.example`), skip straight to Step 3 using `npm run dev` instead — building against Directus isn't required to verify this purely front-end change, but run it if credentials are available since it's the project's real production path.

- [ ] **Step 3: Screenshots at the widths the brief calls out**

With `npm run dev` (or `npm run preview` if the build succeeded) running:

```bash
node scripts/qa/screenshots.mjs http://127.0.0.1:4321 docs/qa/directions-mobile /
```

This covers 375/800/1440px (the script's fixed width list — see `scripts/qa/screenshots.mjs:12`). The brief also calls out 320/390/430px specifically, which the script doesn't support natively, so capture those three with a one-off script reusing the same `playwright-core` dependency:

```bash
node --input-type=module <<'EOF'
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const executablePath =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
for (const width of [320, 390, 430]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `docs/qa/directions-mobile/index-${width}.png`, fullPage: true, animations: 'disabled' });
  await page.close();
}
await browser.close();
EOF
```

Confirm across all captured widths (320/375/390/430/800/1440):
- No horizontal scrollbar.
- No overlapping elements.
- No truncated/ellipsized card titles.

- [ ] **Step 4: Accessibility check**

```bash
node scripts/qa/a11y.mjs http://127.0.0.1:4321 /
```

Expected: exit code 0, no serious/critical violations. Pay particular attention to colour-contrast findings on the new `--ink`-on-`--tile-injection-bg`/`--tile-aesthetic-bg` text and the white-on-gold arrow button — adjust the two new background hex values from Task 5 if contrast fails, keeping them within the "sandy" / "sage" family described in the design spec.

- [ ] **Step 5: Manual link/behaviour check**

In a mobile-width browser view:
- Click/tap each of the 3 cards → confirm navigation to `/apparatnaya-kosmetologiya`, `/injekcionnaya-cosmetologiya`, `/esteticheskaya-kosmetologiya` respectively.
- Click/tap the hint plaque's CTA → confirm the contact sheet opens.
- Tab through the section with a keyboard → confirm a visible focus outline appears on each of the 3 cards and on the hint button.
- Confirm the fixed bottom `MobileCtaBar` doesn't visually overlap the hint plaque (per the design spec's assumption that existing section-to-section spacing already clears it).

- [ ] **Step 6: Commit the QA screenshots**

```bash
git add docs/qa/directions-mobile/
git commit -m "docs: add QA screenshots for Directions mobile tile redesign"
```

---

## Out of scope (unchanged by this plan)

- Desktop layout of this block.
- Replacing `cat-esteticheskaya.jpg` for the desktop bento view.
- Updating the esteticheskaya category's Directus `alt` text.
- Any other homepage section.
