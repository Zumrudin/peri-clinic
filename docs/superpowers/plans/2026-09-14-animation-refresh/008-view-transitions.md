# 008 — Кросс-фейд между страницами (Astro ClientRouter)

- **Status**: DONE
- **Commit**: d5cff2a
- **Severity**: LOW по аудиту, HIGH по трудоёмкости и риску
- **Category**: Missed opportunities (preventing a jarring change)
- **Estimated scope**: `Base.astro`, `Page.astro`, 10 точек инициализации скриптов, `Metrika.astro`

## Проблема

Переход между страницами — белая вспышка и мгновенная подмена. Для многостраничного сайта это самый
заметный «рывок». Astro 7.3.2 (установлен) содержит `ClientRouter` (`node_modules/astro/components/ClientRouter.astro`):
кросс-фейд по умолчанию — keyframes `astroFadeIn/astroFadeOut` (opacity, 180 мс), при
`prefers-reduced-motion` анимация автоматически отключается.

Риск: при клиентской навигации `<script>`-модули Astro выполняются один раз на сессию. Сейчас все
инициализации — вызовы верхнего уровня и IIFE:

| Файл | Строка | Что делает | Требуемая правка |
| --- | --- | --- | --- |
| `src/layouts/Base.astro` | 54–59 | `initReveal()`, `initRails()`, `initContactSheet()` | reveal/rails — на каждый `astro:page-load`; contact-sheet — один раз (диалог persist) |
| `src/components/shell/Header.astro` | 38–41 | `initStickyHeader`, `initMobileMenu` | один раз (шапка persist) |
| `src/components/home/Cases.astro` | 67–68 | `initResultsCarousel()` | на каждый `astro:page-load` (есть guard `dataset.resultsReady`) |
| `src/templates/TreatmentPage.astro` | 103–104 | `initResultsCarousel()` | то же |
| `src/components/gallery/Lightbox.astro` | 11–12 | `initPhotoGalleries()` | на каждый `astro:page-load` (guard `dialog.dataset.ready`) |
| `src/components/gallery/SpecialistMedia.astro` | 37–38 | `initSpecialistMedia()` | на каждый `astro:page-load` (guard `root.dataset.ready`) |
| `src/pages/result.astro` | 119–120 | `initResultsFilter(...)` | на каждый `astro:page-load` |
| `src/scripts/pricing.ts` | весь файл | код верхнего уровня, слушатели `window` | обернуть в функцию, флаг `let bound`; вызывать на `astro:page-load` |
| `src/scripts/cert-request.js` | IIFE | `if (!$('cr-form')) return;` при импорте | обернуть в функцию, вызывать на `astro:page-load` |
| `src/components/shell/Metrika.astro` | inline | init один раз | добавить `ym(id, 'hit', location.href)` на `astro:page-load` (кроме первой загрузки) |

## Цель

```astro
<!-- src/layouts/Base.astro — цель, в <head> -->
---
import { ClientRouter } from 'astro:transitions';
...
---
    <slot name="head" />
    <JsonLd data={clinicJsonLd} />
    <ClientRouter />
  </head>
```

```astro
<!-- src/layouts/Base.astro — цель, скрипт в конце <body> -->
    <script>
      import { initReveal } from '../scripts/reveal';
      import { initRails } from '../scripts/rail';
      import { initContactSheet } from '../scripts/contact-sheet';
      // ClientRouter runs module scripts once per session: per-page setup re-runs on
      // astro:page-load (fires on first load too); the contact sheet is persisted across
      // navigations, so its document-level listeners are bound exactly once.
      initContactSheet();
      document.addEventListener('astro:page-load', () => {
        initReveal();
        initRails();
      });
    </script>
```

```astro
<!-- src/layouts/Page.astro — цель -->
    <Header transition:persist />
    ...
  <FloatingContact />
  <MobileCtaBar />
```

и в `Base.astro`: `<ContactSheet transition:persist />`, `<CookieNotice transition:persist />`.

Шаблон для остальных компонентов (пример `Cases.astro`):

```astro
<script>
  import { initResultsCarousel } from '../../scripts/results-carousel';
  document.addEventListener('astro:page-load', initResultsCarousel);
</script>
```

`pricing.ts` — обернуть содержимое в `export function initPricing()`, слушатели `window`
(`hashchange`) регистрировать под флагом `let windowBound = false` на уровне модуля; вызывать
`document.addEventListener('astro:page-load', initPricing)` в `uslugi-i-ceny.astro`.
`cert-request.js` — аналогично: IIFE → `export function initCertRequest()`, вызов на `astro:page-load`.

`Metrika.astro` — после `document.addEventListener('peri:contact', …)` добавить:

```js
      let firstLoad = true;
      document.addEventListener('astro:page-load', () => {
        if (firstLoad) { firstLoad = false; return; }
        if (window.ym) window.ym(metrikaId, 'hit', location.href, { title: document.title });
      });
```

Длительность кросс-фейда оставить дефолтную (180 мс). Не добавлять slide-анимаций.

## Конвенции репозитория

- Комментарии «почему» в стиле `src/lib/*` — обязательно объяснить «module scripts run once».
- Guard-паттерн `if (root.dataset.ready) return; root.dataset.ready = 'true';` уже есть в `photo-gallery.ts`, `specialist-media.ts`, `results-carousel.ts` — переиспользовать, не изобретать.

## Шаги

1. `Base.astro`: импорт и `<ClientRouter />`; переписать скрипт; `transition:persist` на `ContactSheet`, `CookieNotice`.
2. `Page.astro`: `transition:persist` на `Header`.
3. Каждый компонент из таблицы: обернуть вызов в `astro:page-load`.
4. `pricing.ts`, `cert-request.js`: превратить в экспортируемые функции с флагами для `window`/`document`-слушателей.
5. `Metrika.astro`: хит на `astro:page-load`.
6. Проверить `results-filter.ts`: он вешает слушатели на элементы страницы (пересоздаются при навигации) — guard не нужен.

## Границы

- Не менять анимацию по умолчанию, не добавлять `transition:animate` на элементы.
- Не менять логику скриптов сверх инициализации.
- Не трогать nginx/деплой: HTML остаётся статическим.
- Если какой-то скрипт после обёртки ведёт себя иначе, остановиться и сообщить — не чинить «по месту».

## Проверка

- **Механическая**: `npm run check`, `npm test`, `npm run build`; `node scripts/qa/check-links.mjs` зелёный.
- **Регрессия на стенде** (обязательно все пункты, каждый — после перехода по внутренней ссылке, а не по прямой загрузке):
  - Главная → процедура → главная: `.reveal` срабатывает, карусели листаются, лист записи открывается и закрывается один раз (не два клика-обработчика: открыть, закрыть, в консоли `getEventListeners(document).click.length` не растёт при повторных переходах).
  - `/uslugi-i-ceny`: категории, якоря, мобильная навигация; уйти и вернуться — работает, `hashchange` не дублируется.
  - Страница с сертификатом: форма инициализируется после перехода по ссылке.
  - Страница специалиста: галерея, лайтбокс, видео.
  - `/result`: фильтр.
  - Шапка: sticky-состояние и открытое мобильное меню переживают навигацию корректно (меню закрывается по клику на ссылку — это уже есть в `menu.ts`).
  - Metrika (если включена): в Network появляется `hit` при каждом переходе.
  - Rendering → reduced-motion: переход мгновенный.
- **Готово, когда**: все пункты регрессии пройдены на 375 и 1440.
