# 001 — Единые токены движения, мягкий `.reveal` со стаггером

- **Status**: ON STAND (ждёт подтверждения)
- **Commit**: d5cff2a
- **Severity**: HIGH
- **Category**: Easing & duration, Cohesion & tokens
- **Estimated scope**: 6 файлов, ~40 строк

## Проблема

Кривая `--ease-out: cubic-bezier(0.2, 0.7, 0.2, 1)` слабая: движение начинается вяло и не «ставит точку».
`.reveal` работает на 23 элементах главной и на каждой секции страниц процедур: 0.8 с, сдвиг 24px,
opacity на встроенном `ease`. Соседние карточки в сетке появляются разом. Часть компонентов
пишет длительности мимо токенов (0.3 с, 0.6 с, `ease-out` в JS). Итог: тяжёлое, неоднородное движение.

```css
/* src/styles/tokens.css:87 — сейчас */
  /* Motion */
  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
  --dur-fast: 0.25s;
  --dur-slow: 0.75s;
```

```css
/* src/styles/base.css:358 — сейчас */
/* Motion */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.8s ease,
    transform 0.8s var(--ease-out);
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}
```

```ts
// src/scripts/reveal.ts:10 — сейчас
  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -45px' },
  );
```

Значения мимо токенов:

```css
/* src/components/home/Cases.astro:111 — сейчас */
    transition: transform 0.6s;
/* src/components/home/Devices.astro:89 — сейчас (это transition: all) */
    transition: var(--dur-fast);
/* src/components/home/Devices.astro:105 — сейчас */
    transition:
      box-shadow 0.3s,
      transform 0.3s;
/* src/components/faq/Faq.astro:70 — сейчас */
    transition: transform var(--dur-fast);
/* src/pages/uslugi-i-ceny.astro:123 — сейчас (фрагмент строки) */
transition: transform var(--dur-fast), background var(--dur-fast);
```

```ts
// src/scripts/photo-gallery.ts — сейчас, две строки
        element.style.transition = 'transform 200ms ease-out';
        ...
        if (Math.abs(delta) < rail.clientWidth) card.animate([{ transform: `translateX(${delta}px)` }, { transform: 'translateX(0)' }], { duration: 250, easing: 'ease-out' });
```

## Цель

```css
/* src/styles/tokens.css — цель */
  /* Motion — one strong ease-out for entrances and hover, ease-in-out for movement
     across the screen, an iOS-like curve for sheets. Built-in `ease`/`ease-out` are
     too weak to read as deliberate; every component must use these tokens. */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-press: 0.16s;
  --dur-fast: 0.25s;
  --dur-reveal: 0.6s;
  --dur-slow: 0.75s;
  --stagger: 60ms;
```

```css
/* src/styles/base.css — цель */
/* Motion — `--reveal-i` is set by reveal.ts for elements that enter in the same
   observer tick, so a grid row staggers while a lone section arrives without delay. */
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity var(--dur-reveal) var(--ease-out),
    transform var(--dur-reveal) var(--ease-out);
  transition-delay: calc(var(--reveal-i, 0) * var(--stagger));
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}
```

```ts
// src/scripts/reveal.ts — цель
  const observer = new IntersectionObserver(
    (entries, obs) => {
      // Elements entering in the same tick (first paint, a whole grid row) stagger by
      // --stagger (max 5 steps); anything scrolled into view later arrives alone, delay 0.
      let i = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.style.setProperty('--reveal-i', String(Math.min(i++, 4)));
        el.classList.add('is-visible');
        obs.unobserve(el);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -45px' },
  );
```

Компоненты:

```css
/* src/components/home/Cases.astro:111 — цель */
    transition: transform var(--dur-slow) var(--ease-out);
/* src/components/home/Devices.astro:89 — цель */
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
/* src/components/home/Devices.astro:105 — цель */
    transition:
      box-shadow var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
/* src/components/faq/Faq.astro:70 — цель */
    transition: transform var(--dur-fast) var(--ease-out);
/* src/pages/uslugi-i-ceny.astro:123 — цель (фрагмент строки) */
transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
```

```ts
// src/scripts/photo-gallery.ts — цель: та же кривая, что в токене (JS не читает CSS-переменные)
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
        element.style.transition = `transform 200ms ${EASE_OUT}`;
        ...
        card.animate([{ transform: `translateX(${delta}px)` }, { transform: 'translateX(0)' }], { duration: 250, easing: EASE_OUT });
```

## Конвенции репозитория

- Токены живут в `src/styles/tokens.css`, комментарии объясняют «почему» (см. блок Glass там же).
- Пример правильного использования токенов: `src/components/home/Categories.astro:103`
  `transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast);`.
- Глобальные утилиты (`.reveal`) не переопределять в scoped `<style>` компонентов.

## Шаги

1. `src/styles/tokens.css`: заменить блок `/* Motion */` (3 строки) на целевой (8 строк + комментарий).
2. `src/styles/base.css`: заменить правило `.reveal` на целевое. `.reveal.is-visible` не менять.
   Блок `@media (prefers-reduced-motion: reduce)` ниже не трогать (его правит план 005).
3. `src/scripts/reveal.ts`: заменить колбэк `IntersectionObserver` на целевой.
4. `src/components/home/Cases.astro:111`, `src/components/home/Devices.astro:89` и `:105`,
   `src/components/faq/Faq.astro:70`, `src/pages/uslugi-i-ceny.astro:123`: заменить фрагменты по списку выше.
5. `src/scripts/photo-gallery.ts`: добавить константу `EASE_OUT` после заголовочного комментария
   и заменить оба места (`'transform 200ms ease-out'` и `easing: 'ease-out'`).

## Границы

- Не менять разметку, пороги `IntersectionObserver`, логику `unobserve`.
- Не трогать `Header.astro` (план 003/004), `ContactSheet.astro` (план 002), hover-правила (планы 006/009).
- Не добавлять зависимости.
- Если код в файле не совпадает с приведённым «сейчас», остановиться и сообщить.

## Проверка

- **Механическая**: `npm run check` без ошибок; `npm test` зелёный; `npm run build` успешен;
  `grep -rn "ease-out'" src/scripts` не находит строковых `'ease-out'`;
  `grep -rn "0\.3s\|0\.6s" src/components/home` пусто.
- **На глаз** (стенд, DevTools → Animations → 10 %):
  - Главная: заголовок и лид Hero появляются за 0.6 с с коротким сдвигом вверх, движение «садится» резко в конце, без затухающего хвоста.
  - Три карточки направлений при первом показе идут волной с шагом 60 мс; при скролле к одиночной секции задержки нет.
  - Карточки результатов на hover увеличивают фото мягко, без ощущения «резины».
  - Стрелки слайдера аппаратов: цвет меняется, ничего лишнего не анимируется.
- **Готово, когда**: сборка зелёная, `reveal` на стенде выглядит легче старого (0.8 с/24px), все hover в перечисленных файлах ссылаются на токены.
