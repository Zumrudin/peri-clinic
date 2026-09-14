# 002 — Лист записи: симметричный вход и выход

- **Status**: TODO
- **Commit**: d5cff2a
- **Severity**: HIGH
- **Category**: Interruptibility, Physicality & origin
- **Estimated scope**: 1 файл (`src/components/shell/ContactSheet.astro`), ~50 строк CSS

## Проблема

Диалог `#contact-sheet` — главная конверсионная поверхность (все «Записаться»). Вход сделан keyframes,
выход отсутствует: `dialog.close()` схлопывает панель и фон за один кадр. Keyframes не прерываемы
(быстрое открыть/закрыть стартует с нуля), backdrop появляется мгновенно.

```css
/* src/components/shell/ContactSheet.astro:108 — сейчас */
  .sheet::backdrop {
    background: rgba(36, 36, 31, 0.55);
    backdrop-filter: blur(4px);
  }
  .sheet[open] {
    display: grid;
    place-items: center;
  }
  .sheet__panel {
    position: relative;
    width: min(440px, calc(100% - 32px));
    background: var(--paper);
    padding: 40px 36px 30px;
    border-radius: var(--radius);
    box-shadow: 0 30px 80px rgba(20, 18, 12, 0.25);
    animation: sheetIn 0.3s var(--ease-out) both;
  }
```

```css
/* src/components/shell/ContactSheet.astro:209 — сейчас */
  @keyframes sheetIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: none; }
  }
  @media (max-width: 800px) {
    ...
    .sheet__panel {
      width: 100%;
      border-radius: 14px 14px 0 0;
      padding: 14px 20px calc(24px + env(safe-area-inset-bottom));
      animation-name: sheetUp;
    }
    ...
    @keyframes sheetUp {
      from { transform: translateY(100%); }
      to { transform: none; }
    }
  }
```

## Цель

Transitions вместо keyframes, `@starting-style` для входа, `transition-behavior: allow-discrete`
для выхода (`display`/`overlay`). Десктоп: панель входит из `translateY(12px) scale(0.97)` + opacity
за 0.4 с на `--ease-drawer`, выходит туда же за `--dur-fast` на `--ease-out`. Мобильный: панель
входит из `translateY(100%)` за 0.4 с на `--ease-drawer`, выходит тем же краем за `--dur-fast`.
Backdrop: opacity 0 → 1 за `--dur-fast` в обе стороны. Браузеры без `@starting-style` получают
мгновенное открытие, как сейчас.

```css
/* цель — заменяет блок .sheet::backdrop … .sheet__panel */
  /* Enter/exit are CSS transitions, not keyframes: a transition retargets mid-way when the
     user taps open/close quickly, and `allow-discrete` keeps the dialog painted while it
     leaves. Browsers without @starting-style fall back to an instant open (today's behavior). */
  .sheet {
    transition:
      display var(--dur-fast) allow-discrete,
      overlay var(--dur-fast) allow-discrete;
  }
  .sheet::backdrop {
    background: rgba(36, 36, 31, 0.55);
    backdrop-filter: blur(4px);
    opacity: 0;
    transition:
      opacity var(--dur-fast) var(--ease-out),
      display var(--dur-fast) allow-discrete,
      overlay var(--dur-fast) allow-discrete;
  }
  .sheet[open]::backdrop {
    opacity: 1;
  }
  @starting-style {
    .sheet[open]::backdrop {
      opacity: 0;
    }
  }
  .sheet[open] {
    display: grid;
    place-items: center;
  }
  .sheet__panel {
    position: relative;
    width: min(440px, calc(100% - 32px));
    background: var(--paper);
    padding: 40px 36px 30px;
    border-radius: var(--radius);
    box-shadow: 0 30px 80px rgba(20, 18, 12, 0.25);
    /* closed state = exit target; exit is the faster leg */
    opacity: 0;
    transform: translateY(12px) scale(0.97);
    transition:
      opacity var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }
  .sheet[open] .sheet__panel {
    opacity: 1;
    transform: none;
    transition:
      opacity 0.4s var(--ease-drawer),
      transform 0.4s var(--ease-drawer);
  }
  @starting-style {
    .sheet[open] .sheet__panel {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
    }
  }
```

```css
/* цель — внутри @media (max-width: 800px), вместо animation-name и @keyframes sheetUp */
    .sheet__panel {
      width: 100%;
      border-radius: 14px 14px 0 0;
      padding: 14px 20px calc(24px + env(safe-area-inset-bottom));
      opacity: 1;
      transform: translateY(100%);
    }
    .sheet[open] .sheet__panel {
      transform: none;
    }
    @starting-style {
      .sheet[open] .sheet__panel {
        opacity: 1;
        transform: translateY(100%);
      }
    }
```

Reduced-motion (внутри того же файла, в конце `<style>`):

```css
  @media (prefers-reduced-motion: reduce) {
    .sheet__panel,
    .sheet[open] .sheet__panel {
      transform: none;
      transition: opacity var(--dur-fast) var(--ease-out);
    }
    @starting-style {
      .sheet[open] .sheet__panel {
        transform: none;
        opacity: 0;
      }
    }
  }
```

## Конвенции репозитория

- Токены `--ease-drawer`, `--ease-out`, `--dur-fast` из `src/styles/tokens.css` (план 001 должен быть выполнен).
- Комментарии в CSS объясняют «почему» (см. комментарий к `.glass-panel` в `src/styles/base.css`).
- JS (`src/scripts/contact-sheet.ts`) не менять: `showModal()`/`close()` сами переключают `[open]`.

## Шаги

1. В `src/components/shell/ContactSheet.astro` заменить правила `.sheet::backdrop`, `.sheet[open]`, `.sheet__panel`
   на целевой блок (добавив правило `.sheet` с `display`/`overlay` transitions).
2. Удалить `@keyframes sheetIn` целиком.
3. Внутри `@media (max-width: 800px)`: у `.sheet__panel` убрать `animation-name: sheetUp;`, добавить
   `opacity: 1; transform: translateY(100%);`, добавить правила `.sheet[open] .sheet__panel` и `@starting-style`.
   Удалить `@keyframes sheetUp`.
4. Добавить блок `@media (prefers-reduced-motion: reduce)` в конец `<style>`.

## Границы

- Не менять разметку диалога, `src/scripts/contact-sheet.ts`, класс `body.sheet-open`.
- Не трогать `.sheet__row:hover` и прочие цветовые transitions.
- Не добавлять JS-таймеры для «ожидания анимации перед close()»: выход целиком на CSS.
- Если код не совпадает с «сейчас», остановиться и сообщить.

## Проверка

- **Механическая**: `npm run check`, `npm run build` без ошибок; `grep -n "@keyframes" src/components/shell/ContactSheet.astro` пусто.
- **На глаз** (стенд, Chrome и Safari, DevTools → Animations → 10 %):
  - Десктоп: панель поднимается на 12px и растёт с 0.97 до 1 за 0.4 с, фон темнеет одновременно; закрытие быстрее (0.25 с) и по тому же пути вниз.
  - Мобильный (375): лист выезжает снизу, «садится» без отскока; закрытие тапом по фону уезжает вниз, а не исчезает.
  - Быстро нажать «Записаться» и сразу Esc: панель разворачивается из текущей точки, не прыгает в начало.
  - Rendering → Emulate `prefers-reduced-motion: reduce`: только fade, без сдвига.
- **Готово, когда**: вход и выход симметричны на обоих брейкпоинтах, keyframes в файле нет.
