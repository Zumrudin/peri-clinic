# PERI CLINIC — новый сайт вместо Wix

## Контекст

Сайт клиники эстетической медицины peri-clinic.ru живёт на Wix: ограниченный дизайн, зависимость от иностранной платформы, нет полного контроля. Нужно пересобрать сайт целиком с улучшенным дизайном и разместить на российских серверах.

В репозитории `/root/peri-clinnic.ru` уже есть черновик главной (`index.html` + `src/styles.css` + `src/main.js`): айвори/золото, серифные заголовки, ванильный JS. Картинки и шрифты пока хотлинкуются с `static.wixstatic.com`, форма ничего не отправляет, коммитов нет. Ранее на этой машине показывались три концепта (`/var/www/peri-concepts/variant-{a,b,c}`), черновик — их развитие.

**Решения, принятые с заказчиком:**
- Объём: весь сайт (все ~37 URL из sitemap Wix). Магазин остаётся на periclinic-shop.ru, только ссылка.
- Нужна простая админка для сотрудников (тексты, фото до/после, отзывы, аппараты, контакты).
- Запись: **без формы** — кнопка «Записаться» открывает лист с «Позвонить / Telegram / WhatsApp / MAX».
- Дизайн: развиваем направление черновика (тёплый айвори, золото, крупный сериф, воздух, большие фото).
- Продакшен-сервер в РФ заказываем позже; сначала собираем сайт и показываем на стенде **peri.zumrudin.ru** на этой машине.
- Канонический хост остаётся **www.peri-clinic.ru** (apex → 301).

## Архитектура

**Astro (статика) + self-hosted Directus (SQLite) + nginx.** Контент забирается из Directus на этапе сборки; при изменении в админке Directus Flow дёргает локальный webhook, который пересобирает сайт и атомарно подменяет каталог. Сайт — плоские файлы: если CMS лежит, сайт работает. Directus ставим **нативно через npm** (не Docker) и запускаем под pm2 — это снимает проблему с Docker Hub из РФ и совпадает с тем, как устроен дев-стенд.

Отвергнуто: WordPress (обслуживание, безопасность, производительность), git-based CMS (Decap/Sveltia + Gitea — неудобно для галерей до/после), Astro SSR (лишний рантайм).

Стек и версии: Node 22 (через nvm, сейчас стоит 20), Astro последней стабильной, `@directus/sdk`, `sharp`, Directus последней стабильной (BSL — бесплатно для клиники). Шрифты self-hosted woff2: **Cormorant Garamond** (display) + **Golos Text** (текст), кириллица+латиница, сабсет через `pyftsubset`.

### Структура репозитория

```
peri-clinnic.ru/
├── astro.config.mjs, package.json, .env.example
├── public/            fonts/, robots.txt, favicon.svg, icons/, og-default.jpg
├── src/
│   ├── content.config.ts        # Content Layer, loader'ы из Directus, zod-валидация
│   ├── lib/  directus.ts  media.ts  markup.ts (_курсив_ → <em>, tel/wa/tg-ссылки)  seo.ts
│   ├── styles/  tokens.css  base.css
│   ├── layouts/  Base.astro  Page.astro  Prose.astro
│   ├── templates/  CategoryPage  ProcedurePage  ContentPage
│   ├── components/  shell/ ui/ home/ services/ results/ reviews/ faq/ contacts/ seo/
│   ├── scripts/  header.ts menu.ts reveal.ts rail.ts contact-sheet.ts compare-slider.ts cookie-consent.ts
│   └── pages/  index  uslugi-i-ceny  result  otzyvy  kontakty  [slug]  404  sitemap.xml.ts
├── scripts/migrate/   01-sitemap 02-scrape 03-extract 04-download 05-seed  (+ manifest.json)
├── scripts/fonts/subset.sh      scripts/postbuild/precompress.mjs
├── directus/          snapshot.yaml (схема)  flows/  roles.md
├── deploy/            setup.sh  nginx/{www.conf,cms.conf,stand.conf,redirects.map}  rebuild/{server.mjs,build.sh}  pm2/ecosystem.config.cjs  backup.sh
└── docs/              superpowers/specs/2026-09-09-peri-site-design.md  ADMIN.md (RU)  DEPLOY.md  CONTENT-MAP.md
```

Черновик `index.html`/`styles.css`/`main.js` разбирается на компоненты и удаляется из корня после фазы 0.

### Страницы и слаги (SEO: сохраняем Wix-слаги)

| URL | Шаблон |
|---|---|
| `/` | index |
| `/uslugi-i-ceny` | 3 категории + все процедуры + общий FAQ (цены скрыты флагом `show_prices`) |
| `/apparatnaya-kosmetologiya`, `/injekcionnaya-cosmetologiya`, `/esteticheskaya-kosmetologiya` | CategoryPage |
| Аппаратные: `/pigment-lumec`, `/rf-lifting-inmode`, `/volnewmer`, `/tesla-former`, `/pladuo`, `/beautylizer`, `/laser-epilation`, `/profeccial`, `/heleo`, `/mikrotokovaya-terapiya` | ProcedurePage |
| Инъекционные: `/mezoterapiya-i-biorevitalizaciya`, `/konturnaya-plastika`, `/botullinoterapiya`, `/plazmoterapiya-plazmolifting`, `/lipolitiki`, `/kapelnicy` | ProcedurePage |
| Эстетические: `/maski`, `/uhodovye-procedury`, `/kosemotologicheskie-pilingi` | ProcedurePage |
| `/result`, `/otzyvy`, `/kontakty` | отдельные страницы |
| `/spravka`, `/loyaltyprogram`, `/politika`, `/polzovatelskoe-soglashenie`, `/soglashenie`, `/yuridicheskaya-informaciya`, `/uridicheskaya-informaciya`, `/normativno-parvovye-dokumenty`, `/kontakty-organov`, `/poryadok-oplaty` | ContentPage |

Точный список слагов фиксируется скриптом `01-sitemap.mjs` из `pages-sitemap.xml` Wix в `docs/CONTENT-MAP.md`. 301-карта: `/microtoki → /mikrotokovaya-terapiya`, `/копия-*` → оригиналы, `/product-page/*`, `/shop*`, `/category/*` → periclinic-shop.ru, trailing slash → без слеша, apex → www.

`/spravka`: на Wix туда встроена iframe-форма заявки на справку с `dev.zumrudin.ru/cert-request/` (бэкенд LoyalPro на этой машине). Оставляем встраивание, URL формы — поле в настройках сайта.

### Модель данных Directus

Все коллекции: `status` (draft/published/archived), `sort`, `date_updated`. Подписи полей на русском, папки файлов: Главная / Процедуры / Аппараты / До-после / Документы / Лого.

- **site_settings** (singleton): телефон (e164 + отображение), email, адрес, часы, `telegram_url`, `whatsapp_url`, `max_url`, vk, instagram, shop_url, `spravka_form_url`, `map_embed_src`, `metrika_id`, юрлицо, ОГРН, ИНН, КПП, юр. адрес, лицензия (номер/дата/орган/PDF), тексты дисклеймеров, `show_prices`, OG-картинка по умолчанию, текст автоподстановки для WhatsApp.
- **home** (singleton): hero (eyebrow, заголовок с `_курсивом_`, лид, фото, 3 факта), ticker, блок «Философия», принципы, SEO.
- **service_categories**: slug, title, tagline, description, cover, SEO.
- **procedures**: slug, title, subtitle, category (M2O), cover, gallery, summary, body, steps (repeater), benefits, indications, contraindications, duration, rehab, effect_duration, device (M2O), faq (O2M), cases (O2M), price_items (O2M), show_on_home, SEO, legacy_wix_url.
- **price_items**: procedure, name, price, unit, note.
- **devices**: name, short, manufacturer, description, image (PNG), procedure, show_on_home.
- **case_categories** (8 групп с Wix) и **before_after_cases**: category, procedure, before (file), after (file), result_points, show_on_home, `needs_review`.
- **reviews**: author, date, rating, text, procedure_label, source (site/yandex/2gis/prodoctorov), source_url, show_on_home.
- **faq_items**: question, answer, scope, procedure.
- **pages**: slug, title, body, template (legal/info/loyalty/spravka), attachments, noindex, SEO.
- **build_log**: started_at, finished_at, status, message — пишет rebuild-сервис, редакторы видят read-only.

Роли: Administrator; **Редактор** (CRUD контента и файлов, без схемы/настроек, 2FA); **Builder** (статический токен только на чтение + запись build_log). Flows: автопересборка на `items.*` контентных коллекций + ручная кнопка «Опубликовать сайт». Всё экспортируется в `directus/snapshot.yaml` и `directus/flows/`.

### Пайплайн публикации (одинаков для стенда и продакшена)

```
/srv/peri/
  site/            рабочая копия репозитория (git pull или push в bare-репо)
  releases/<ts>    собранный dist
  current -> …     симлинк, root для nginx
  cache/astro/     постоянный кэш картинок (пересборка ~1 мин вместо ~10)
  directus/        .env, database/data.db, uploads/, extensions/
  rebuild/         server.mjs (Node, без зависимостей, порт 8787, токен, debounce 20 с, очередь), build.sh
  backups/
```

`build.sh`: `npm ci` → `astro build` → `precompress.mjs` (.br/.gz) → `mv dist releases/<ts>` → атомарная смена симлинка → хранить 5 релизов. pm2: процессы `peri-directus` (порт 8055) и `peri-rebuild`. Бэкап: ежедневно `.backup` SQLite + tar uploads, хранить 14; на проде — ещё в S3 российского провайдера.

**nginx на стенде** (паттерн этой машины: порт 80 с ACME через `/var/www/certbot`, TLS на `listen 127.0.0.1:4443 ssl http2` за sslh): `deploy/nginx/stand.conf` с двумя server-блоками — `peri.zumrudin.ru` (root `/srv/peri/current`, `try_files $uri $uri.html =404`, immutable-кэш для `/_astro/`, fonts, images; `/uploads/` → alias на uploads Directus) и `peri-cms.zumrudin.ru` (proxy на 127.0.0.1:8055, `client_max_body_size 64m`, robots Disallow, limit_req на `/auth/login`). Сертификаты через `certbot certonly --webroot -w /var/www/certbot`. **Нужна DNS A-запись** `peri` и `peri-cms` → 89.125.92.223.

**Продакшен (позже)**: `deploy/setup.sh` для Ubuntu 24.04 на российском VPS (Timeweb Cloud / Selectel, 2 vCPU / 4 ГБ): ufw, nginx + brotli, certbot, Node 22, pm2, Directus, перенос `data.db` + `uploads/`, `www.conf` + `cms.conf` (`cms.peri-clinic.ru`), HSTS, CSP (self + mc.yandex.ru + карты Яндекса).

### Дизайн-система

- **Токены**: сохраняем `--ivory #f6f4ef`, `--paper`, `--ink #24241f`, `--muted`, `--gold #aa892f`, `--gold-light`; добавляем `--gold-deep #8c6f22` для золотого текста < 18px (контраст AA), `--dark #292923`, `--sand #ede9df`. Радиус 2px, линии 1px.
- **Типографика**: display `clamp(56px, 8vw, 104px)`, h2 `clamp(40px, 4.6vw, 72px)`, h3 `clamp(22px, 2.4vw, 37px)`, body 15/16px, eyebrow 11px uppercase .18em. **Минимум 11px** (в черновике есть 7–9px — поднять).
- **Компоненты**: Header (sticky 86→72px, «Услуги» с подсписком категорий), MobileMenu (полноэкранное), **ContactSheet** (`<dialog>`, 4 строки: Позвонить / Telegram / WhatsApp / MAX; на мобильном — bottom-sheet; WhatsApp с автоподстановкой названия процедуры; цели Метрики `contact_call|tg|wa|max`), **MobileCtaBar** (фиксированная нижняя панель ≤800px), Hero (сетка черновика, LCP-фото с `fetchpriority=high`), Ticker (CSS-only), CategoryCard/Grid, ProcedureCard/Grid, ProcedureHero (3 факта: длительность / реабилитация / эффект), Steps, Indications/Contraindications, DeviceRail/DeviceCard, **CompareSlider** (`<peri-compare>`, range-input, клавиатура, деградация в две картинки), CaseGallery + Lightbox, ReviewCard/List (тёмная полоса), Faq (`details/summary` + FAQPage JSON-LD), LegalBlock, Disclaimer («Имеются противопоказания…»), CookieNotice (Метрика только после согласия), MapEmbed (Яндекс-карта по клику), Footer (4 колонки).
- **Движение**: reveal (opacity + 24px, 0.8s, один раз), hover фото ≤1.045, без библиотек, всё отключается при `prefers-reduced-motion`.
- **Мобильные**: брейкпоинты 1100/800/480; сетки → scroll-snap-ленты 84–86vw; тапы ≥44px; `sizes` у всех `<Picture>`; никаких hover-only.
- **Юр. слой**: политика 152-ФЗ + cookie-уведомление, блок лицензии/ОГРН/ИНН, дисклеймер противопоказаний, «не оферта», пометка про Instagram/Meta у каждой ссылки.

### Миграция контента с Wix

`scripts/migrate/` запускаются с этой машины: 01 — sitemap → `manifest.json`; 02 — SSR-HTML каждой страницы в `raw/`; 03 — cheerio: `[data-testid="richTextElement"]` → структурированные поля (H2 «Как проходит процедура» → steps, «Показания» / «Противопоказания», «Важно знать» → FAQ), картинки → оригиналы `static.wixstatic.com/media/<uri>` без `/v1/` трансформаций; `/result` — пары до/после по порядку с `needs_review=true`; отзывы с главной; 04 — скачивание в `media/` с индексом; 05 — идемпотентный сид через REST Directus (upsert по slug / legacy_wix_url), всё в `draft`, кроме категорий и страниц. Юр. данные со страницы «Организационные документы» Wix (ООО «Клиника эстетической медицины «Пери Клиник», ОГРН 1217700499675, ИНН 9724060392, лицензия Л041-01137-77/00001187 от 03.03.2022) — в `site_settings`, заказчик подтверждает.

## Фазы (каждая — самостоятельный результат)

| # | Фаза | Готово, когда | Проверка |
|---|---|---|---|
| 0 | **Спека + git + скелет Astro**: сохранить этот дизайн в `docs/superpowers/specs/`, первый коммит, Node 22, Astro-проект, токены, сабсет шрифтов, портировать черновик главной в компоненты на JSON-фикстуре, убрать все `wixstatic` | Главная визуально = черновик на 375/800/1440, `grep -r wixstatic dist` пусто | `npm run build`, Lighthouse mobile ≥90, скриншоты |
| 1 | **Стенд**: DNS, `stand.conf`, certbot, Directus под pm2 на `peri-cms.zumrudin.ru`, статика на `peri.zumrudin.ru` | Оба хоста по HTTPS, вход в Directus | `curl -I`, `pm2 ls` |
| 2 | **Схема CMS + пайплайн**: snapshot, роли, токен Builder, Flows, `rebuild/server.mjs`, `build.sh`, атомарный swap, бэкап-таймер | Правка поля в Directus → live ≤3 мин, запись в build_log | e2e-тест с видимой правкой; восстановление бэкапа во временный каталог |
| 3 | **Главная на CMS**: loader'ы Content Layer, `<Picture>` с AVIF/WebP и постоянным кэшем | Редактор меняет hero-текст/фото, порядок аппаратов/кейсов/отзывов | повторная сборка < 2 мин, Lighthouse ≥90 |
| 4 | **Миграция**: скрипты 01–05, сид, редакторы проверяют помеченные кейсы | все URL Wix в CONTENT-MAP, все картинки локально, сид идемпотентен | обход старого sitemap → 200/301 |
| 5 | **Шаблоны**: категория, процедура, uslugi-i-ceny, result, otzyvy, kontakty, ContentPage, 404, sitemap.xml, robots, OG, JSON-LD (MedicalClinic, BreadcrumbList, FAQPage), redirects.map | все страницы из CMS, ноль захардкоженного контента | Lighthouse ≥90 на 4 типах страниц, валидатор schema/HTML, обход битых ссылок |
| 6 | **Конверсия и юр. слой**: ContactSheet, MobileCtaBar, CookieNotice, Метрика + цели, MapEmbed, LegalBlock, Disclaimer, пометка Instagram, `show_prices`, iframe справки на `/spravka` | лист работает в iOS Safari и Android Chrome; хит Метрики после согласия | ручной тест на устройствах; в DevTools нет сторонних запросов до согласия |
| 7 | **Дизайн-QA и доступность**: контраст, минимум 11px, фокус-состояния, axe, кропы фото, reduced-motion | axe: 0 serious; визуальное согласование заказчиком на стенде | axe-core CLI; скриншоты 3 ширины × каждая страница |
| 8 | **Продакшен в РФ** (когда будет сервер): `setup.sh`, перенос БД и uploads, `www.conf`/`cms.conf`, снижение TTL DNS за неделю, переключение apex/www, Яндекс.Вебмастер (сайт, sitemap, зеркала), Wix живёт ещё 2 недели, мониторинг | старые URL 200/301 в проде, Вебмастер без критических ошибок через 72 ч | `curl`-обход CONTENT-MAP |
| 9 | **Передача**: `docs/ADMIN.md` (RU, скриншоты), обучение, тренировка восстановления, отключение Wix | сотрудник сам делает правку → публикацию | наблюдаемая сессия |

Фазы 4 и 5 могут идти параллельно (шаблоны на фикстурах до прихода сида). Разработка по фазам 0–7 ведётся на этой машине; фаза 8 ждёт российский сервер.

## Риски и вопросы к заказчику (не блокируют старт)

1. **Диск на стенде** заполнен на 86% (4 ГБ свободно): node_modules Astro + Directus + фото с Wix. Перед фазой 1 проверить, что можно почистить, либо вынести `uploads/` и кэш куда есть место.
2. **DNS**: кто управляет zumrudin.ru (для стенда) и peri-clinic.ru (регистратор, NS у Wix?) — нужен доступ к фазе 8.
3. **MAX**: формат ссылки на аккаунт клиники в MAX; **WhatsApp** — оставляем, но с оглядкой на ограничения в РФ (Telegram/MAX первыми в листе).
4. **Юр. данные и лицензия** (PDF), актуальность текстов политики/согласия (на Wix датированы 2023).
5. **Шрифты**: PeriDisplay/PeriText с Wix — неизвестная лицензия; предлагаем Cormorant Garamond + Golos Text (OFL), нужно одобрение визуальной замены.
6. **Права на фото** до/после (согласия пациентов) — помеченные кейсы остаются в draft до подтверждения.
7. **Цены**: публиковать или нет (`show_prices` выключен по умолчанию, как на Wix).
8. **Отзывы**: оставить с Wix или подтянуть из Яндекс/2ГИС со ссылками на источник.
9. Претензионный аудит текстов по 38-ФЗ (гарантии, «безопасно», «лучший»).

## Ключевые файлы

- `/root/peri-clinnic.ru/src/styles.css` — источник токенов/сетки/брейкпоинтов для `src/styles/tokens.css` (поправить <11px и контраст золота при переносе)
- `/root/peri-clinnic.ru/index.html` — структура секций и копирайт → `src/pages/index.astro` + `components/home/*` и фикстура фазы 0
- `/root/peri-clinnic.ru/src/main.js` — поведение → `src/scripts/{header,menu,reveal,rail}.ts`; код формы удаляется в пользу `contact-sheet.ts`
- `/etc/nginx/sites-enabled/dev-zumrudin.conf` — образец конфига стенда (80 + ACME, `127.0.0.1:4443 ssl` за sslh)
- новые: `src/content.config.ts`, `src/lib/directus.ts`, `directus/snapshot.yaml`, `deploy/rebuild/server.mjs`, `deploy/nginx/stand.conf`, `deploy/pm2/ecosystem.config.cjs`
