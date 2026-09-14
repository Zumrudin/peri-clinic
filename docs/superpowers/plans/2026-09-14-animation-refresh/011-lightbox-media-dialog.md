# 011 — Лайтбокс и медиа-диалог: вход, выход, смена фото

- **Status**: DONE
- **Commit**: d5cff2a
- **Severity**: MEDIUM
- **Category**: Missed opportunities (preventing a jarring change), Physicality
- **Estimated scope**: 3 файла (`Lightbox.astro`, `SpecialistMedia.astro`, `photo-gallery.ts`), ~50 строк

## Проблема

Оба `<dialog>` открываются `showModal()` мгновенно: экран заливается тёмным за один кадр, закрытие тоже
мгновенное. В лайтбоксе при листании `image.src = …` подменяет фото рывком.

```css
/* src/components/gallery/Lightbox.astro:15 — сейчас */
  .photo-lightbox { padding:0; border:0; width:100vw; max-width:none; height:100dvh; max-height:none; background:#171715; color:white; overflow:hidden; }
  .photo-lightbox::backdrop { background:rgba(20,20,18,.94); }
  ...
  figure { margin:0; max-width:100%; text-align:center; pointer-events:none; }
```

```css
/* src/components/gallery/SpecialistMedia.astro:65 — сейчас */
  .media-dialog { width:min(1100px,calc(100% - 32px)); max-height:calc(100dvh - 32px); padding:64px 24px 24px; border:1px solid var(--line-gold); border-radius:var(--radius); background:var(--paper); color:var(--ink); }
  .media-dialog::backdrop { background:rgba(36,36,31,.8); }
```

```ts
// src/scripts/photo-gallery.ts:16 — сейчас
  const show = (target: number) => {
    index = (target + active.length) % active.length;
    const photo = active[index];
    dialog.classList.toggle('is-portrait', photo.dataset.portrait === 'true' || !!photo.closest('.portraits'));
    error.hidden = true;
    image.src = photo.href;
```

## Цель

Тот же паттерн, что в плане 002: transitions + `@starting-style` + `allow-discrete`. Диалог и backdrop —
opacity за `--dur-fast`; фигура/контент — `scale(0.97)` → 1 за `--dur-fast` на `--ease-out`, выход симметричный.
Смена фото — короткий «выход из дымки» по событию `load`.

```css
/* src/components/gallery/Lightbox.astro — цель (добавить к существующим строкам, не удаляя их) */
  /* Enter/exit as transitions (see ContactSheet.astro for the pattern); browsers without
     @starting-style open instantly, as before. */
  .photo-lightbox { opacity:0; transition: opacity var(--dur-fast) var(--ease-out), display var(--dur-fast) allow-discrete, overlay var(--dur-fast) allow-discrete; }
  .photo-lightbox[open] { opacity:1; }
  @starting-style { .photo-lightbox[open] { opacity:0; } }
  .photo-lightbox::backdrop { opacity:0; transition: opacity var(--dur-fast) var(--ease-out), display var(--dur-fast) allow-discrete, overlay var(--dur-fast) allow-discrete; }
  .photo-lightbox[open]::backdrop { opacity:1; }
  @starting-style { .photo-lightbox[open]::backdrop { opacity:0; } }
  figure { transform:scale(0.97); transition: transform var(--dur-fast) var(--ease-out); }
  .photo-lightbox[open] figure { transform:none; }
  @starting-style { .photo-lightbox[open] figure { transform:scale(0.97); } }
```

```css
/* src/components/gallery/SpecialistMedia.astro — цель (добавить) */
  .media-dialog { opacity:0; transform:scale(0.97); transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), display var(--dur-fast) allow-discrete, overlay var(--dur-fast) allow-discrete; }
  .media-dialog[open] { opacity:1; transform:none; }
  @starting-style { .media-dialog[open] { opacity:0; transform:scale(0.97); } }
  .media-dialog::backdrop { opacity:0; transition: opacity var(--dur-fast) var(--ease-out), display var(--dur-fast) allow-discrete, overlay var(--dur-fast) allow-discrete; }
  .media-dialog[open]::backdrop { opacity:1; }
  @starting-style { .media-dialog[open]::backdrop { opacity:0; } }
```

```ts
// src/scripts/photo-gallery.ts — цель: после `image.addEventListener('error', …)` добавить
  // Browsers keep the previous photo painted until the next one decodes, so a full crossfade
  // needs no second layer: a short lift out of a blur on `load` is enough to soften the swap.
  image.addEventListener('load', () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    image.animate(
      [{ opacity: 0.6, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0)' }],
      { duration: 200, easing: EASE_OUT },
    );
  });
```

(`EASE_OUT` — константа из плана 001. Если план 001 не выполнен, объявить
`const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';` в начале файла.)

Reduced-motion: глобальное правило плана 005 уберёт `transform`, оставит fade; JS-ветка выше отключает дымку.

## Конвенции репозитория

- CSS в этих двух компонентах написан в одну строку на правило — сохранить стиль.
- Паттерн диалога — тот же, что в `ContactSheet.astro` после плана 002; не изобретать другой.

## Шаги

1. `Lightbox.astro`: добавить целевые правила после существующих `.photo-lightbox`/`figure`.
2. `SpecialistMedia.astro`: добавить целевые правила после `.media-dialog::backdrop`.
3. `photo-gallery.ts`: добавить обработчик `load`.

## Границы

- Логику `open/close`, фокус, свайпы, `overflow` документа не менять.
- `specialist-media.ts` не менять: видео стартует по `play()` как и раньше.
- `figure` в лайтбоксе имеет `pointer-events:none`, img — `auto`: сохранить.

## Проверка

- **Механическая**: `npm run check`, `npm test`, `npm run build`.
- **На глаз** (страница специалиста и блок «Пространство клиники» на главной):
  - Клик по фото: тёмный фон проявляется за 0.25 с, фото подрастает с 0.97 до 1. Esc/клик по фону — обратное движение.
  - Стрелки/свайп в лайтбоксе: новое фото выходит из лёгкой дымки за 0.2 с; предыдущее не мигает чёрным. Если мигает — заменить `opacity: 0.6` на `0.85` и сообщить.
  - Медиа-диалог с видео: открывается с тем же движением, видео начинает играть.
  - Reduced-motion: только fade.
- **Готово, когда**: оба диалога входят и выходят симметрично, смена фото без резкого рывка.
