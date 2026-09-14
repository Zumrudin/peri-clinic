# 004 — Мобильное меню: вход медленнее выхода, бургер только на `transform`

- **Status**: TODO
- **Commit**: d5cff2a
- **Severity**: MEDIUM
- **Category**: Easing & duration, Performance
- **Estimated scope**: 1 файл (`src/components/shell/Header.astro`), ~25 строк

## Проблема

Панель меню входит и выходит одинаково (0.35 с) на встроенном `ease`; выход должен быть короче.
Линии бургера анимируются через `transition: var(--dur-fast)` (это `transition: all`) и через `top`,
то есть layout-свойство.

```css
/* src/components/shell/Header.astro:158 — сейчас (внутри @media (max-width: 800px)) */
    .menu-toggle span {
      position: absolute;
      left: 11px;
      right: 11px;
      height: 1px;
      background: var(--ink);
      transition: var(--dur-fast);
    }
    .menu-toggle span:first-child { top: 18px; }
    .menu-toggle span:last-child { top: 25px; }
    .menu-toggle[aria-expanded='true'] span:first-child {
      top: 22px;
      transform: rotate(45deg);
    }
    .menu-toggle[aria-expanded='true'] span:last-child {
      top: 22px;
      transform: rotate(-45deg);
    }
```

```css
/* src/components/shell/Header.astro:183 — сейчас */
    .nav {
      ...
      transform: translateX(100%);
      visibility: hidden;
      opacity: 0;
      overflow-y: auto;
      transition:
        transform 0.35s,
        opacity 0.35s,
        visibility 0.35s;
    }
    .nav.is-open {
      transform: none;
      visibility: visible;
      opacity: 1;
    }
```

## Цель

```css
/* цель — бургер: линии остаются на своих top, к центру их сводит transform */
    .menu-toggle span {
      position: absolute;
      left: 11px;
      right: 11px;
      height: 1px;
      background: var(--ink);
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .menu-toggle span:first-child { top: 18px; }
    .menu-toggle span:last-child { top: 25px; }
    .menu-toggle[aria-expanded='true'] span:first-child {
      transform: translateY(4px) rotate(45deg);
    }
    .menu-toggle[aria-expanded='true'] span:last-child {
      transform: translateY(-3px) rotate(-45deg);
    }
```

```css
/* цель — панель: закрытое состояние = выход 0.25 с, открытое = вход 0.35 с */
    .nav {
      ...
      transform: translateX(100%);
      visibility: hidden;
      opacity: 0;
      overflow-y: auto;
      transition:
        transform var(--dur-fast) var(--ease-out),
        opacity var(--dur-fast) var(--ease-out),
        visibility 0s linear var(--dur-fast);
    }
    .nav.is-open {
      transform: none;
      visibility: visible;
      opacity: 1;
      transition:
        transform 0.35s var(--ease-out),
        opacity 0.35s var(--ease-out),
        visibility 0s;
    }
```

## Конвенции репозитория

- Токены из `src/styles/tokens.css` (план 001). Перечислять свойства transition явно, никогда `all`.
- Скрипт `src/scripts/menu.ts` не менять: классы `is-open`/`aria-expanded` уже переключаются.

## Шаги

1. Заменить блок `.menu-toggle span …` на целевой (убрать `top: 22px` из состояний `aria-expanded`).
2. Заменить `transition` у `.nav` и добавить `transition` в `.nav.is-open`.

## Границы

- Только `@media (max-width: 800px)` в `Header.astro`. Десктопное подчёркивание пунктов не трогать.
- Разметку и `menu.ts` не менять.

## Проверка

- **Механическая**: `npm run check`, `npm run build`; `grep -n "transition: var(--dur-fast)" src/components/shell/Header.astro` пусто.
- **На глаз** (375px): открыть меню: панель въезжает справа 0.35 с и резко «садится»; закрыть: уходит быстрее (0.25 с).
  Бургер складывается в крест без вертикального дрожания линий; крест центрирован (линии пересекаются на 22px).
  Быстрые повторные тапы не заставляют панель прыгать в крайнее положение.
- **Готово, когда**: выход короче входа, у бургера анимируется только `transform`.
