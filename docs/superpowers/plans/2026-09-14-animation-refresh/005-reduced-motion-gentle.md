# 005 — Reduced-motion: убрать движение, оставить отклик

- **Status**: TODO
- **Commit**: d5cff2a
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: `src/styles/base.css` + 7 компонентов, ~40 строк

## Проблема

Глобальное правило гасит все transitions и animations до 0.01 мс. Пользователь с reduced-motion теряет
даже цветовые hover и фокус-подсветки — интерфейс кажется сломанным. Правило: «меньше и мягче»,
а не «ноль»: оставить opacity/цвет, убрать смещения, масштабирование и бесконечные декоративные циклы.

```css
/* src/styles/base.css:370 — сейчас */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Hover-движения, которые остаются (и должны исчезнуть при reduced-motion):

- `src/styles/base.css` `.button:hover { transform: translateY(-2px) }`, `.text-link:hover span { transform: translate(3px, -3px) }`
- `src/components/shell/FloatingContact.astro:28` `.floating-contact:hover { transform: scale(1.06) }`
- `src/components/home/Categories.astro:105,134,181` `.service-card:hover { transform: scale(1.015) }`, `img scale(1.045)`, `.round-arrow rotate/translate`
- `src/components/home/Cases.astro:113` `.result-card:hover img { transform: scale(1.025) }`
- `src/components/home/Devices.astro:109` `.machine-card:hover { transform: translateY(-4px) }`
- `src/components/results/CaseCard.astro:89` `.case-card:hover { transform: translateY(-2px) }`
- `src/templates/CategoryPage.astro:72` и `src/pages/apparaty.astro:60` `translateY(-2px)`
- `src/components/gallery/SpecialistMedia.astro:53` `img scale(1.025)` (там уже есть reduced-правило, оно убирает только transition)

## Цель

```css
/* src/styles/base.css — цель */
/* Reduced motion means fewer and gentler animations, not zero: keep opacity/colour feedback
   (hover, focus, dialog fades), drop looping decoration and anything that moves or scales.
   Component styles add `transform: none` for their own hover lifts under the same query. */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
  *,
  *::before,
  *::after {
    animation: none !important;
    transition-property: opacity, color, background-color, border-color, box-shadow !important;
    transition-duration: 0.2s !important;
    transition-timing-function: ease !important;
    transition-delay: 0s !important;
  }
  .button:hover,
  .text-link:hover span {
    transform: none;
  }
}
```

В каждом компоненте из списка выше добавить в конец `<style>` (или в существующий reduced-блок):

```css
  @media (prefers-reduced-motion: reduce) {
    /* keep the colour/shadow change, drop the lift */
    .<selector>:hover { transform: none; }
  }
```

Конкретно:

- `FloatingContact.astro`: `.floating-contact:hover { transform: none; }`
- `Categories.astro`: `.service-card:hover, .service-card:hover :global(img), .service-card:hover .round-arrow { transform: none; }`
- `Cases.astro`: в существующий `@media (prefers-reduced-motion: reduce)` (строка 279) добавить `.result-card:hover .result-card__image :global(img) { transform: none; }`
- `Devices.astro`: `.machine-card:hover { transform: none; }`
- `CaseCard.astro`: `.case-card:hover { transform: none; }`
- `CategoryPage.astro`: `.service-card:hover, .service-card:focus-visible { transform: none; }`
- `apparaty.astro`: `.device-card:hover { transform: none; }`
- `SpecialistMedia.astro`: расширить существующее правило до `.media-cover img { transition:none; } .media-link:hover img { transform:none; }`

Ожидаемый побочный эффект (желательный): transitions из планов 002/007/010/011 при reduced-motion
автоматически сводятся к opacity (transform/height/display выпадают из `transition-property`), а
`.glow__blob`, `.ticker__track`, `headerIn` перестают анимироваться.

## Конвенции репозитория

- Глобальные утилиты правятся в `base.css`, компонентные hover — в scoped `<style>` компонента.
- Комментарий объясняет «почему» (см. существующие комментарии в `base.css`).

## Шаги

1. `src/styles/base.css`: заменить блок `@media (prefers-reduced-motion: reduce)` на целевой.
2. Добавить reduced-правила в 8 компонентов по списку.
3. `src/components/home/Ticker.astro:65`: существующее `animation: none` оставить (дублирует глобальное, безвредно).

## Границы

- Не менять сами hover-эффекты вне медиа-запроса (это планы 006/009).
- Не убирать `.reveal`-правило.
- Скрипты (`reveal.ts`, `rail.ts`, `photo-gallery.ts`) уже читают `matchMedia('(prefers-reduced-motion: reduce)')`; не трогать.

## Проверка

- **Механическая**: `npm run check`, `npm run build`; `grep -n "0.01ms" src/styles/base.css` пусто.
- **На глаз** (DevTools → Rendering → Emulate CSS media `prefers-reduced-motion: reduce`):
  - Кнопка «Записаться»: цвет меняется плавно (0.2 с), подъёма нет.
  - Лист записи (после плана 002): появляется fade, без сдвига; закрывается fade.
  - Бегущая строка стоит, блобы в отзывах стоят, шапка не въезжает.
  - Фокус с клавиатуры (Tab) виден, ничего не мигает.
- **Готово, когда**: при reduced-motion нет ни одного смещения/масштаба, но цветовой отклик сохранён.
