# Homepage "Направления" block: mobile tile redesign

## Background

The homepage Categories block (`src/components/home/Categories.astro`) shows
the site's 3 top-level `service_categories` (Аппаратная / Инъекционная /
Эстетическая косметология). Today, on all breakpoints, it's a "bento" grid of
full-bleed portrait photo cards with a dark gradient scrim, white overlaid
text, a numbered chip (`01`/`02`/`03`) and a glass-chip round arrow. On mobile
(≤800px) this becomes a horizontal scroll-snap rail — one photo essentially
fills the screen per card, and the section has a fairly heavy vertical
footprint before a visitor sees all three directions.

A prepared visual reference
(`https://dev.zumrudin.ru/peri-concepts/directions-2026-09-12-v2/03-tiles.png`)
shows a different mobile composition: one wide tile on top (Аппаратная
косметология, given the primary visual weight) and two equal tiles below it
(Инъекционная / Эстетическая), all on light solid/photo-combination
backgrounds with dark text, gold circular arrow buttons, and a compact
heading. A "Не знаете, что выбрать?" hint plaque sits below the grid.

Decisions made during brainstorming:
- **Mobile-only** (≤800px, the existing rail breakpoint). The desktop bento
  (3 equal columns, dark overlay) is untouched.
- All three tile photos are cropped directly from the supplied reference PNG
  (the client's own instruction: "изображения можно использовать такие же
  как на референсе"). This sidesteps a real problem: the current
  `cat-esteticheskaya.jpg` asset is a body-apparatus photo with a burned-in
  ad caption, and no other existing project asset (`case-guby.jpg`,
  `case-konturnaya.jpg`, `approach.jpg`) fits "hands-on facial care" either.
  Trade-off accepted by the client: the reference is a flattened 1024×1536
  mockup, so cropped photos are lower-resolution than the site's other
  photography and will look softer on high-DPI phones. Desktop keeps using
  the existing (mismatched) `cat-esteticheskaya.jpg` via `item.cover` — fixing
  that is out of scope here; flagged below as follow-up.
- The hint plaque's "Начните с консультации" action reuses the site's
  existing contact-sheet convention (`[data-open-sheet]` button opening the
  shared `<dialog>`), not a real booking form — the site has none.
- Arrow glyph in the new tiles is `→` (matching the reference and the
  client's ТЗ wording, which says "стрелка вправо" three times), diverging
  intentionally from the sitewide `↗` used elsewhere (header/CTA buttons,
  desktop card hover arrow) — scoped to these three mobile tiles only.

## Design

### 1. Scope of file changes

Only `src/components/home/Categories.astro` changes: its mobile
(`@media (max-width: 800px)`) styles and, for the photos, its markup (adding
`<picture>` art-direction so mobile crops don't affect desktop). No changes
to `src/lib/homeContent.ts`, `src/content.config.ts`, or the Directus
`service_categories` schema. Also adds three new local image assets under
`src/assets/home/tiles/`.

### 2. Heading spacing (mobile only)

`SectionHeading` already accepts a `class` prop
(`src/components/ui/SectionHeading.astro:13`). Pass
`class="services__heading"` from `Categories.astro` and, inside
`Categories.astro`'s own scoped `<style>`, target it with `:global()` at
`≤800px` only:

- `margin-bottom`: 35px → ~20px
- gap between title and lead (`.section-heading__lead { margin-top }`): 25px
  → ~10px
- `.section-heading__lead` font-size: 13px → 15px, `line-height: 1.5`

Desktop and every other page using `SectionHeading` are unaffected, since the
override lives in `Categories.astro`'s own scoped stylesheet and only fires
inside the `≤800px` query.

### 3. Grid composition (mobile only)

Replace the current flex scroll-rail with a CSS grid, keeping the existing
`.service-grid--bento` modifier class name (still applied when
`items.length === 3`):

```css
@media (max-width: 800px) {
  .service-grid--bento {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas: 'a a' 'b c';
    gap: 10px;
    overflow: visible; /* drop the scroll-rail behaviour */
  }
  .service-card:nth-child(1) { grid-area: a; }
  .service-card:nth-child(2) { grid-area: b; }
  .service-card:nth-child(3) { grid-area: c; }
}
@media (max-width: 379px) {
  .service-grid--bento {
    grid-template-columns: 1fr;
    grid-template-areas: 'a' 'b' 'c';
  }
}
```

`scroll-snap-align`, `margin-right: -18px` and the flex-basis rules used by
the old rail are removed for this breakpoint. `.service-grid` (the non-bento
fallback for ≠3 items) keeps its current rail behaviour unchanged, since this
redesign is specifically the 3-item bento composition shown in the
reference.

### 4. Top tile — Аппаратная косметология

Structure changes from "photo background + overlaid text" to "text panel +
side photo":

```html
<a class="service-card service-card--wide reveal" href="/apparatnaya-kosmetologiya">
  <div class="service-card__body">
    <p class="service-card__tag">Лифтинг · Омоложение · Качество кожи</p>
    <h3>Аппаратная<br />косметология</h3>
    <span class="round-arrow-gold" aria-hidden="true">→</span>
  </div>
  <picture class="service-card__media">
    <source media="(max-width: 800px)" srcset="<mobile crop>" />
    <Image src={item.cover.src} ... /> <!-- existing desktop image, untouched -->
  </picture>
</a>
```

Mobile-only CSS (`≤800px`):
- `.service-card--wide`: `display: flex; flex-direction: row; height: auto;
  min-height: 190px; background: var(--sand);` (no dark scrim, no numbered
  chip — both removed for the light-card treatment).
- `.service-card__body`: `flex: 1 1 56%; padding: 20px; display: flex;
  flex-direction: column; justify-content: space-between; color: var(--ink);`
- `.service-card__body h3`: two-line title, `font: 400 clamp(28px, 8vw, 34px)
  / 1.05 var(--display); color: var(--ink);`
- `.service-card__tag`: 14px, `color: var(--ink-2)`, keeps the existing
  `·`-separated tagline text as-is (no copy change).
- `.service-card__media`: `flex: 0 0 44%;` image `object-fit: cover; width:
  100%; height: 100%;` plus a `::before` pseudo-element:
  `background: linear-gradient(90deg, var(--sand) 0%, transparent 35%);
  position: absolute; inset: 0;` for the soft photo→background blend
  described in the brief.
- `.round-arrow-gold` (new, shared with the two lower tiles — see §6).

### 5. Lower tiles — Инъекционная / Эстетическая косметология

```html
<a class="service-card service-card--tile reveal" href="/injekcionnaya-cosmetologiya">
  <picture class="service-card__media service-card__media--top">
    <source media="(max-width: 800px)" srcset="<mobile crop>" />
    <Image src={item.cover.src} ... />
  </picture>
  <div class="service-card__body">
    <h3>Инъекционная<br />косметология</h3>
    <p class="service-card__tag">Контуры · Увлажнение · Гармонизация</p>
    <span class="round-arrow-gold" aria-hidden="true">→</span>
  </div>
</a>
```

Mobile-only CSS:
- `.service-card--tile`: `display: flex; flex-direction: column; height:
  100%;` (grid row stretch already equalises the two tiles' heights).
- `.service-card__media--top`: `aspect-ratio: 4 / 3; width: 100%;` (uniform
  ratio for both lower tiles, per the brief).
- `.service-card__body`: `flex: 1; display: flex; flex-direction: column;
  padding: 14px; color: var(--ink); background: var(--tile-injection-bg)`
  (or `--tile-aesthetic-bg` for the third card — see §7).
- `h3`: `font: 400 clamp(18px, 5vw, 22px) / 1.1 var(--display);` no
  `-webkit-line-clamp`/ellipsis — titles wrap naturally, never truncate.
- `.service-card__tag`: 14-15px, `margin-bottom: 0`, sits above the arrow.
- `.round-arrow-gold`: `margin-top: auto; align-self: flex-end;` — pins the
  button to the bottom-right of the body regardless of how many lines the
  title/tagline wrap to, so both tiles' buttons align on the same baseline
  even when their two-item vs three-item taglines differ in length.

### 6. Arrow button (`.round-arrow-gold`, new, scoped to this component)

```css
.round-arrow-gold {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--gold);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 18px;
}
.service-card--tile .round-arrow-gold {
  width: 40px;
  height: 40px;
}
```

Not an inner focusable control — the whole `<a>`/`<div class="service-card">`
remains the single clickable/focusable target, matching the brief ("Вся
карточка является одной кликабельной ссылкой... Круг со стрелкой — визуальное
обозначение"). Existing sitewide `:focus-visible` styling (verify in
`base.css` during implementation) provides the focus outline on the card
link itself.

The existing `.round-arrow` (glass-chip, `↗`, hover-rotate) used by the
current dark-overlay treatment stays untouched for desktop.

### 7. Colours (component-scoped, not added to `tokens.css`)

Sampled from the reference PNG and matched to the closest existing token
where possible:

| Tile | Colour | Source |
|---|---|---|
| Top (Аппаратная) | `var(--sand)` (`#ede9df`) | existing token — near-exact match to the reference sample `#e9e4dd` |
| Инъекционная | `--tile-injection-bg: #e4dccf` (new, local) | reference sample `#dcd5cc`, warmed slightly to sit between `--sand` and `--gold-15` |
| Эстетическая | `--tile-aesthetic-bg: #dee1d6` (new, local) | reference sample `#d8dacf`, a muted sage — no existing sage token on this ivory/gold site, so declared locally rather than added to the global palette |

These two new custom properties are declared inside `Categories.astro`'s own
`<style>` block (e.g. on `.service-grid--bento`), not in `tokens.css`, since
they're a one-off pairing used only by these two tiles.

### 8. Photos

Three new static assets, cropped from the reference PNG (`1024×1536`) at
these pixel rectangles, each re-encoded as a JPEG at reasonable quality:

| File | Crop rect (x1,y1,x2,y2) | Used by |
|---|---|---|
| `src/assets/home/tiles/apparatnaya.jpg` | `520,337,992,712` (472×375) | top tile, mobile `<source>` |
| `src/assets/home/tiles/injekcionnaya.jpg` | `33,727,505,1000` (472×273) | bottom-left tile, mobile `<source>` |
| `src/assets/home/tiles/esteticheskaya.jpg` | `520,727,992,1000` (472×273) | bottom-right tile, mobile `<source>` |

Crop rectangles were verified visually during brainstorming: all three show
the face and the working hand/device clearly, no card-corner rounding
artefacts once inset by a few px, no baked-in ad text or logo.

Each `<picture>` keeps the existing `<Image>` (bound to `item.cover` from
Directus) as the non-mobile source/fallback, so desktop rendering (which
still uses the original full-bleed portrait photos) is untouched. The new
files are plain local imports via `astro:assets`, sized with `getImage()`/
`<Image>` at the widths this layout actually needs (no need for the current
`[420, 700, 1000]` desktop width set — mobile tiles are much narrower, so
e.g. `widths={[380, 472]}` is enough given the source is only 472px wide).

Alt text: reuse each category's existing `item.alt` from Directus. The
esteticheskaya category's current alt text (describing the mismatched photo)
should be reviewed/updated in Directus content as a small follow-up, since
it will now describe the wrong image on mobile only — noted under Out of
scope/Follow-ups below rather than bundled into this template change.

### 9. Hint plaque

New markup below the grid, inside the `.services` section:

```html
<div class="services__hint glass-panel">
  <p class="services__hint-title">Не знаете, что выбрать?</p>
  <button type="button" class="services__hint-cta" data-open-sheet data-context="Консультация">
    Начните с консультации <span aria-hidden="true">→</span>
  </button>
</div>
```

- Matches the existing `[data-open-sheet]` contact-sheet convention used
  everywhere else on the site (`Cta.astro`, `Hero.astro`, `Header.astro`,
  `TreatmentPage.astro`) — clicking opens the same `<dialog>` (Позвонить /
  Telegram / WhatsApp / MAX), with `data-context="Консультация"` prefilling
  the WhatsApp message, matching the pattern already used for
  category/procedure-specific CTAs.
- Styled as a single compact row (text + gold link/arrow), no decorative
  branch illustration and no secondary "ВАШИ ЦЕЛИ / ..." micro-copy column
  from the reference — both explicitly optional per the brief and dropped
  for mobile simplicity.
- No extra safe-area padding is added beneath it: there's no existing
  sitewide compensation for `MobileCtaBar`'s fixed height either (checked
  `Page.astro`/`base.css` — none exists), and section-to-section spacing
  (`--section` token) already exceeds the CTA bar's ~78px height. This
  assumption gets a visual check in the QA screenshots (§10) rather than a
  new defensive padding rule.

### 10. Testing / QA

- `npm run check` for TS/Astro diagnostics.
- `node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/directions-mobile /` at
  320/375/390/430 widths (extending the standard 375/800/1440 set with the
  narrower widths the brief calls out), committed under
  `docs/qa/directions-mobile/`.
- `node scripts/qa/a11y.mjs http://127.0.0.1:4322 /` — 0 serious/critical,
  since text colour/contrast changes (dark text on the two new light
  backgrounds, white-on-gold arrow button) need re-verification.
- Manual checks: no horizontal scroll or clipped text at 320/375/390/430px;
  all three cards still link to their existing category pages; the hint
  button opens the contact sheet; keyboard focus ring visible on all three
  cards and the hint button.

## Out of scope / follow-ups

- Desktop layout of this block (still 3 equal-column dark-overlay bento).
- Replacing `cat-esteticheskaya.jpg` for the **desktop** view — it remains
  the mismatched body/ad photo there; needs a real photo before it can be
  fixed sitewide.
- Updating the esteticheskaya category's Directus `alt` text to match the
  new mobile crop.
- Any other homepage section.
