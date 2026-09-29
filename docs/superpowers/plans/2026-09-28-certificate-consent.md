# План

1. Сопоставить архив, сайт и фактическую схему заявки.
2. Подготовить snapshot отдельного согласия и узкие изменения политики, CMS migration с backup.
3. Изменить форму Astro и iframe LoyalPro: отдельное подтверждение, политика рядом, version/hash.
4. Additive migration JSONB evidence; серверная проверка и запись canonical snapshot.
5. Unit/API tests с моками БД; браузерные проверки без реальных POST; Astro check/build.
6. Выдать HTTPS документы и сравнение. Запросить разрешение на production deploy LoyalPro.

Rollout: сначала документы CMS и проверка SHA на сайте, затем миграция БД+backend+iframe,
затем форма Astro; старые открытые формы отклоняются с понятным требованием обновить страницу.
Проверить /config, несовпадение редакций, новые UI и ссылки без реальных заявок.
Rollback: не удалять JSONB evidence; сохранять архивную страницу согласия и snapshot.
Не возвращать старую форму, пока сервер требует актуальную редакцию; при необходимости
временно приостановить онлайн-форму, сохранив контакты клиники.

## Выполнено

- Архив сопоставлен, включая альтернативные шаблоны № 9 и № 19 из папки ПДН для Роскомнадзора.
- Согласие и политика готовы; /soglashenie заменяется указателем на целевое согласие.
- Local development CMS обновлена миграцией 25 с backup в scripts/migrate/out/certificate-consent-backups/.
- Обе формы и API обновлены в исходниках, подготовлена additive migration consent_document.
- Backend 22 tests pass, browser pass, check 0 errors, build 44 pages.
- Production CMS, backend и БД не обновлялись. Требуется одобрение точного production deploy.

## Production — опубликовано 28.09.2026

Пользователь явно разрешил выпуск на прод. Релиз:
`/srv/peri/releases/2026-09-28T15-25-45` (время сервера MSK), сборка завершена 12:27:21 UTC.

- Сверены целевые файлы с HEAD; доставлены только файлы этой задачи, посторонние правки сохранены.
- Backup: `/srv/peri/backups/consent-20260928/`; старый релиз указан в previous-release.txt.
- CMS migration 25 применена к production с backup исходных записей.
- В production PostgreSQL добавлена nullable JSONB колонка consent_document; тип проверен.
  Строки заявок не изменялись и не заполнялись задним числом.
- Backend/iframe LoyalPro обновлены, 6 targeted tests на production исходниках прошли;
  pm2 loyalpro перезапущен и online. Directus/rebuild также online.
- CMS update запустил автоматическую сборку, пересёкшуюся с ручным candidate build.
  Ручная сборка завершилась ошибкой отсутствующего prerender chunk; автоматическая
  завершилась успешно, SEO 44 страницы / 43 sitemap URL, 0 errors/warnings.
  Повторный ручной выпуск не выполнялся. Релиз переключён штатным build.sh.
- GET /spravka, /politika, /soglashenie, /soglasie-spravka-2026-09-28: 200.
  Текст согласия в live HTML совпадает с snapshot; версия/hash формы совпадают с API.
- Два заведомо невалидных POST без данных пациентов возвращают 400 consent/consent_version.
- `node scripts/qa/cert-request.mjs https://www.peri-clinic.ru docs/qa/certificate-consent/production`: PASS.
  Конфиг получен с production; POST и PDF перехвачены. Реальные заявки не создавались.
