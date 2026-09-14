# 009 — Отклик на нажатие для кнопок и ссылок-действий

- **Status**: DONE
- **Commit**: d5cff2a
- **Severity**: MEDIUM
- **Category**: Missed opportunities (feedback)
- **Estimated scope**: `src/styles/base.css` + 6 компонентов, ~30 строк

## Проблема

Ни у одной кнопки нет `:active`-состояния. На десктопе есть hover-подъём, на таче — ничего: нажатие
не подтверждается. Частота — десятки раз в день, поэтому отклик должен быть едва заметным (0.98) и коротким.

```css
/* src/styles/base.css:157 — сейчас */
.button {
  ...
  transition:
    background var(--dur-fast),
    color var(--dur-fast),
    transform var(--dur-fast);
}
.button:hover {
  background: var(--gold-hover);
  border-color: var(--gold-hover);
  transform: translateY(-2px);
}
```

## Цель

```css
/* src/styles/base.css — цель */
.button {
  ...
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-press) var(--ease-out);
}
.button:hover { … без изменений … }
/* Press feedback: subtle (0.98), symmetric 160ms both ways. Declared after :hover so it wins. */
.button:active {
  transform: scale(0.98);
}
.text-link:active span {
  transform: translate(3px, -3px) scale(0.95);
}
```

Круглые кнопки-стрелки и прочие интерактивные элементы — тот же приём в scoped `<style>` компонента:

| Файл | Селектор | Добавить |
| --- | --- | --- |
| `src/components/home/Devices.astro:83` | `.slider-controls button` | в `transition` добавить `transform var(--dur-press) var(--ease-out)`; `.slider-controls button:active { transform: scale(0.94); }` |
| `src/components/gallery/Gallery.astro:33` | `button` | `transition: background var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out);` + `button:active { transform: scale(0.94); }` |
| `src/components/results/ResultsNavigation.astro` и `src/components/home/Cases.astro:240` (десктоп) / `:342` (мобильный) | `.results-navigation button` | `transform var(--dur-press) var(--ease-out)` в transition; `:active:not(:disabled) { transform: scale(0.94); }` |
| `src/components/gallery/Lightbox.astro:22` | `button` | `transition: transform var(--dur-press) var(--ease-out);` + `button:active { transform: scale(0.94); }` |
| `src/components/shell/FloatingContact.astro:26` | `.floating-contact` | `transition: transform var(--dur-press) var(--ease-out);` + `.floating-contact:active { transform: scale(0.97); }` |
| `src/pages/result.astro:90` | `.results-filter__btn` | в transition `transform var(--dur-press) var(--ease-out)`; `:active { transform: scale(0.97); }` |
| `src/components/shell/ContactSheet.astro:163` | `.sheet__row` | `transition: color var(--dur-fast) var(--ease-out), transform var(--dur-press) var(--ease-out);` + `.sheet__row:active { transform: scale(0.99); }` |
| `src/components/shell/MobileCtaBar.astro` | `.mobile-cta-bar__call` | `transition: transform var(--dur-press) var(--ease-out);` + `:active { transform: scale(0.97); }` (`.mobile-cta-bar__book` наследует `.button`) |

Круглые кнопки могут сжиматься сильнее (0.94): они маленькие, 0.98 на 44px не читается.

## Конвенции репозитория

- Токен `--dur-press: 0.16s` из плана 001.
- Не переопределять `.button` в scoped стилях компонентов (правило CLAUDE.md о глобальных утилитах).

## Шаги

1. `src/styles/base.css`: обновить `transition` у `.button`, добавить `.button:active` после `.button:hover`, добавить `.text-link:active span`.
2. Пройти по таблице, добавить `transform` в `transition` и правило `:active` в каждом компоненте.

## Границы

- Не менять hover-значения (план 006 переносит их под медиа-запрос; выполнять планы последовательно).
- Не добавлять `:active` на карточки-ссылки (`.service-card`, `.case-card`): у них уже есть hover-движение, второе движение будет лишним.
- Не добавлять JS.

## Проверка

- **Механическая**: `npm run check`, `npm run build`.
- **На глаз**: зажать «Записаться» мышью: кнопка едва заметно сжимается за 0.16 с, отпустить — возвращается за 0.16 с (симметрично).
  На эмуляции тача (375): тап по стрелке карусели даёт видимое сжатие; после отпускания ничего не «залипает».
  DevTools → Animations → 10 %: `scale` 1 → 0.98 идёт по сильному ease-out.
- **Готово, когда**: все перечисленные элементы реагируют на нажатие, hover-поведение не изменилось.
