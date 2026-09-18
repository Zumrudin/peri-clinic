# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ссылки на сгенерированные файлы

Сразу прикладывай в ответе кликабельные внешние HTTPS-ссылки на каждое готовое
изображение, референс, документ и другой сгенерированный файл. Пользователь
открывает файлы с телефона и не имеет прямого доступа к файловой системе сервера.
Встроенные превью, локальные пути `/root/...`, `file://`, `sandbox:` и адреса
`localhost` не заменяют внешнюю ссылку.

Рабочий способ (повторно проверен 2026-09-18 на референсе мобильного блока аппаратов):

1. Проверь, что готовый файл существует и не пуст. Копируй его в
   `/var/www/peri-concepts/<уникальная-папка>/`, сохраняя оригинал.
   Используй понятные имена файлов латиницей; файлы должны быть доступны nginx
   для чтения (права `644`, каталоги `755`). Для новых версий используй новое
   имя или папку: не перезаписывай другой результат и не полагайся на кеш телефона.
2. Выдавай ссылки вида
   `https://dev.zumrudin.ru/peri-concepts/<уникальная-папка>/<имя-файла>`.
   Эта папка уже раздаётся nginx; менять конфигурацию или развёртывать сайт не нужно.
3. Перед ответом скачай файл по внешней ссылке GET-запросом: проверь статус
   `200`, Content-Type, соответствующий формату файла, и совпадение скачанного
   содержимого с оригиналом по SHA-256. HEAD-запроса или наличия файла на сервере
   недостаточно. Только после успешной проверки выдавай ссылку как рабочую;
   при ошибке сообщи о ней и не утверждай, что файл доступен.
4. Оформляй ссылки в Markdown, например:
   `[Открыть визуал](https://dev.zumrudin.ru/peri-concepts/mobile-2026-09-12/01-beauty.png)`.

Публикуй только готовые файлы, предназначенные пользователю, а не весь проект
или служебные файлы. Для нескольких файлов давай отдельную ссылку на каждый.
В соседнем проекте PERI_GADZHIEVA используется другой каталог публикации
и домен; в этом проекте используй проверенный адрес `dev.zumrudin.ru` выше.
Для выдачи концепций не изменяй страницы, исходники и сборку сайта клиники.

## What this is

Replacement for the Wix site of PERI CLINIC (Moscow aesthetic-medicine clinic): **Astro static build + self-hosted Directus CMS + nginx**. All UI copy is Russian. The approved design/architecture spec is `docs/superpowers/specs/2026-09-09-peri-site-design.md` — it also defines the numbered phases 0–9 that the git history follows. Current canonical host: `www.peri-clinic.ru`; dev stand: `peri.zumrudin.ru` / CMS `peri-cms.zumrudin.ru`.

Post-launch feature work (visual refresh, pricing tiers, results-page filtering, content migrations, …) isn't phase-numbered; each gets its own `docs/superpowers/specs/<date>-<feature>-design.md` + `docs/superpowers/plans/<date>-<feature>.md` pair instead.

## Commands

```bash
nvm use                 # Node 22 (required)
npm run dev             # http://127.0.0.1:4321
npm run build           # dist/ — hits Directus; fails if it is unreachable (by design)
npm run preview         # http://127.0.0.1:4322 — serves dist/
npm run check           # astro check (TS/Astro diagnostics)
npm test                # node --test over src/**/*.test.ts (Node type-stripping, no compile step)
node --test src/lib/markup.test.ts        # a single test file
npm run fonts           # re-subset public/fonts/ (needs python3 + fonttools + brotli)

# QA (Chrome must exist; set CHROME_PATH if not in /usr/bin)
node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/<phase> / /result /kontakty
node scripts/qa/a11y.mjs        http://127.0.0.1:4322 / /result /kontakty   # non-zero on serious/critical
node scripts/qa/check-links.mjs                                            # internal links in dist/
```

Builds need `DIRECTUS_URL` and `DIRECTUS_TOKEN` in a root `.env` (not committed; `deploy/site.env.example` is the model — note `.env.example` referenced in error messages does not actually exist in the repo).

## Remotes & deploy

- `origin` = GitHub `Zumrudin/peri-clinic` (SSH). Its push URL list also includes the production bare repo
  `ssh://root@217.114.0.254/srv/peri/site.git`, so `git push origin main` updates both; `prod` is the same bare
  repo as a standalone remote. Production does **not** pull from GitHub (its SSH key is a deploy key of another
  repo) — after a push, `ssh root@217.114.0.254 'git -C /srv/peri/site pull --ff-only'` and trigger a rebuild
  (button «Опубликовать сайт» in `https://admin-cms.peri-clinic.ru`, or POST to the rebuild receiver).
- Production runbook, audit and execution journal: `docs/superpowers/plans/2026-09-16-phase-8-production-deploy.md`.
  Preview of the production release while `peri-clinic.ru` is still on Wix: `https://prod.peri-clinic.zumrudin.ru`.

## Content pipeline (the core idea)

Directus is the only content source; **nothing user-facing is hardcoded**. Build time only — no runtime CMS calls, so the site keeps working if Directus is down.

```
Directus REST ──► src/lib/directus.ts (plain fetch, no SDK)
              ──► src/content.config.ts  (custom Content Layer loaders + zod schemas)
              ──► src/lib/*Content.ts    (reshape entries into template-friendly objects)
              ──► components / templates / pages
```

- `src/lib/{home,site,category,procedure,page}Content.ts` are the only things templates should call; they hide `getEntry`/`getCollection` and Directus field names.
- `src/pages/[slug].astro` renders every CMS-driven page kind by slug, dispatching to `src/templates/*`: category → `CategoryPage`; procedure → `ProcedurePage`, or `DevicePage` when the procedure's category slug is `apparatnaya-kosmetologiya`; page → `ContentPage`, or `LegalPage`/`LoyaltyPage` per the `pages` collection's `template` field (`legal`/`loyalty`; `info` and `spravka` both fall through to `ContentPage`). Slugs are the original Wix slugs — SEO depends on keeping them.
- `src/config/nav.ts` is deliberately *not* in the CMS (site map is IA, not editor content).

### Non-obvious rules (each cost a debugging session; see comments in the files)

- **Custom loaders must call `parseData()`** — otherwise the zod schema is types-only and never runs, so `.catch([])`/`.default()` fallbacks silently do not apply (Directus returns `null`, not `[]`, for empty repeaters).
- **`getCollection()` discards loader order** — Astro re-sorts by entry id. Always wrap with `bySort()` from `src/lib/directus.ts` where display order matters.
- **Directus assets need auth**: `directusImage()` (`src/lib/media.ts`) appends `?access_token=` because Astro's remote-image fetcher cannot send the Authorization header. Safe: only fetched at build time; the Directus host must be listed in `astro.config.mjs` `image.remotePatterns`.
- Directus nested file fields must be spelled out per subfield (`hero_image.id,hero_image.width,...`) — hence the `fileFields()` helper.

## Design system

`src/styles/tokens.css` (colours, glass/glow, type scale, spacing, radii) + `src/styles/base.css` (fonts, reset, buttons, `.prose`, `.rail`, `.reveal`, `.glass-panel`, `.glow`). Ivory/gold, Cormorant Garamond display + Golos Text body, self-hosted subset woff2.

- Global utilities are composed onto elements (`class="hero__note glass-panel"`). **Never redeclare a global utility inside a component's scoped `<style>`** — Astro's scoping breaks it.
- Component styles live in the component's own scoped `<style>`; behaviour lives in `src/scripts/*.ts`, imported from an inline `<script>` in the owning component (`Header.astro`) or in `Base.astro` for site-wide ones.
- Editors write `_слово_` for gold italic and real newlines for manual wrapping → render with `set:html={em(...)}` from `src/lib/markup.ts` (escapes HTML first).
- Accessibility baseline from phase 7: min 11px text, gold text uses `--gold-deep`, everything motion-related respects `prefers-reduced-motion`, axe must report 0 serious/critical.

## Booking, analytics, legal

There is **no booking form**. Any `[data-open-sheet]` element opens the `<dialog>` contact sheet (Позвонить / Telegram / WhatsApp / MAX); `data-context` prefills the WhatsApp message with the procedure name. Clicks dispatch `peri:contact` with a goal name; `Metrika.astro` listens and calls `ym(..., 'reachGoal', ...)`, and only loads Yandex Metrika after consent (`peri:consent` event / `localStorage.peri_consent`) when `metrika_requires_consent` is on. Legal blocks (licence, ОГРН/ИНН, contraindication disclaimer, Instagram/Meta note, non-offer text) all come from `site_settings`.

## CMS schema & deployment

- **Schema as code**: `directus/setup/collections.mjs` declares every collection/field (Russian labels); `schema.mjs`, `roles.mjs`, `flows.mjs` apply it idempotently over REST. Re-run them after `directus bootstrap`; see `directus/roles.md` (also documents the Postgres-on-Beget setup, the SSH tunnel, and the restore drill).
- **Publish loop**: editor saves → Directus Flow POSTs `http://127.0.0.1:8787/rebuild` → `deploy/rebuild/server.mjs` (debounced, queued, writes `build_log`) → `deploy/rebuild/build.sh` (`npm ci` → `astro build` → `precompress.mjs` → `mv dist releases/<ts>` → atomic symlink swap, keep 5). pm2 runs `peri-directus` + `peri-rebuild` (`deploy/pm2/ecosystem.config.cjs`).
- Directus's default `IMPORT_IP_DENY_LIST` blocks Flow requests to `127.0.0.1`; the deployed `.env` must override it (see `deploy/directus.env.example`).
- nginx: `deploy/nginx/stand.conf`. This box runs sslh, so TLS listens on `127.0.0.1:4443`, not `:443`. 301s for stale Wix URLs live in `deploy/nginx/redirects.map` (installed as `/etc/nginx/peri-redirects.map`).
- Astro builds with `format: 'file'` + `trailingSlash: 'never'`, so nginx needs `try_files $uri $uri.html $uri/`.

## Wix migration (`scripts/migrate/`)

`01-sitemap` → `manifest.json` + `docs/CONTENT-MAP.md`; `02-scrape` → `raw/*.html`; `03-extract` → `out/*.json` (Directus field names); `04-download` → `media/` + index; `05-seed` → idempotent upsert into Directus as `draft`. `raw/`, `media/`, `out/`, `manifest.json` are gitignored artefacts. Wix renders every heading as `<h1>` and hides long-form sections in a separate collapsible widget, so extraction classifies by known Russian heading phrases walked in document order (`scripts/migrate/lib.mjs`). `docs/CONTENT-MAP.md` is the authority on which old URLs are real pages vs. redirects — several near-duplicate slugs (`/microtoki` vs `/mikrotokovaya-terapiya`, `/uridicheskaya-informaciya` vs `/yuridicheskaya-informaciya`) are genuinely distinct pages.

Later one-off content migrations (legal pages, loyalty program, device pages, …) continue the same numbering outside the core 01-05 pipeline (`06-legal.mjs`, `07-devices.mjs`, …). Each ships its own committed JSON snapshot (e.g. `legal-content.json`) as the one-time apply input — the site always reads from Directus at build time, never from these snapshots — and backs up any record it overwrites to a gitignored `scripts/migrate/out/*-backups/` directory before writing.

## Conventions

- Comments explain *why* (usually a platform quirk found by debugging), not *what*. Keep that bar; the existing header comments in `src/lib/`, `src/content.config.ts` and `deploy/` are the reference style.
- Commit messages: `feat|fix|docs|chore: …`; phase-scoped for the original build-out (`feat: phase 5 — page templates, SEO, …`), descriptively-scoped for post-launch feature work (`feat: migrate legal pages from Wix, keep original slugs`).
- QA screenshots are committed at widths 375/800/1440, under `docs/qa/phase-N/` for phase work or `docs/qa/<feature>/` for post-launch feature work.
