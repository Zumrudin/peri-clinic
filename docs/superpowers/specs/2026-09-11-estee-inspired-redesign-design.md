# Estee-clinic-inspired visual refresh: category cards, case cards, hero, footer

## Background

User liked the aesthetic of `msk.estee-clinic.ru` (minimal, airy, "premium
through restraint"). Reverse-engineered its public HTML/CSS bundle (colours,
type, radii, blur usage — not copied assets/text/fonts, which are the
competitor's IP) and identified the underlying mechanics:

- The "few colours" feeling comes from a **monochrome tonal ramp** (one hue,
  many lightness steps) on a warm off-white base, not literally few colours.
- Heavy, consistent **large border-radius** everywhere, including pill shapes
  for small badges/tags.
- **backdrop-filter blur** ("glass") instead of box-shadow for most depth/
  separation, used broadly (cards, header, overlays), not just as an accent.
- Wide `letter-spacing` (`0.1–0.22em`) on small uppercase labels.

PERI CLINIC's existing design system (`src/styles/tokens.css`,
`src/styles/base.css`) already has the ingredients — `.glass-panel`, `.glow`,
`--radius-pill`, wide-tracked `.eyebrow` — but they're used sparingly (one
hero note). This spec applies the same *principles*, using PERI's own
ivory/gold palette and Cormorant Garamond/Golos Text type (never
estee-clinic's fonts, colours, or content), more broadly across four blocks:
category cards, case cards, hero, and footer.

## Design

### 1. Tokens (`src/styles/tokens.css`)

Add a light-end gold tonal ramp for backgrounds/borders/shadows, additive to
existing `--gold` / `--gold-light` / `--gold-deep` / `--gold-hover` (unchanged,
still used everywhere they are today):

```css
--gold-05: #faf7ef;   /* card background wash */
--gold-10: #f3ecd9;
--gold-15: #e9dcb8;
--gold-25: #d9c383;
--line-gold: rgba(127, 101, 31, 0.16);   /* replaces --line in touched components */
--shadow-gold: 0 20px 60px -12px rgba(127, 101, 31, 0.2); /* replaces --shadow-soft in touched components */
```

`--radius-pill` (already exists) gets its first real usage. `CaseCard`'s
`border-radius` moves from `--radius` (22px) to `--radius-lg` (32px) to match
`Categories`' service cards.

### 2. Shared utility: `.glass-chip` (`src/styles/base.css`)

A small pill-shaped glass badge — `.glass-panel`'s little sibling: same
`backdrop-filter: blur()` + translucent background idea, but sized for inline
badges/tags (`border-radius: var(--radius-pill)`, compact padding, no
gradient-border pseudo-element). Needed identically in four places (service
card tag, case card category label, case card before/after label, hero
address) — same reuse threshold that justified `.glass-panel` itself, so it's
a shared global utility, not four copies of similar CSS. Composed the same
way as `.glass-panel` (`class="case-card__category glass-chip"`), and subject
to the same scoped-`<style>` rule: never redeclared inside a component.

### 3. Category cards (`src/components/home/Categories.astro`)

Structure unchanged (photo + dark gradient + title is already close to the
estee pattern). Overlay elements get glass treatment instead of flat borders:

- `.service-card__number` (numbered circle) and `.round-arrow`: replace plain
  `border: 1px solid rgba(255,255,255,.55)` with `.glass-chip` styling
  (blur + translucency) so they read as glass badges floating on the photo.
- `.service-card__content p` (tagline, currently plain uppercase text): wrap
  in `.glass-chip` as a small pill tag above the heading.
- Hover shadow stays `--shadow-glow` (already gold-tinted; no change needed).

### 4. Case cards (`src/components/results/CaseCard.astro`)

- Background: `var(--paper)` → `var(--gold-05)`.
- `border-radius`: `var(--radius)` → `var(--radius-lg)`.
- Add `border: 1px solid var(--line-gold)`.
- Category label and the "до"/"после" image caption (currently flat
  `rgba(255,255,255,.9)` chips): both become `.glass-chip`.
- Add a hover state (none exists today): small lift (`translateY(-2px)`) +
  `var(--shadow-gold)`, consistent with `Categories`' hover.

### 5. Hero (`src/components/home/Hero.astro`)

Hero already implements the core estee pattern (`.hero__note` is a floating
`.glass-panel` circle over the photo) — no structural rebuild needed.

- `.hero__address` (currently plain white text + `text-shadow` over the
  photo): wrap in `.glass-panel` as a small plaque, matching `.hero__note`'s
  treatment. The city label inside becomes a `.glass-chip`.
- `.hero__facts` divider: `border-right: 1px solid var(--line)` → `var(--line-gold)`.
- `.hero__note` unchanged (its gradient border already uses `--gold-light`).

### 6. Footer (`src/components/shell/Footer.astro`)

- `.footer__top` (logo + tagline + phone): wrap in `.glass-panel`. The
  `.footer` background changes from flat `var(--sand)` to a subtle gradient
  toward `--gold-05` so the glass panel is visible against it.
- `.footer__disclaimer` (currently a full-width bar with top/bottom hairline
  borders): becomes a centered `.glass-chip`-style pill instead of a full-width
  bar.
- All `border-color: var(--line)` in footer rules → `var(--line-gold)`.
  Link hover colour stays `var(--gold-deep)` (unchanged).

## Out of scope

- No new components, no changes to `ProcedurePage`/`CategoryPage` templates,
  `FAQ`, `Reviews`, `Devices`, `Approach`, `Ticker`, or `ContactSheet` —
  only the four blocks discussed.
- No copying of estee-clinic's fonts (`PPNeueMontreal`, `Military Scribe`),
  exact colours, images, or copy — principles only, reimplemented in PERI's
  own palette/type.
- No changes to `.glass-panel` itself or existing usages of it elsewhere.
- No new `--radius-*` size beyond what already exists (`--radius`,
  `--radius-lg`, `--radius-pill`).
- No JS/behaviour changes — this is CSS/markup-only across the four
  components plus the two shared files.

## Testing

- `npm run check` (Astro/TS diagnostics).
- Manual visual check in dev (`npm run dev`) of `/` (hero, categories,
  footer) and `/result` (case cards) at 375/800/1440 widths.
- `node scripts/qa/a11y.mjs` against `/` and `/result` — must stay 0
  serious/critical (glass-chip text contrast needs checking against photos,
  per the phase-7 accessibility baseline in `CLAUDE.md`: min 11px text, gold
  text uses `--gold-deep`).
- `node scripts/qa/screenshots.mjs` for `/` and `/result` at 375/800/1440,
  committed under `docs/qa/`.
- `prefers-reduced-motion` unaffected (no new motion introduced beyond the
  existing hover transitions, which already respect it via the global rule
  in `base.css`).
