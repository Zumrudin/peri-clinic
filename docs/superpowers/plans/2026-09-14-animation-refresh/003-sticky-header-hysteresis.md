# 003 — Sticky-шапка без дёрганья

- **Status**: TODO
- **Commit**: d5cff2a
- **Severity**: MEDIUM
- **Category**: Performance, Interruptibility
- **Estimated scope**: 2 файла, ~10 строк

## Проблема

При скролле за 120px шапка становится `fixed`, анимирует `height` (layout-свойство) и каждый раз
проигрывает `headerIn` (въезд сверху из `translateY(-100%)`). Пользователь, покачивающийся возле
порога, видит повторяющийся въезд и дрожание высоты.

```css
/* src/components/shell/Header.astro:57 — сейчас */
    transition:
      height 0.3s,
      box-shadow 0.3s;
  }
  .header.is-sticky {
    height: var(--header-h-sticky);
    position: fixed;
    inset: 0 0 auto;
    box-shadow: 0 8px 30px rgba(170, 137, 47, 0.08);
    animation: headerIn 0.35s both;
  }
```

```ts
// src/scripts/header.ts — сейчас
export function initStickyHeader(header: HTMLElement | null): void {
  if (!header) return;
  let sticky = false;
  const sync = () => {
    const next = window.scrollY > 120;
    if (next !== sticky) {
      sticky = next;
      header.classList.toggle('is-sticky', sticky);
    }
  };
```

## Цель

```css
/* src/components/shell/Header.astro — цель */
    transition: box-shadow var(--dur-fast) var(--ease-out);
  }
  .header.is-sticky {
    height: var(--header-h-sticky);
    position: fixed;
    inset: 0 0 auto;
    box-shadow: 0 8px 30px rgba(170, 137, 47, 0.08);
    animation: headerIn 0.3s var(--ease-out) both;
  }
```

```ts
// src/scripts/header.ts — цель
/** Header becomes fixed + compact after scrolling past 120px and stays so until the
 *  user is back within 40px of the top (hysteresis: no flicker while hovering around
 *  the threshold, and the slide-in keyframe plays once per descent, not per pixel). */
export function initStickyHeader(header: HTMLElement | null): void {
  if (!header) return;
  const ON = 120;
  const OFF = 40;
  let sticky = false;
  const sync = () => {
    const y = window.scrollY;
    const next = sticky ? y > OFF : y > ON;
    if (next !== sticky) {
      sticky = next;
      header.classList.toggle('is-sticky', sticky);
    }
  };
```

Высота меняется мгновенно вместе со сменой `position` (это и так один кадр, плавная высота лишь
подчёркивала прыжок). Ключевой кадр `headerIn` остаётся, но на токене и играет один раз за спуск.

## Конвенции репозитория

- Комментарий в шапке файла `src/scripts/header.ts` в стиле остальных скриптов (одна строка «что и почему»).
- Токены из `src/styles/tokens.css` (план 001).

## Шаги

1. `src/components/shell/Header.astro`: заменить `transition: height 0.3s, box-shadow 0.3s;` на
   `transition: box-shadow var(--dur-fast) var(--ease-out);`; заменить `animation: headerIn 0.35s both;`
   на `animation: headerIn 0.3s var(--ease-out) both;`.
2. `src/scripts/header.ts`: заменить функцию на целевую (комментарий, константы `ON`/`OFF`, условие с гистерезисом).

## Границы

- Не менять правила `.header.is-sticky + main` / `~ main` (компенсация высоты).
- Не трогать мобильное меню (план 004).
- Не менять `@keyframes headerIn`.

## Проверка

- **Механическая**: `npm run check`, `npm test`, `npm run build` без ошибок.
- **На глаз**: на стенде медленно скроллить вниз до ~130px и обратно до ~100px несколько раз:
  шапка не должна переключаться туда-сюда; отлипает только у самого верха (<40px).
  Спуск с нуля: шапка въезжает один раз за 0.3 с, высота меняется без плавного «сжатия».
- **Готово, когда**: нет мерцания у порога, `transition` шапки не содержит `height`.
