# План

1. Добавить CMS-тексты, отдельное согласие и обновить только раздел 7 политики с резервной копией.
2. Объединить UI и запуск Метрики в одном контроллере, добавить настройки в footer.
3. Проверить браузером с подменённым счётчиком: отсутствие запросов до согласия, отказ, повторный вход, отзыв, гонка загрузки, legacy/повреждённый/просроченный выбор, блокировка storage, вкладки, Astro navigation, доступность и мобильная вёрстка.
4. Проверить Astro check/build; перенести только scoped source, миграция запускает штатную автосборку. Проверить production без реального отправления аналитики.

## Выполнение

- CMS dev: отдельная опубликованная страница согласия, json-тексты banner в singleton, замена только раздела 7 политики. Backup до каждой записи; архив согласия на справку не менялся.
- `npm run check`: 0 errors, 0 warnings (346 hints); `npm run build`: 45 страниц.
- `scripts/qa/cookie-analytics.mjs`: 23 проверки, fake counter вместо реальной отправки. Проверены 375/800/1440 и axe (0 serious/critical). При тестировании исправлено перекрытие footer мобильной CTA-панелью.
- `scripts/qa/certificate-consent.mjs`: PASS, реальных заявок нет.
- SEO dev после полной сборки: два замечания вне этой задачи — отсутствует description у /spravka и демонстрационное metadata у /specialisty/gadzhieva; source этих страниц не изменялся. Production проходит отдельную штатную SEO-проверку перед переключением релиза.
- Production: scoped backup `/srv/peri/backups/cookie-20260928`, source staged; migration 27 выполнена с admin login, номер счётчика пуст. Штатная автосборка после CMS mutation, без параллельного ручного build.
- Production опубликован: `/srv/peri/releases/2026-09-28T20-50-56`. Штатный SEO: 45 pages, 44 sitemap URLs, 0 errors, 0 warnings.
- Production browser QA: все 23 проверки PASS, включая mobile settings; счётчик подменён в браузере, реальных отправок в Яндекс нет. HTTP GET /politika, /soglasie-analitika-2026-09-28 и /spravka: 200, настройки присутствуют, старый текст о согласии через продолжение просмотра отсутствует.

## Подключение счётчика (2026-09-29)

- Production CMS: `site_settings.metrika_id` = `99099738` (admin login; build-token только на чтение). Backup записи до изменения: `scripts/migrate/out/cookie-analytics-backups/prod-settings-before-metrika-*.json`. Dev CMS оставлен без счётчика намеренно, чтобы стенд не засорял статистику.
- Штатная автосборка через Flow: релиз `/srv/peri/releases/2026-09-29T22-02-03`, SEO 45 pages / 44 sitemap / 0 errors.
- `scripts/qa/metrika-live.mjs` (реальный счётчик, несколько настоящих хитов): 15/15 PASS — до согласия запросов к mc.yandex нет; после «Разрешить» tag.js 200, `/watch/99099738` 302→200, hit при SPA-переходе, отзыв ставит `disableYaCounter`, чистит `_ym_*` и прекращает хиты; отказ — запросов нет, баннер не возвращается.
- `scripts/qa/cookie-analytics.mjs` на production: 23/23 PASS. Fixture «No counter» теперь сам вырезает счётчик из HTML, потому что на проде он настоящий.
