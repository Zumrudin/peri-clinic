# 012 — Фото первого экрана: одно медленное «оседание»

- **Status**: DONE
- **Commit**: d5cff2a
- **Severity**: LOW
- **Category**: Missed opportunities (delight, rare tier)
- **Estimated scope**: 1 файл (`src/components/home/Hero.astro`), ~12 строк CSS, без JS

## Проблема

Первый экран: текст всплывает через `.reveal`, фото статично. Это единственный момент за визит, где
уместен длинный, «дорогой» жест: фото чуть крупнее и медленно оседает в свой размер. Один раз за
загрузку, только `transform`, LCP не затрагивает.

```css
/* src/components/home/Hero.astro:121 — сейчас */
  .hero__photo :global(img) {
    object-fit: cover;
    object-position: center 30%;
  }
```

```astro
<!-- src/components/home/Hero.astro:56 — сейчас: триггер уже есть -->
  <div class="hero__content reveal">
```

## Цель

Без JS: когда `reveal.ts` добавит `is-visible` контенту, `:has()` на секции переключает фото.

```css
/* src/components/home/Hero.astro — цель, заменяет правило выше */
  .hero__photo :global(img) {
    object-fit: cover;
    object-position: center 30%;
    /* One slow settle per page load (1.6s, transform only, so LCP is unaffected); the
       trigger is the same `.is-visible` reveal.ts sets on the copy, via :has(). */
    transform: scale(1.05);
    transition: transform 1.6s var(--ease-out);
  }
  .hero:has(.hero__content.is-visible) .hero__photo :global(img) {
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .hero__photo :global(img) {
      transform: none;
      transition: none;
    }
  }
```

Правило `@media (min-width: 900px) .hero__photo :global(img) { object-fit: contain; object-position: center; }`
(строка ~239) не трогать: `transform` наследует состояние из базового правила.

## Конвенции репозитория

- Токен `--ease-out` (план 001). `:has()` уже допустим по поддержке (Chrome 105+, Safari 15.4+, Firefox 121+); без поддержки фото просто остаётся в `scale(1.05)`, что визуально неотличимо от обрезки `cover`.
- Комментарий «почему» в стиле файла.

## Шаги

1. Заменить правило `.hero__photo :global(img)` на целевое, добавить правило с `:has()` и reduced-блок.

## Границы

- `.hero__backdrop` (размытый фон) не трогать: он уже `scale(1.15)` статично.
- `.reveal` у `.hero__content` не менять, `reveal.ts` не менять.
- Не добавлять параллакс по скроллу или мыши.

## Проверка

- **Механическая**: `npm run check`, `npm run build`; Lighthouse (`npx lighthouse https://peri.zumrudin.ru --only-categories=performance --quiet`) — LCP не хуже, чем до правки (сравнить с прогоном на main).
- **На глаз**: перезагрузить главную: фото едва заметно «оседает» 1.6 с, пока текст всплывает; движение заканчивается мягко, без рывка.
  На 375: то же, фото не обнажает края (overflow скрыт). Reduced-motion: фото статично.
- **Готово, когда**: эффект виден один раз за загрузку, LCP не ухудшился.
