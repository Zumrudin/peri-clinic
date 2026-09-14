# 006 — Hover-движение только для мыши, убрать `backdrop-filter` из hover

- **Status**: DONE
- **Commit**: d5cff2a
- **Severity**: MEDIUM
- **Category**: Accessibility, Performance
- **Estimated scope**: 7 файлов, ~60 строк (перенос правил под медиа-запрос)

## Проблема

На тач-устройствах `:hover` срабатывает при тапе и «залипает»: кнопка остаётся приподнятой, фото
в карточке — увеличенным. На мобильных карточках направлений при hover анимируется `backdrop-filter`
(дорогая перерисовка на каждый кадр).

```css
/* src/styles/base.css:177 — сейчас */
.button:hover {
  background: var(--gold-hover);
  border-color: var(--gold-hover);
  transform: translateY(-2px);
}
/* src/styles/base.css:224 — сейчас */
.text-link:hover span {
  transform: translate(3px, -3px);
}
```

```css
/* src/components/home/Categories.astro:105 — сейчас (мобильная версия карточки) */
  .service-card:hover {
    transform: scale(1.015);
    box-shadow: var(--shadow-glow);
  }
  .service-card::after {
    ...
    backdrop-filter: blur(0);
    transition: backdrop-filter var(--dur-fast);
  }
  .service-card:hover::after {
    backdrop-filter: blur(2px);
  }
  ...
  .service-card:hover :global(img) {
    transform: scale(1.045);
    filter: saturate(1);
  }
  ...
  .service-card:hover .round-arrow { ... transform: rotate(45deg); ... }
```

Прочие hover с движением: `Cases.astro:113` (img scale), `Devices.astro:109` (machine-card lift),
`CaseCard.astro:89`, `CategoryPage.astro:72`, `apparaty.astro:60`, `SpecialistMedia.astro:53`,
`FloatingContact.astro:28` (на мобильных скрыт — можно не трогать).

## Цель

Правила hover, содержащие `transform`/`filter`, завернуть в `@media (hover: hover) and (pointer: fine)`.
Цветовые hover (`background`, `color`, `border-color`) оставить без медиа-запроса — они безвредны.
Переход `backdrop-filter` и `.service-card:hover::after` удалить полностью.

```css
/* src/styles/base.css — цель */
.button:hover {
  background: var(--gold-hover);
  border-color: var(--gold-hover);
}
@media (hover: hover) and (pointer: fine) {
  .button:hover {
    transform: translateY(-2px);
  }
  .text-link:hover span {
    transform: translate(3px, -3px);
  }
}
```

```css
/* src/components/home/Categories.astro — цель (мобильный блок) */
  .service-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(20, 20, 17, 0.05) 28%, rgba(20, 20, 17, 0.8) 100%);
  }
  /* (правила .service-card:hover, .service-card:hover::after, .service-card:hover :global(img),
      .service-card:hover .round-arrow из мобильного блока удаляются; hover-движение только для мыши:) */
  @media (hover: hover) and (pointer: fine) {
    .service-card:hover {
      transform: scale(1.015);
      box-shadow: var(--shadow-glow);
    }
    .service-card:hover :global(img) {
      transform: scale(1.045);
      filter: saturate(1);
    }
    .service-card:hover .round-arrow {
      background: #fff;
      color: var(--ink);
      transform: rotate(45deg);
      box-shadow: var(--shadow-glow);
    }
  }
```

В десктопном блоке `@media (min-width: 801px)` Categories уже переопределяет hover (`transform: none` для карточки,
`translateX(3px)` для стрелки); эти правила остаются, они и так работают только на широких экранах.

Для остальных файлов — тот же приём: `transform`-часть hover переносится в блок
`@media (hover: hover) and (pointer: fine) { … }` в том же `<style>`, цветовая часть остаётся.

## Конвенции репозитория

- Медиа-запрос ровно в такой форме: `@media (hover: hover) and (pointer: fine)`.
- Никаких изменений разметки.

## Шаги

1. `src/styles/base.css`: `.button:hover` и `.text-link:hover span` — по целевому образцу.
2. `src/components/home/Categories.astro`: удалить `backdrop-filter`/`transition` у `::after` и правило `:hover::after`; перенести hover-движение под медиа-запрос.
3. `Cases.astro`, `Devices.astro`, `CaseCard.astro`, `CategoryPage.astro`, `apparaty.astro`, `SpecialistMedia.astro`: перенести `transform`-часть hover под медиа-запрос.
4. `FloatingContact.astro` не трогать (скрыт на ≤800px).

## Границы

- Не менять сами значения hover (это план 009 добавляет `:active`; выполнять после него или до, но не одновременно).
- Reduced-motion правила из плана 005 не удалять.
- Если план 005 уже выполнен: его `transform: none` при reduced-motion остаётся снаружи нового медиа-запроса.

## Проверка

- **Механическая**: `npm run check`, `npm run build`; `grep -rn "backdrop-filter var(--dur-fast)\|transition: backdrop-filter" src` пусто.
- **На глаз**: DevTools → Toggle device toolbar (iPhone): тап по «Записаться» и закрытие листа — кнопка не остаётся приподнятой;
  тап по карточке результата — фото не остаётся увеличенным. На десктопе с мышью hover работает как раньше.
- **Готово, когда**: на эмуляции тача ни один элемент не «залипает» в hover-состоянии.
