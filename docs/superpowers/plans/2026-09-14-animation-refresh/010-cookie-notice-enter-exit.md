# 010 — Плашка cookie: вход и выход с нижнего края

- **Status**: DONE
- **Commit**: d5cff2a
- **Severity**: LOW
- **Category**: Missed opportunities (spatial consistency)
- **Estimated scope**: 1 файл (`src/components/shell/CookieNotice.astro`), ~20 строк CSS

## Проблема

Плашка появляется и исчезает через атрибут `hidden` за один кадр, причём в момент, когда первый экран
ещё «оседает». Показывается один раз на пользователя — это тот редкий случай, где движение уместно.

```html
<!-- src/components/shell/CookieNotice.astro:4 — сейчас -->
<aside class="cookie-notice" data-cookie-notice hidden aria-label="Уведомление об использовании cookie">
```

```js
// src/components/shell/CookieNotice.astro:16,19 — сейчас
    el.hidden = false;
    ...
      el.hidden = true;
```

```css
/* src/components/shell/CookieNotice.astro:27 — сейчас */
  .cookie-notice[hidden] {
    display: none;
  }
  .cookie-notice {
    position: fixed;
    ...
    box-shadow: 0 20px 50px rgba(20, 18, 12, 0.3);
  }
```

## Цель

JS не меняется. CSS: вход снизу за 0.4 с на `--ease-out` с задержкой 0.8 с (после появления Hero),
выход тем же краем за `--dur-fast` без задержки, `display` через `allow-discrete`.

```css
/* цель — заменяет .cookie-notice[hidden] и дополняет .cookie-notice */
  /* Enters from the bottom edge after the hero has settled (0.8s delay) and leaves the same
     way; `allow-discrete` lets the exit run before display:none applies. */
  .cookie-notice {
    position: fixed;
    z-index: var(--z-menu);
    left: 16px;
    right: 16px;
    bottom: 16px;
    max-width: 620px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 18px 22px;
    background: var(--dark);
    color: var(--dark-text);
    border-radius: var(--radius);
    box-shadow: 0 20px 50px rgba(20, 18, 12, 0.3);
    transform: none;
    opacity: 1;
    transition:
      transform 0.4s var(--ease-out) 0.8s,
      opacity 0.4s var(--ease-out) 0.8s;
  }
  @starting-style {
    .cookie-notice:not([hidden]) {
      transform: translateY(120%);
      opacity: 0;
    }
  }
  .cookie-notice[hidden] {
    display: none;
    transform: translateY(120%);
    opacity: 0;
    transition:
      transform var(--dur-fast) var(--ease-out),
      opacity var(--dur-fast) var(--ease-out),
      display var(--dur-fast) allow-discrete;
  }
```

`translateY(120%)` вместо пиксельного смещения: на узких экранах плашка стоит на `bottom: 84px`
(над мобильной панелью), процент от собственной высоты уводит её за край в обоих случаях.

Reduced-motion: глобальное правило плана 005 оставит только opacity и обнулит задержку.

## Конвенции репозитория

- Токены из плана 001. Комментарий «почему» над правилом.
- Скрипт компонента не менять: `hidden` уже переключается.

## Шаги

1. Заменить `.cookie-notice[hidden] { display: none; }` и правило `.cookie-notice` на целевые (порядок: сначала `.cookie-notice`, затем `@starting-style`, затем `[hidden]`).

## Границы

- Разметка, JS, ключ `localStorage.peri_consent`, событие `peri:consent` — без изменений.
- Медиа-запрос `@media (max-width: 560px)` не менять.

## Проверка

- **Механическая**: `npm run check`, `npm run build`.
- **На глаз**: очистить `localStorage` (`localStorage.removeItem('peri_consent')`), перезагрузить главную:
  плашка выезжает снизу через ~0.8 с после загрузки, за 0.4 с; «Принять» — уезжает вниз за 0.25 с, без задержки.
  На 375px плашка уходит за нижний край полностью (не застревает над панелью CTA).
- **Готово, когда**: вход и выход по одному краю, задержка на входе есть, на выходе нет.
