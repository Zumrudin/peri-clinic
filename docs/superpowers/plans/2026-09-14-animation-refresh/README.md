# Анимационный рефреш — планы реализации

Спецификация: `docs/superpowers/specs/2026-09-14-animation-refresh-design.md`.
Все планы написаны для исполнителя без контекста: точные файлы, текущий код, целевой код, проверка.
Значения кривых и длительностей брать только из планов, не «улучшать» по памяти.

## Планы

| № | Файл | Название | Серьёзность | Статус |
| --- | --- | --- | --- | --- |
| 001 | `001-motion-tokens-and-reveal.md` | Единые токены движения, мягкий `.reveal` со стаггером | HIGH | DONE |
| 002 | `002-contact-sheet-symmetric.md` | Лист записи: симметричный вход и выход | HIGH | DONE |
| 003 | `003-sticky-header-hysteresis.md` | Sticky-шапка без дёрганья: гистерезис, без анимации `height` | MEDIUM | DONE |
| 004 | `004-mobile-menu-easing.md` | Мобильное меню: вход медленнее выхода, бургер только на `transform` | MEDIUM | DONE |
| 005 | `005-reduced-motion-gentle.md` | Reduced-motion: убрать движение, оставить отклик | MEDIUM | DONE |
| 006 | `006-hover-gating-touch.md` | Hover-движение только для мыши, убрать `backdrop-filter` из hover | MEDIUM | DONE |
| 007 | `007-details-accordion.md` | Аккордеоны FAQ и цен: плавное раскрытие | MEDIUM | DONE |
| 008 | `008-view-transitions.md` | Кросс-фейд между страницами (Astro ClientRouter) | LOW | DONE |
| 009 | `009-press-feedback.md` | Отклик на нажатие для кнопок и ссылок-действий | MEDIUM | DONE |
| 010 | `010-cookie-notice-enter-exit.md` | Плашка cookie: вход и выход с нижнего края | LOW | DONE |
| 011 | `011-lightbox-media-dialog.md` | Лайтбокс и медиа-диалог: вход, выход, смена фото | MEDIUM | DONE |
| 012 | `012-hero-photo-settle.md` | Фото первого экрана: одно медленное «оседание» | LOW | DONE |

## Рекомендуемый порядок

001 → 002 → 009 → 007 → 003 → 004 → 006 → 005 → 010 → 011 → 012 → 008.

Зависимости:

- Все планы после 001: используют токены `--ease-out` (новое значение), `--ease-drawer`, `--dur-press`, `--dur-reveal`.
- 005 после 002, 007, 010, 011: глобальное правило reduced-motion в 005 рассчитано на transitions из этих планов и деградирует их до fade.
- 008 строго последним: переписывает инициализацию всех скриптов, нужна полная регрессия. Его можно отложить или не делать.
- 009 и 006 трогают одни и те же hover-правила в `src/styles/base.css`: делать по очереди, не параллельно.

## Рабочий цикл на каждый план (ветка → сборка стенда → подтверждение)

Стенд `https://peri.zumrudin.ru` отдаёт `/srv/peri/current`. Клон `/srv/peri/site` смотрит на
`origin = /root/peri-clinnic.ru`, поэтому пушить никуда не нужно: достаточно коммита в локальной ветке.

1. Один раз: `git switch -c feat/animation-refresh main` в `/root/peri-clinnic.ru`.
2. Реализовать план целиком по шагам. Не смешивать два плана в одном коммите.
3. Локальная проверка:
   ```bash
   . ~/.nvm/nvm.sh && nvm use 22
   npm run check && npm test && npm run build
   ```
4. Коммит: `feat: animation NNN — <название плана>` (+ строка `Co-Authored-By`, если требуется).
5. Пересобрать стенд из ветки (сборка 2–4 минуты, лог в stdout):
   ```bash
   GIT_REF=origin/feat/animation-refresh bash /srv/peri/site/deploy/rebuild/build.sh
   ```
6. Скриншоты для отчёта (статичные, с `reducedMotion: reduce`, движение на них не видно):
   ```bash
   node scripts/qa/screenshots.mjs https://peri.zumrudin.ru docs/qa/animation-refresh/NNN / /volnewmer /result /uslugi-i-ceny
   ```
   Скопировать в `/var/www/peri-concepts/animation-refresh-NNN/` и дать ссылки
   `https://dev.zumrudin.ru/peri-concepts/animation-refresh-NNN/<файл>.png` (проверить `curl -I`, статус 200).
7. Прислать заказчику: что изменилось, где смотреть на стенде, что именно проверять глазами (раздел «Проверка на глаз» плана). Ждать подтверждения.
8. После подтверждения обновить статус в этой таблице (`DONE`), перейти к следующему плану.
9. Если заказчик отклонил: `git revert` коммита плана, статус `REJECTED`, пересобрать стенд.

Примечание: пока ветка лежит в `/srv/peri/site`, вебхук Directus при правках контента будет пересобирать
стенд из этой же ветки (без `GIT_REF` скрипт не переключает ref). Для дев-стенда это нормально.

## Завершение

После подтверждения всех планов: `git switch main && git merge --no-ff feat/animation-refresh`,
затем `GIT_REF=origin/main bash /srv/peri/site/deploy/rebuild/build.sh`. Финальные скриншоты
375/800/1440 сохранить в `docs/qa/animation-refresh/final/`.
