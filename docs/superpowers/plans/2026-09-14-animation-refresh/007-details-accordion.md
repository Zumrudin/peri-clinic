# 007 — Аккордеоны FAQ и цен: плавное раскрытие

- **Status**: DONE
- **Commit**: d5cff2a
- **Severity**: MEDIUM
- **Category**: Missed opportunities (preventing a jarring change)
- **Estimated scope**: 3 файла, ~30 строк CSS, без JS

## Проблема

`<details>` в FAQ (`src/components/faq/Faq.astro:22`) и в списке цен (`src/pages/uslugi-i-ceny.astro:64`,
`.pricing__item`) открываются рывком: вращается только шеврон, контент появляется за один кадр.
Частота — иногда, цель — предотвратить резкое изменение; кандидат проходит все ворота.

```css
/* src/components/faq/Faq.astro:68 — сейчас */
  .faq__chevron {
    flex: 0 0 auto;
    color: var(--gold-deep);
    transition: transform var(--dur-fast);
  }
  .faq__item[open] .faq__chevron {
    transform: rotate(180deg);
  }
  .faq__answer {
    padding: 0 0 24px;
  }
```

```css
/* src/pages/uslugi-i-ceny.astro:119 — сейчас */
  .pricing__item { border-bottom: 1px solid var(--line); scroll-margin-top: calc(var(--header-h-sticky) + 24px); }
  ...
  .pricing__table { padding: 4px 0 24px; }
```

## Цель

Нативный `::details-content` + `interpolate-size: allow-keywords` (Chrome 131+, Safari 26+, Firefox 138+;
старые браузеры получают мгновенное раскрытие, как сейчас). Высота и opacity за `--dur-fast` на
`--ease-out`, закрытие тем же путём. Это единственное место в проекте, где допускается анимация `height`:
для аккордеона нет transform-эквивалента, а контент короткий.

```css
/* src/styles/base.css — цель, дополнить правило `html { … }` */
html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  /* lets `height: auto` transition on ::details-content (accordion open/close) */
  interpolate-size: allow-keywords;
}
```

```css
/* src/components/faq/Faq.astro — цель, добавить после .faq__item[open] .faq__chevron */
  /* Native accordion transition: browsers without ::details-content keep the instant toggle. */
  .faq__item::details-content {
    height: 0;
    overflow: clip;
    opacity: 0;
    transition:
      height var(--dur-fast) var(--ease-out),
      opacity var(--dur-fast) var(--ease-out),
      content-visibility var(--dur-fast) allow-discrete;
  }
  .faq__item[open]::details-content {
    height: auto;
    opacity: 1;
  }
```

```css
/* src/pages/uslugi-i-ceny.astro — цель, добавить после правила .pricing__item[open] .pricing__chevron */
  .pricing__item::details-content {
    height: 0;
    overflow: clip;
    opacity: 0;
    transition:
      height var(--dur-fast) var(--ease-out),
      opacity var(--dur-fast) var(--ease-out),
      content-visibility var(--dur-fast) allow-discrete;
  }
  .pricing__item[open]::details-content {
    height: auto;
    opacity: 1;
  }
```

Reduced-motion: глобальное правило плана 005 выбрасывает `height` из `transition-property`, остаётся fade. Отдельно ничего писать не нужно.

## Конвенции репозитория

- Токены `--dur-fast`, `--ease-out` (план 001).
- `.pricing__nav-group` (боковая навигация) и `.pricing__navigation` не трогать: они управляются `pricing.ts` и на десктопе всегда открыты.

## Шаги

1. `src/styles/base.css`: добавить `interpolate-size: allow-keywords;` в правило `html` с комментарием.
2. `src/components/faq/Faq.astro`: добавить два правила `::details-content`.
3. `src/pages/uslugi-i-ceny.astro`: добавить два правила `::details-content` для `.pricing__item`.

## Границы

- Разметку `<details>/<summary>`, атрибут `name`, `pricing.ts` не менять.
- Не добавлять JS-полифилл высоты.
- `.faq__answer` и `.pricing__table` (внутренние отступы) не менять.

## Проверка

- **Механическая**: `npm run check`, `npm run build` без ошибок.
- **На глаз** (Chrome ≥131 и Safari ≥26; в старом Firefox — проверить, что раскрытие просто мгновенное и ничего не сломано):
  - FAQ на странице процедуры: ответ раскрывается за 0.25 с с fade, закрывается так же; быстрый двойной клик не «дёргает» высоту.
  - `/uslugi-i-ceny`: клик по ссылке процедуры в левой навигации (якорь) открывает нужный `details` и прокручивает к нему; прокрутка не промахивается из-за анимации высоты (если промахивается — сообщить, не чинить).
  - DevTools → Animations → 10 %: высота и opacity идут одновременно, кривая с быстрым стартом.
- **Готово, когда**: аккордеоны раскрываются плавно в поддерживающих браузерах и по-прежнему работают в остальных.
