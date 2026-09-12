# Homepage hero: full-bleed consultation photo, mobile-first redesign

## Background

The current homepage hero (`src/components/home/Hero.astro`) is a two-column
layout: text content on the left, a framed/rounded photo on the right, with a
circular quote badge and an address glass panel overlaid on the photo corners.
On mobile (≤800px) the columns stack, but the same framed-photo treatment
carries over — the photo is still a bounded card, not full-bleed.

A prepared visual reference
(`https://dev.zumrudin.ru/peri-concepts/mobile-2026-09-12/02-consultation.png`)
shows a different pattern aimed primarily at mobile: the photo fills the
entire screen edge-to-edge below the header, text is overlaid directly on the
photo with a dark gradient scrim, and a single pill CTA button sits near the
bottom. The client supplied the real photo to use
(`https://dev.zumrudin.ru/peri-concepts/mobile-2026-09-12/peri-consultation-jewelry-v2.png`)
— a doctor-patient consultation shot with the actual PERI CLINIC wall logo,
replacing the mockup's stock photo.

Decisions made during brainstorming:
- The new full-bleed treatment replaces the hero on **all breakpoints**, not
  just mobile — there will be one hero design, not a mobile/desktop fork.
- Adopt the reference's new copy (eyebrow, heading, lead, primary button
  label) instead of the current CMS copy.
- Keep the existing stats row (`hero_facts`) and the secondary text-link —
  the reference doesn't show them, but the client wants them retained,
  restyled for the dark photo background.
- Drop the circular quote badge (`hero_note`); keep the address glass panel,
  repositioned to avoid the new bottom CTA block.
- The CTA button uses a light/ivory style (matching the reference) instead of
  the site's usual solid-gold `.button`, as a new reusable `.button--light`
  variant.
- The supplied photo is a portrait crop prepared for mobile. No new wide
  crop can be generated in this environment, so wide viewports get a CSS
  "blurred pillarbox" treatment instead of side-cropping or stretching.

## Design

### 1. Content structure (`src/components/home/Hero.astro`)

```
<section class="hero">
  <div class="hero__media" aria-hidden="true">
    <!-- blurred, scaled copy of hero.image, fills the section -->
    <!-- sharp hero.image on top, cover on narrow / contain on wide -->
  </div>
  <div class="hero__scrim" aria-hidden="true" />
  <div class="hero__content reveal">
    <p class="eyebrow">{hero.eyebrow}</p>
    <h1 set:html={em(hero.title)} />
    <div class="hero__bottom">
      <p class="hero__lead">{hero.lead}</p>
      <div class="hero__facts">{/* existing 3 stat items, unchanged data */}</div>
      <div class="hero__actions">
        <button class="button button--light" type="button" data-open-sheet>{hero.primary_label} <span>↗</span></button>
        <a class="text-link text-link--light" href={hero.secondary_href}>{hero.secondary_label} <span>↓</span></a>
      </div>
    </div>
  </div>
  <div class="hero__address glass-panel glass-panel--dark">
    <span class="glass-chip glass-chip--dark">{site.city}</span>
    <p set:html={em(site.address_lines)} />
  </div>
</section>
```

- `hero.image` and `hero.image_alt` still come from `getHomeContent()` /
  `directusImage()` — no changes to `homeContent.ts` or the zod schema, only
  to the underlying Directus values.
- `hero.note` (the old badge text) is simply no longer read/rendered. The
  field stays in the `home` collection schema and in Directus — harmless,
  editors just won't see it used. Not removing the field, since deleting
  CMS schema is out of scope and editors may still want a place to jot a
  note for a future design.
- `hero__content` uses `justify-content: space-between` (flex column) so the
  eyebrow+heading sit at the top and `hero__bottom` (lead/facts/actions) sits
  at the bottom of the section, matching the reference's composition, on
  every breakpoint — no separate mobile-only markup branch.

### 2. Photo layer — full-bleed with blurred pillarbox on wide screens

Two stacked images inside `.hero__media`, both from the same `hero.image`
source:

- **Backdrop**: small width (e.g. `widths={[400]}`), rendered with
  `filter: blur(60px) brightness(0.75); transform: scale(1.15); object-fit:
  cover;`, absolutely positioned to fill `.hero__media`. Cheap to generate
  and download since it's small and heavily blurred (blur hides compression
  artifacts).
- **Foreground**: the existing responsive `<Picture>` (same widths/formats/
  `fallbackFormat="jpg"` as today), `position: relative`, `height: 100%`,
  `width: auto`, `margin: auto`, `object-fit: cover`.
- Above roughly 900px width, switch the foreground to `object-fit: contain`
  via a media query — since the viewport is now proportionally much wider
  than the portrait photo, `contain` letterboxes left/right and the blurred
  backdrop shows through the letterbox area instead of cropping the subjects
  or the wall logo. Below that width, `cover` fills edge-to-edge exactly like
  the reference.
- `.hero__scrim`: `position: absolute; inset: 0; background:
  linear-gradient(180deg, rgba(20,18,12,0.15) 0%, rgba(20,18,12,0.05) 35%,
  rgba(20,18,12,0.75) 100%)` (tuned during implementation against the actual
  photo) — darkens the top edge enough for the eyebrow/heading and the
  bottom third enough for the lead/facts/actions, while keeping the middle of
  the photo clear.
- `.hero` keeps `min-height: calc(100vh - var(--header-h))` as today.

### 3. Colour treatment — light-on-dark

Everything in `.hero__content` and `.hero__address` needs to read against a
dark photo instead of the current ivory background:

- `.hero .eyebrow` → override colour to `var(--gold-light)` (the existing
  lighter gold token, already used for text on dark surfaces elsewhere, e.g.
  `treatment-cta .eyebrow`).
- `.hero h1` → `color: var(--dark-text)` (existing ivory-on-dark token); `em`
  stays gold via the existing global `h1 em` rule (already gold, reads fine
  on a dark photo).
- `.hero__lead` → `color: var(--dark-text)` at reduced opacity (e.g.
  `rgba(245, 242, 233, 0.85)`) instead of `var(--ink-2)`.
- `.hero__facts strong` → stays `var(--gold-light)` (swap from `--gold-deep`,
  which is tuned for ivory backgrounds); `.hero__facts span` → `var(--dark-
  text)` at reduced opacity instead of `var(--muted)`; divider borders switch
  from `var(--line-gold)` to `var(--line-on-dark)` (existing token).
- `.text-link--light` (new, scoped to this component): `border-bottom-color:
  var(--dark-text)` instead of the global `.text-link`'s `var(--ink)`; text
  colour `var(--dark-text)`. The `span` arrow stays `var(--gold)` from the
  global rule (already reads fine on dark).
- `.button--light` (new **global** variant, added to `src/styles/base.css`
  next to `.button--outline`, since it's a reusable modifier like the
  existing size/style variants, not one-off):
  ```css
  .button--light {
    background: var(--ivory);
    border-color: var(--ivory);
    color: var(--ink);
  }
  .button--light:hover {
    background: var(--paper);
    border-color: var(--paper);
  }
  ```
  `.button--light span` inherits the default `.button span` sizing; colour
  follows `.button--light`'s `color: var(--ink)` since `.button span` doesn't
  set its own colour today (verify against current CSS during implementation
  and add an override only if needed).

### 4. Address panel placement

Moves from bottom-left-of-photo to the **top-right corner** of the hero
section (`position: absolute; top: 24px; right: 24px;` scaled down on
mobile like the current implementation scales its other corner values),
so it never collides with the bottom lead/facts/actions block regardless of
viewport height. Content (`site.city` chip + `site.address_lines`) is
unchanged.

### 5. Content changes (Directus `home` singleton, applied via REST API)

| Field | New value |
|---|---|
| `hero_eyebrow` | `PERI CLINIC · ЭСТЕТИЧЕСКАЯ МЕДИЦИНА` |
| `hero_title` | `Начнём с заботы о вас.` |
| `hero_lead` | `Обсудим ваши пожелания на консультации.` |
| `hero_primary_label` | `Записаться на консультацию` |
| `hero_image` | new upload: `peri-consultation-jewelry-v2.png` |
| `hero_image_alt` | `Врач-косметолог PERI CLINIC на консультации с пациенткой` |

Unchanged: `hero_secondary_label` (`Смотреть результаты`), `hero_facts`
(3 existing stat items), `hero_note` (kept in the DB, just unused by the
template).

Applied directly against `peri-cms.zumrudin.ru` via the Directus REST API
using the admin credentials already present on this VPS
(`/srv/peri/directus/.env`) — no new migration script under
`scripts/migrate/`, since this is a one-off content edit through the CMS's
own API rather than a Wix-import step. The existing `builder` token
(`/srv/peri/site.env`) is read-only and cannot be used for this write.

### 6. Testing / QA

- `npm run check` for TS/Astro diagnostics.
- Manual QA with `scripts/qa/screenshots.mjs` at 375/800/1440 (the project's
  standard widths) against the dev build, committed under
  `docs/qa/hero-redesign/`.
- `scripts/qa/a11y.mjs` against `/` — the colour treatment is new (light text
  on a photo, new `.button--light`), so contrast must be re-verified against
  the accessibility baseline (0 serious/critical, min 11px text) rather than
  assumed from the existing audit.
- Verify the CMS write end-to-end: after the API update, trigger the publish
  Flow (or wait for the editor save that runs it) and confirm the new photo/
  copy appear on `peri.zumrudin.ru`.

## Out of scope

- Any other homepage section (Categories, Approach, Devices, Cases, Reviews,
  Cta) — unchanged.
- `TreatmentPage.astro`'s own hero (`.treatment-hero`) — a different,
  existing light-background pattern, not touched by this spec.
- Generating a genuinely wider/alternate photo crop for desktop — deferred;
  the CSS blur-pillarbox is the interim solution until a wide crop is
  supplied.
