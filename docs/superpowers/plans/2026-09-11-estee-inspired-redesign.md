# Estee-inspired visual refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the estee-clinic-inspired visual language (gold tonal ramp, broader glass/blur usage, pill badges) to category cards, case cards, hero, and footer, per `docs/superpowers/specs/2026-09-11-estee-inspired-redesign-design.md`.

**Architecture:** Pure CSS/markup change. Two new global primitives (`--gold-05/10/15/25`, `--line-gold`, `--shadow-gold` tokens; `.glass-chip`/`.glass-chip--dark` utility) land first, then four components are updated to compose them. No new components, no JS/behaviour changes, no new dependencies.

**Tech Stack:** Astro (`.astro` components with scoped `<style>`), plain CSS custom properties (`src/styles/tokens.css`, `src/styles/base.css`).

---

There is no unit-test coverage for CSS/markup in this codebase (`npm test` only covers `src/lib/**/*.test.ts`). Each task's verification step is `npm run check` (Astro/TS diagnostics — catches broken markup/props) plus a manual visual check in the dev server, matching the spec's own Testing section. The final task runs the project's QA scripts.

### Task 1: Add gold tonal ramp + line/shadow tokens

**Files:**
- Modify: `src/styles/tokens.css:16-29`

- [ ] **Step 1: Add the ramp and `--line-gold` to the Colour block**

In `src/styles/tokens.css`, replace:

```css
  --sand: #ede9df;
  --line: rgba(45, 43, 35, 0.14);
  --line-on-dark: rgba(255, 255, 255, 0.14);

  /* Glass */
```

with:

```css
  --sand: #ede9df;
  --line: rgba(45, 43, 35, 0.14);
  --line-on-dark: rgba(255, 255, 255, 0.14);

  /* Gold tonal ramp — light-end wash for card backgrounds/borders, used by
     the estee-inspired refresh (Categories, CaseCard, Hero, Footer). */
  --gold-05: #faf7ef;
  --gold-10: #f3ecd9;
  --gold-15: #e9dcb8;
  --gold-25: #d9c383;
  --line-gold: rgba(127, 101, 31, 0.16);

  /* Glass */
```

- [ ] **Step 2: Add `--shadow-gold` to the Shadow / glow block**

Replace:

```css
  /* Shadow / glow */
  --shadow-soft: 0 20px 60px -12px rgba(36, 36, 31, 0.18);
  --shadow-glow: 0 0 0 1px rgba(170, 137, 47, 0.18), 0 25px 80px -20px rgba(170, 137, 47, 0.45);
```

with:

```css
  /* Shadow / glow */
  --shadow-soft: 0 20px 60px -12px rgba(36, 36, 31, 0.18);
  --shadow-gold: 0 20px 60px -12px rgba(127, 101, 31, 0.2);
  --shadow-glow: 0 0 0 1px rgba(170, 137, 47, 0.18), 0 25px 80px -20px rgba(170, 137, 47, 0.45);
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: no new errors (this is a pure CSS addition, nothing references the new tokens yet).

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat: add gold tonal ramp and line/shadow tokens for estee-inspired refresh"
```

---

### Task 2: Add the `.glass-chip` utility

**Files:**
- Modify: `src/styles/base.css:239-283` (right after the existing `.glass-panel` block, before the `/* Ambient glow */` comment)

- [ ] **Step 1: Insert the new utility**

In `src/styles/base.css`, find the end of the `.glass-panel` block:

```css
@supports (not (mask-composite: exclude)) and (not (-webkit-mask-composite: xor)) {
  .glass-panel {
    border: 1px solid var(--glass-border);
  }
  .glass-panel--dark {
    border-color: var(--glass-border-dark);
  }
  .glass-panel::before {
    display: none;
  }
}

/* Ambient glow — decorative drifting gradient blobs behind a section.
```

Replace it with (adds the new block between the two, keeps the ambient-glow comment/rule that follows untouched):

```css
@supports (not (mask-composite: exclude)) and (not (-webkit-mask-composite: xor)) {
  .glass-panel {
    border: 1px solid var(--glass-border);
  }
  .glass-panel--dark {
    border-color: var(--glass-border-dark);
  }
  .glass-panel::before {
    display: none;
  }
}

/* Glass chip — small pill-shaped glass badge, .glass-panel's compact sibling
   (no gradient border, sized for inline badges/tags). Compose as an
   additional class (e.g. class="case-card__category glass-chip"); never
   redeclare .glass-chip inside a component's scoped <style>, same rule as
   .glass-panel above. */
.glass-chip {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur));
  -webkit-backdrop-filter: blur(var(--blur));
  padding: 6px 14px;
}
.glass-chip--dark {
  background: var(--glass-bg-dark);
}
@supports (not (backdrop-filter: blur(1px))) and (not (-webkit-backdrop-filter: blur(1px))) {
  .glass-chip {
    background: rgba(255, 253, 246, 0.92);
  }
  .glass-chip--dark {
    background: rgba(41, 41, 35, 0.85);
  }
}

/* Ambient glow — decorative drifting gradient blobs behind a section.
```

- [ ] **Step 2: Verify**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/base.css
git commit -m "feat: add .glass-chip utility for pill-shaped glass badges"
```

---

### Task 3: Category cards — glass badges (`Categories.astro`)

**Files:**
- Modify: `src/components/home/Categories.astro`

- [ ] **Step 1: Add `glass-chip glass-chip--dark` to the number badge, tagline, and arrow**

Replace:

```astro
          <span class="service-card__number">{String(i + 1).padStart(2, '0')}</span>
          <div class="service-card__content">
            <p>{item.tagline}</p>
            <h3 set:html={em(item.title)} />
            <span class="round-arrow" aria-hidden="true">
              ↗
            </span>
          </div>
```

with:

```astro
          <span class="service-card__number glass-chip glass-chip--dark">{String(i + 1).padStart(2, '0')}</span>
          <div class="service-card__content">
            <p class="glass-chip glass-chip--dark">{item.tagline}</p>
            <h3 set:html={em(item.title)} />
            <span class="round-arrow glass-chip glass-chip--dark" aria-hidden="true">
              ↗
            </span>
          </div>
```

- [ ] **Step 2: Drop the now-redundant plain borders in the scoped `<style>`**

The circles previously got their contrast from a hairline border; `.glass-chip--dark`'s blur+tint now does that job, so remove the `border` line from both rules (keep everything else — size/shape stay controlled by the component, per the same pattern `.hero__note` already uses with `.glass-panel`).

Replace:

```css
  .service-card__number {
    position: absolute;
    z-index: 2;
    top: 22px;
    left: 24px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 50%;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    font-size: 11px;
  }
```

with:

```css
  .service-card__number {
    position: absolute;
    z-index: 2;
    top: 22px;
    left: 24px;
    border-radius: 50%;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    font-size: 11px;
  }
```

Replace:

```css
  .round-arrow {
    position: absolute;
    right: 0;
    bottom: 1px;
    width: 48px;
    height: 48px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 19px;
    transition:
      background var(--dur-fast),
      color var(--dur-fast),
      transform var(--dur-fast);
  }
```

with:

```css
  .round-arrow {
    position: absolute;
    right: 0;
    bottom: 1px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 19px;
    transition:
      background var(--dur-fast),
      color var(--dur-fast),
      transform var(--dur-fast);
  }
```

(`.service-card__content p` and `.service-card:hover .round-arrow` need no changes — the tagline's own margin/typography and the hover's solid-white swap both still work unmodified alongside the new chip base.)

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: no new errors.

Run: `npm run dev`, open `http://127.0.0.1:4321/`, scroll to the categories section. Confirm: number badge, tagline pill, and arrow badge all show a frosted dark-glass look instead of a plain outline; hover still swaps the arrow to solid white as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/Categories.astro
git commit -m "feat: glass-chip badges on category card overlays"
```

---

### Task 4: Case cards — tonal background, radius, glass chips (`CaseCard.astro`)

**Files:**
- Modify: `src/components/results/CaseCard.astro`

- [ ] **Step 1: Add `glass-chip` to the before/after labels and category label**

Replace:

```astro
    hasPair ? (
      <div class="case-card__pair">
        <div class="case-card__half">
          <Image src={before!.src} alt={`${title} — до`} width={500} height={620} sizes="(max-width: 800px) 43vw, 220px" loading="lazy" />
          <span>до</span>
        </div>
        <div class="case-card__half">
          <Image src={after!.src} alt={`${title} — после`} width={500} height={620} sizes="(max-width: 800px) 43vw, 220px" loading="lazy" />
          <span>после</span>
        </div>
      </div>
    ) : single ? (
      <div class="case-card__image">
        <Image src={single.src} alt={title} width={700} height={620} sizes="(max-width: 800px) 86vw, 30vw" loading="lazy" />
        <span>до / после</span>
      </div>
    ) : null
  }
  <div class="case-card__body">
    {category && <p class="case-card__category">{category}</p>}
```

with:

```astro
    hasPair ? (
      <div class="case-card__pair">
        <div class="case-card__half">
          <Image src={before!.src} alt={`${title} — до`} width={500} height={620} sizes="(max-width: 800px) 43vw, 220px" loading="lazy" />
          <span class="glass-chip">до</span>
        </div>
        <div class="case-card__half">
          <Image src={after!.src} alt={`${title} — после`} width={500} height={620} sizes="(max-width: 800px) 43vw, 220px" loading="lazy" />
          <span class="glass-chip">после</span>
        </div>
      </div>
    ) : single ? (
      <div class="case-card__image">
        <Image src={single.src} alt={title} width={700} height={620} sizes="(max-width: 800px) 86vw, 30vw" loading="lazy" />
        <span class="glass-chip">до / после</span>
      </div>
    ) : null
  }
  <div class="case-card__body">
    {category && <p class="case-card__category glass-chip">{category}</p>}
```

- [ ] **Step 2: Update the card shell — tonal background, bigger radius, gold border, hover**

Replace:

```css
  .case-card {
    background: var(--paper);
    border-radius: var(--radius);
    overflow: hidden;
  }
```

with:

```css
  .case-card {
    background: var(--gold-05);
    border: 1px solid var(--line-gold);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition:
      transform var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast);
  }
  .case-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-gold);
  }
```

- [ ] **Step 3: Drop the now-redundant flat chip background on the image labels**

Replace:

```css
  .case-card__half span,
  .case-card__image span {
    position: absolute;
    left: 10px;
    bottom: 10px;
    background: rgba(255, 255, 255, 0.9);
    padding: 6px 10px;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
```

with:

```css
  .case-card__half span,
  .case-card__image span {
    position: absolute;
    left: 10px;
    bottom: 10px;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
```

(`.case-card__category` needs no CSS change — its margin/color/font stay, `glass-chip` supplies the pill background/padding/radius on top.)

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: no new errors.

Run: `npm run dev`, open `http://127.0.0.1:4321/result`. Confirm: cards have a warm tinted background and larger corner radius, "до"/"после"/category labels look like frosted glass pills, hover lifts the card with a soft gold shadow.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/CaseCard.astro
git commit -m "feat: gold-tinted background, radius, and glass chips on case cards"
```

---

### Task 5: Hero — glass plaque for the address, gold divider (`Hero.astro`)

**Files:**
- Modify: `src/components/home/Hero.astro`

- [ ] **Step 1: Wrap the address in `glass-panel glass-panel--dark`, the city label in `glass-chip glass-chip--dark`**

Replace:

```astro
    <div class="hero__address">
      <span>{site.city}</span>
      <p set:html={em(site.address_lines)} />
    </div>
```

with:

```astro
    <div class="hero__address glass-panel glass-panel--dark">
      <span class="glass-chip glass-chip--dark">{site.city}</span>
      <p set:html={em(site.address_lines)} />
    </div>
```

- [ ] **Step 2: Update `.hero__address` styling for the panel — drop the text-shadow hack, add interior padding**

Replace:

```css
  .hero__address {
    position: absolute;
    left: 30px;
    bottom: 30px;
    color: #fff;
    display: flex;
    gap: 30px;
    align-items: start;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.25);
  }
  .hero__address span {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding-top: 5px;
  }
  .hero__address p {
    font: 17px/1.2 var(--display);
    margin: 0;
  }
```

with:

```css
  .hero__address {
    position: absolute;
    left: 30px;
    bottom: 30px;
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 14px 20px;
    color: #fff;
  }
  .hero__address span {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .hero__address p {
    font: 17px/1.2 var(--display);
    margin: 0;
  }
```

- [ ] **Step 3: Swap `--line` for `--line-gold` on the facts divider (desktop and mobile)**

Replace:

```css
  .hero__facts div {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 155px;
    margin-right: 28px;
    padding-right: 28px;
    border-right: 1px solid var(--line);
  }
```

with:

```css
  .hero__facts div {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 155px;
    margin-right: 28px;
    padding-right: 28px;
    border-right: 1px solid var(--line-gold);
  }
```

Replace (inside the `@media (max-width: 800px)` block):

```css
    .hero__facts {
      margin: 40px 0 25px;
      padding: 25px 0 0;
      border-top: 1px solid var(--line);
      justify-content: space-between;
    }
```

with:

```css
    .hero__facts {
      margin: 40px 0 25px;
      padding: 25px 0 0;
      border-top: 1px solid var(--line-gold);
      justify-content: space-between;
    }
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: no new errors.

Run: `npm run dev`, open `http://127.0.0.1:4321/`. Confirm: the address block at the bottom-left of the hero photo now reads as a dark frosted-glass plaque (matching the circular note above it) instead of plain white text; the divider lines between the hero stats have a warm gold tint instead of neutral grey.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/Hero.astro
git commit -m "feat: glass plaque for hero address, gold-tinted facts divider"
```

---

### Task 6: Footer — glass panel for the top block, pill disclaimer (`Footer.astro`)

**Files:**
- Modify: `src/components/shell/Footer.astro`

- [ ] **Step 1: Add `glass-panel` to `.footer__top`, `glass-chip` to `.footer__disclaimer`**

Replace:

```astro
  <div class="footer__top">
    <a class="footer__logo" href="/" aria-label={`${site.name} — на главную`}>
      <Image src={logo} alt={site.name} width={190} densities={[1, 2]} loading="lazy" />
    </a>
    <p set:html={em(site.tagline)} />
    <a class="footer__phone" href={telHref(site.phone)}>{site.phone}</a>
  </div>
```

with:

```astro
  <div class="footer__top glass-panel">
    <a class="footer__logo" href="/" aria-label={`${site.name} — на главную`}>
      <Image src={logo} alt={site.name} width={190} densities={[1, 2]} loading="lazy" />
    </a>
    <p set:html={em(site.tagline)} />
    <a class="footer__phone" href={telHref(site.phone)}>{site.phone}</a>
  </div>
```

Replace:

```astro
  <p class="footer__disclaimer">{site.contraindications_text}</p>
```

with:

```astro
  <p class="footer__disclaimer glass-chip">{site.contraindications_text}</p>
```

- [ ] **Step 2: Give the footer a subtle gold wash so the glass panel is visible, restyle `.footer__top`**

Replace:

```css
  .footer {
    background: var(--sand);
    padding: 80px var(--gutter-wide) 30px;
  }
  .footer__top {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
    padding-bottom: 55px;
    border-bottom: 1px solid var(--line);
  }
```

with:

```css
  .footer {
    background: linear-gradient(180deg, var(--gold-05), var(--sand) 40%);
    padding: 80px var(--gutter-wide) 30px;
  }
  .footer__top {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
    padding: 28px var(--s-6);
    margin-bottom: 40px;
  }
```

(The old `border-bottom` divider is gone — the glass panel's own shadow and gradient border now separate it from the columns below. Reduce the grid's own top padding to keep the overall vertical rhythm the same as before.)

Replace:

```css
  .footer__grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1.2fr 1.2fr;
    gap: 60px;
    padding: 55px 0 45px;
  }
```

with:

```css
  .footer__grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1.2fr 1.2fr;
    gap: 60px;
    padding: 15px 0 45px;
  }
```

- [ ] **Step 3: Turn the disclaimer bar into a centered pill**

Replace:

```css
  .footer__disclaimer {
    margin: 0 0 20px;
    padding: 14px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    text-align: center;
    color: var(--ink-2);
    font: 500 12px/1.4 var(--sans);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
```

with:

```css
  .footer__disclaimer {
    display: table;
    margin: 0 auto 24px;
    max-width: 640px;
    text-align: center;
    color: var(--ink-2);
    font: 500 12px/1.4 var(--sans);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
```

(`display: table` shrink-wraps to the text width like `inline-block` while staying a block-level box, so `margin: 0 auto` actually centers it — plain `inline-flex`, which `.glass-chip` sets, can't be centered with `margin: auto`. The scoped rule above wins over `.glass-chip`'s `display` per the cascade rule documented at the top of `base.css`'s glass utilities, so this override is expected and safe.)

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: no new errors.

Run: `npm run dev`, open `http://127.0.0.1:4321/` and scroll to the footer. Confirm: logo/tagline/phone now sit inside a visible frosted glass card over a faint gold-to-sand gradient background; the contraindications line is a centered pill instead of a full-width bar with top/bottom rules. Resize to 375px and 800px widths and confirm the mobile layout (`@media (max-width: 800px)`, unchanged by this task) still looks correct — it only overrides `padding-bottom`/`flex-direction` on `.footer__top`, which still composes fine with the new base padding.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/Footer.astro
git commit -m "feat: glass panel for footer top block, pill-shaped disclaimer"
```

---

### Task 7: Full QA sweep

**Files:** none (verification only)

- [ ] **Step 1: Astro/TS diagnostics**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 2: Accessibility**

Run: `node scripts/qa/a11y.mjs http://127.0.0.1:4322 / /result`
(Build and preview first if not already running: `npm run build && npm run preview` in another terminal.)
Expected: exit code 0, no serious/critical violations. Pay particular attention to any contrast warning on `.glass-chip`/`.glass-panel--dark` text over photos — if one shows up, darken the affected text or bump `--glass-bg-dark`'s opacity slightly (do not skip this — it's a phase-7 hard requirement per `CLAUDE.md`).

- [ ] **Step 3: Screenshots**

Run: `node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/estee-refresh / /result`
Expected: PNGs written for `/` and `/result` at 375/800/1440 under `docs/qa/estee-refresh/`.

- [ ] **Step 4: Commit the QA artifacts**

```bash
git add docs/qa/estee-refresh
git commit -m "chore: QA screenshots for estee-inspired refresh"
```
