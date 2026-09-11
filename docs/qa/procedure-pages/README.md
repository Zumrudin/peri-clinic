# Проверка страниц процедур — 11.09.2026

Ветка: `feat/procedure-pages-unified-style`. Проверка выполнена в отдельном worktree `/root/peri-procedure-pages` с реальным содержимым Directus.

- Production build: 39 страниц, успешно.
- `npm test`: 5/5.
- `node scripts/qa/procedure-pages.mjs http://127.0.0.1:4346`: все 20 страниц процедур/аппаратов на 320, 375, 800, 1440 px. Проверены загрузка изображений, один H1, цели якорей, открытие окна записи и отсутствие выхода контента/нижних кнопок за границы экрана.
- `scripts/qa/check-links.mjs`: 39 страниц, битых внутренних ссылок нет.
- Axe: `/konturnaya-plastika`, `/kosemotologicheskie-pilingi`, `/volnewmer` — 0 нарушений.
- `npm run check`: 6 ошибок nullable-изображений в неизменённых компонентах главной (`Approach`, `Cases`, `Categories`, `Cta`, `Devices`, `Hero`). В изменённых файлах ошибок нет. Для запуска локально установлены `@astrojs/check` и `typescript` без изменения manifest/lockfile.

Скриншоты: три представительных страницы на 375, 800 и 1440 px. Медиа и тексты поступают из CMS; медицинские утверждения в рамках оформления не редактировались.
