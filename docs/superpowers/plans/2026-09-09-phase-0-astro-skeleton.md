# Phase 0 — Astro skeleton + homepage port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static homepage draft into an Astro project with self-hosted fonts, local images, design tokens, reusable components fed by a JSON fixture, and a messenger contact sheet instead of the fake form — with zero references to Wix.

**Architecture:** Astro 7 static output, no UI framework. Global CSS in `src/styles/` (tokens + base), scoped `<style>` per component. Content for the homepage comes from `src/data/home.json` + `src/data/site.json` (the shape mirrors the future Directus `home` and `site_settings` singletons so Phase 3 only swaps the loader). Client behaviour is small TypeScript modules in `src/scripts/` imported from component `<script>` tags.

**Tech Stack:** Node 22 (nvm), Astro 7.3, `astro:assets` + sharp (AVIF/WebP), fontTools `pyftsubset` (font subsets), Playwright Chromium (already in `~/.cache/ms-playwright`) for screenshots, Lighthouse via `npx lighthouse` with `/usr/bin/google-chrome`.

Spec: `docs/superpowers/specs/2026-09-09-peri-site-design.md`.

---

## File map

| File | Responsibility |
|---|---|
| `package.json`, `astro.config.mjs`, `tsconfig.json` | project config; `site: https://www.peri-clinic.ru`, `build.format: 'file'`, `trailingSlash: 'never'` |
| `scripts/fonts/subset.sh` | downloads variable TTFs from google/fonts and writes cyrillic+latin woff2 subsets to `public/fonts/` |
| `public/fonts/*.woff2` | 3 files: cormorant-garamond, cormorant-garamond-italic, golos-text (variable) |
| `public/favicon.svg`, `public/robots.txt` | static |
| `src/assets/home/*` | original images (from `/tmp/peri-img`, renamed), `logo.png` |
| `src/styles/tokens.css` | CSS custom properties: colours, fonts, type scale, spacing, radii, z-index |
| `src/styles/base.css` | reset, `@font-face`, typography, `.eyebrow`, `.button`, `.text-link`, `.reveal`, reduced-motion |
| `src/data/site.json` | contacts, messenger links, socials, legal texts (future `site_settings`) |
| `src/data/home.json` | hero, ticker, categories, approach, devices, cases, reviews, cta (future `home` + collections) |
| `src/lib/markup.ts` (+ `markup.test.ts`) | `em()` — `_слово_` → `<em>`, `\n` → `<br>`; `telHref()`, `whatsappHref()`, `formatPhone()` |
| `src/layouts/Base.astro` | `<html lang="ru">`, meta, fonts preload, global CSS, `<slot/>`, ContactSheet, scripts |
| `src/layouts/Page.astro` | Base + Header + Footer + FloatingContact |
| `src/components/shell/Header.astro` | logo, nav, phone, «Записаться» (opens sheet), burger; imports `header.ts`, `menu.ts` |
| `src/components/shell/Footer.astro` | 3-col top + 4-col grid + legal line, Instagram disclaimer |
| `src/components/shell/ContactSheet.astro` | `<dialog>` with call / Telegram / WhatsApp / MAX rows; bottom sheet on mobile |
| `src/components/shell/FloatingContact.astro` | gold circle → opens sheet |
| `src/components/ui/SectionHeading.astro` | eyebrow + h2 (+ optional side paragraph) |
| `src/components/home/Hero.astro`, `Ticker.astro`, `Categories.astro`, `Approach.astro`, `Devices.astro`, `Cases.astro`, `Reviews.astro`, `Cta.astro` | one section each; markup ported from draft; images via `astro:assets` |
| `src/scripts/header.ts`, `menu.ts`, `reveal.ts`, `rail.ts`, `contact-sheet.ts` | behaviours from `main.js` split by concern; sheet replaces the form |
| `src/pages/index.astro` | composes sections from fixture |
| `docs/DEPLOY.md` | how to build locally (added later phases extend it) |

Fixture shape (`src/data/home.json`) — keys are the future Directus field names:

```json
{
  "hero": { "eyebrow": "…", "title": "Красота,\n_основанная_\nна медицине", "lead": "…", "image": "hero.jpg", "image_alt": "…",
            "note": "Эстетика, которая\nостаётся _вашей_", "facts": [{"value":"3","label":"направления\nкосметологии"}, …] },
  "ticker": ["Здоровье кожи", …],
  "categories": { "eyebrow": "…", "title": "…", "lead": "…", "items": [{"slug":"apparatnaya-kosmetologiya","title":"Аппаратная\nкосметология","tagline":"Лифтинг · Омоложение · Качество кожи","cover":"cat-apparatnaya.jpg"}, …] },
  "approach": { "eyebrow": "…", "title": "…", "lead": "…", "image": "approach.jpg", "badge": "PERI\nCARE", "principles": [{"title":"…","text":"…"}, …], "link_label": "…" },
  "devices": { "eyebrow": "…", "title": "…", "lead": "…", "items": [{"name":"Morpheus 8","short":"Игольчатый RF-лифтинг","image":"device-morpheus8.png"}, …] },
  "cases": { "eyebrow": "…", "title": "…", "lead": "…", "items": [{"category":"Аппаратная косметология","title":"Volnewmer","result":"…","image":"case-volnewmer.jpg"}, …] },
  "reviews": { "eyebrow": "…", "title": "…", "rating": "5.0", "items": [{"author":"Анна","date":"12.08.2026","text":"…","procedure_label":"Контурная пластика"}, …] },
  "cta": { "eyebrow": "…", "title": "…", "lead": "…", "image": "cta.jpg" }
}
```

Image name map (from `/tmp/peri-img`):

| Wix id | New name |
|---|---|
| `0d054c_32a9…png` | `logo.png` |
| `aab7ce_e6b8…jpg` | `hero.jpg` |
| `aab7ce_2c81…jpg` | `cat-apparatnaya.jpg` (also used as `cta.jpg`) |
| `aab7ce_58e0…jpg` | `cat-injekcionnaya.jpg` |
| `aab7ce_4ca7…jpg` | `cat-esteticheskaya.jpg` |
| `aab7ce_5f5e…jpg` | `approach.jpg` |
| `aab7ce_08d9…png` / `bf29…png` / `9058…png` / `08d8…png` | `device-morpheus8.png` / `device-ultraformer.png` / `device-volnewmer.png` / `device-inmode.png` |
| `aab7ce_6200…jpg` / `c06b…jpg` / `a8c5…jpg` | `case-volnewmer.jpg` / `case-konturnaya.jpg` / `case-guby.jpg` |

Design corrections applied while porting (from spec): gold text under 18 px uses `--gold-deep`; no text under 11 px; the form is replaced by the contact sheet; all links that were `#` now go to real targets from `site.json` or are marked `data-todo` (none left at the end of the phase).

---

### Task 1: Project scaffold

**Files:** `package.json` (replace), `astro.config.mjs`, `tsconfig.json`, `.nvmrc`, `src/env.d.ts`

- [ ] Write `.nvmrc` = `22`. Replace `package.json`:

```json
{
  "name": "peri-clinic-site",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev --host 127.0.0.1 --port 4321",
    "build": "astro build",
    "preview": "astro preview --host 127.0.0.1 --port 4322",
    "check": "astro check",
    "test": "node --test src/**/*.test.ts",
    "fonts": "bash scripts/fonts/subset.sh"
  }
}
```

- [ ] `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://www.peri-clinic.ru',
  trailingSlash: 'never',
  build: { format: 'file' },
  image: { cacheDir: process.env.ASTRO_CACHE_DIR || './node_modules/.astro' },
});
```

- [ ] `tsconfig.json`: `{ "extends": "astro/tsconfigs/strict", "compilerOptions": { "allowImportingTsExtensions": true, "noEmit": true } }`
- [ ] `npm i astro@7 sharp@0.35` and `npm i -D @types/node`. Run `npx astro --version` → `astro 7.3.x`.
- [ ] Commit `chore: astro scaffold`.

### Task 2: Fonts

**Files:** `scripts/fonts/subset.sh`, `public/fonts/*.woff2`

- [ ] Script downloads `CormorantGaramond[wght].ttf`, `CormorantGaramond-Italic[wght].ttf`, `GolosText[wght].ttf` from `https://github.com/google/fonts/raw/main/ofl/...` into `/tmp/fonts/` (skips if present), then:

```bash
pyftsubset "$src" --output-file="public/fonts/$out.woff2" --flavor=woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+20BD,U+2122,U+2191,U+2193,U+2197,U+2212,U+2215,U+2605-2606,U+2726,U+FEFF,U+FFFD,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" \
  --layout-features='*' --no-hinting --desubroutinize
```

- [ ] Run `npm run fonts`; expect 3 files, each < 120 KB. Commit `feat: self-hosted Cormorant Garamond + Golos Text subsets`.

### Task 3: Tokens + base CSS

**Files:** `src/styles/tokens.css`, `src/styles/base.css`

- [ ] tokens: colours from spec (`--ivory --paper --white --ink --ink-2 --muted --gold --gold-light --gold-deep --dark --sand --line`), fonts (`--display: "Cormorant Garamond", Georgia, serif; --sans: "Golos Text", Arial, sans-serif`), type scale (`--t-h1 --t-h2 --t-h3 --t-lead --t-body --t-small --t-eyebrow`), spacing (`--s-1..--s-10`, `--section`, `--gutter`), `--radius: 2px`, `--container: 1500px`, `--container-wide: 1600px`, z-index (`--z-header:30 --z-sheet:40 --z-toast:50`).
- [ ] base: `@font-face` ×3 (`font-weight: 300 700` / `400 900`, `font-display: swap`), reset from draft lines 5–14, headings, `.eyebrow` (colour `--gold-deep`, 11 px), `.button`, `.button--small`, `.button--outline`, `.text-link`, `.reveal`, `.container`, reduced-motion block.
- [ ] Commit `feat: design tokens and base styles`.

### Task 4: markup helpers (TDD)

**Files:** `src/lib/markup.ts`, `src/lib/markup.test.ts`

- [ ] Test: `em('Красота,\n_основанная_\nна медицине')` → `'Красота,<br><em>основанная</em><br>на медицине'`; `em('a & b')` escapes `&`; `telHref('+7 925 017-77-78')` → `'tel:+79250177778'`; `whatsappHref('+7 925 017-77-78', 'Здравствуйте! Хочу записаться на Volnewmer')` → `'https://wa.me/79250177778?text=...'` URL-encoded.
- [ ] Run `npm test` → fails (module not found). Implement. Run → 4 pass. Commit `feat: markup helpers`.

### Task 5: Fixtures + assets

**Files:** `src/data/site.json`, `src/data/home.json`, `src/assets/home/*`

- [ ] Copy/rename images per table above. `site.json`:

```json
{
  "name": "PERI CLINIC",
  "tagline": "Естественная красота.\nВрачебная точность.",
  "phone": "+7 925 017-77-78",
  "email": "Peri.Clinic@mail.ru",
  "address_short": "Москва, ул. Генерала Белова, 28, корпус 3",
  "address_lines": ["Москва", "ул. Генерала Белова,\n28, корпус 3"],
  "hours": "Ежедневно, 10:00–22:00",
  "telegram_url": "https://t.me/peri_clinic",
  "whatsapp_text": "Здравствуйте! Хочу записаться в PERI CLINIC",
  "max_url": "",
  "vk_url": "https://vk.com/periclinic",
  "instagram_url": "https://instagram.com/peri_clinic",
  "shop_url": "https://periclinic-shop.ru",
  "privacy_url": "/politika",
  "non_offer_text": "Информация на сайте носит информационный характер и не является публичной офертой.",
  "instagram_disclaimer": "*Принадлежит Meta, признанной экстремистской организацией в РФ.",
  "contraindications_text": "Имеются противопоказания. Необходима консультация специалиста."
}
```

- [ ] `home.json` with all draft copy (see shape above). Commit `feat: homepage fixture and local assets`.

### Task 6: Layouts + shell

**Files:** `src/layouts/Base.astro`, `src/layouts/Page.astro`, `src/components/shell/{Header,Footer,ContactSheet,FloatingContact}.astro`, `src/scripts/{header,menu,contact-sheet}.ts`

- [ ] Base: props `title`, `description`; `<link rel="preload" as="font">` for the 3 woff2; `<meta name="theme-color" content="#f6f4ef">`; imports both CSS files; renders `<ContactSheet/>` after slot.
- [ ] Header ports draft lines 15–33; «Записаться» becomes `<button type="button" data-open-sheet>`; nav links target future pages (`/uslugi-i-ceny`, `/#approach`, `/result`, `/otzyvy`, `/kontakty`).
- [ ] ContactSheet: `<dialog id="contact-sheet">`, heading «Записаться на приём», rows rendered only when link non-empty: Позвонить (`telHref`), Telegram, WhatsApp (`whatsappHref` with `data-context` appended), MAX. Close button, backdrop click closes, `Esc` native. Mobile ≤800 px: bottom sheet (translateY animation); desktop: 420 px centred.
- [ ] `contact-sheet.ts`: delegates click on `[data-open-sheet]`, reads `data-context` to replace WhatsApp text, `showModal()`, close on backdrop.
- [ ] `header.ts` (sticky after 120 px), `menu.ts` (burger, body lock, close on resize > 800 and on link click) — from `main.js` lines 1–28, 65–67.
- [ ] Footer ports draft lines 239–252 with real links from `site.json`; Instagram row shows `*` and disclaimer in bottom line.
- [ ] Commit `feat: layouts, header, footer, contact sheet`.

### Task 7: Home sections

**Files:** `src/components/ui/SectionHeading.astro`, `src/components/home/*.astro`, `src/scripts/{reveal,rail}.ts`, `src/pages/index.astro`

- [ ] Hero: `<Picture>` from `astro:assets` (`widths=[480,840,1200]`, `formats=['avif','webp']`, `loading="eager"`, `fetchpriority="high"`), title via `set:html={em(hero.title)}`, facts loop (label ≥ 11 px).
- [ ] Ticker: CSS marquee, items duplicated for seamless loop.
- [ ] Categories: 3 cards linking to `/${slug}`; `<Image>` widths 700.
- [ ] Approach: image + badge + principles loop; link → `/#contacts` replaced by `/kontakty`.
- [ ] Devices: rail with prev/next; `rail.ts` = `main.js` lines 45–53 generalised to `[data-rail]` + `[data-rail-prev]`/`[data-rail-next]`.
- [ ] Cases: large + 2 cards; button «Все результаты» → `/result`.
- [ ] Reviews: dark band, cards loop, author initial.
- [ ] Cta: image + text + `<button data-open-sheet>` + row of small messenger links; replaces booking form.
- [ ] `reveal.ts` = `main.js` lines 30–43. Every section root has `class="reveal"` where the draft had it.
- [ ] `index.astro` composes sections; `Page` layout.
- [ ] Delete `index.html`, `src/styles.css`, `src/main.js`, `assets/.gitkeep`; update `README.md` (run/build/fonts).
- [ ] Commit `feat: homepage ported to Astro components`.

### Task 8: Verify

- [ ] `npm run build` → 0 errors; `grep -ri wixstatic dist | wc -l` → `0`; `grep -rc 'href="#"' dist/index.html` → `0`.
- [ ] `npm run preview` in background; Playwright script `scripts/qa/screenshots.mjs` captures `/` at 375, 800, 1440 to `docs/qa/phase-0/`. Look at them.
- [ ] `npx lighthouse http://127.0.0.1:4322/ --chrome-flags="--headless --no-sandbox" --preset=perf --form-factor=mobile --output=json --output-path=/tmp/lh.json` → performance ≥ 0.9, accessibility ≥ 0.95.
- [ ] Commit `chore: phase 0 QA screenshots`.
