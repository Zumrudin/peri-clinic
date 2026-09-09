# Directus: роли и доступ

## База данных

Postgres на управляемом инстансе Beget (`googugiherie.beget.app`), тот же сервер, что и у
LoyalPro, но **отдельная база** (`periclinic`) и **отдельный SSH-туннель**:
`peri-db-tunnel.service` (`deploy/systemd/peri-db-tunnel.service`) держит
`127.0.0.1:5434 → googugiherie.beget.app:5432` через `root@217.114.0.254`. Отдельный туннель
нужен, чтобы падение/рестарт туннеля LoyalPro не роняло админку Peri, и наоборот.

Почему не SQLite: локальный SQLite-файл требовал пересборки нативного модуля `sqlite3` из
исходников под конкретную glibc (см. ниже) — хрупко и пришлось бы повторять на продакшен-сервере.
Postgres на Beget — уже готовая, российская, управляемая инфраструктура, и это официально
рекомендуемая Directus база для продакшена. Драйвер `pg` — чистый JS, без нативной сборки.
Эта же база остаётся постоянной и после переезда сайта на выделенный российский VPS — туда
переедут только Astro и Directus (через тот же туннель), не сама БД.

Восстановление из бэкапа (`deploy/backup.sh`, дамп в `pg_dump -Fc`):

```bash
PGPASSWORD=... pg_restore -h 127.0.0.1 -p 5434 -U periclinic -d periclinic --clean --if-exists \
  /srv/peri/backups/<дата>/data.dump
```

| Роль | Политика | Доступ |
|---|---|---|
| Administrator | (встроенная) | всё; только разработчик |
| Редактор | «Редактор: контент» | вход в админку; создание/правка/удаление во всех контентных коллекциях и файлах; правка «Настройки сайта»; журнал публикаций — только чтение |
| Builder | «Builder: сборка сайта» | без входа в админку; статический токен пользователя `builder@peri-clinic.ru`; чтение контента и файлов, запись в `build_log` |

## Как применить (после `directus bootstrap`)

```bash
cd /root/peri-clinnic.ru
DIRECTUS_URL=http://127.0.0.1:8055 DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... \
  node directus/setup/schema.mjs && node directus/setup/roles.mjs && node directus/setup/flows.mjs
```

`roles.mjs` печатает токен Builder один раз — положить в `/srv/peri/site.env` (`DIRECTUS_TOKEN`) и `/srv/peri/rebuild/.env`.

## Снимок схемы

После изменений схемы обновить `directus/snapshot.yaml`:

```bash
cd /srv/peri/directus && npx directus schema snapshot --yes /root/peri-clinnic.ru/directus/snapshot.yaml
```

## Известные ограничения открытой версии Directus 12

- **Права с ограничением полей/валидацией/пресетами — платная функция.** Открытая (не
  Enterprise/Cloud) сборка Directus 12 блокирует «кастомные» правила доступа с ошибкой
  `custom_permission_rules_enabled is a restricted resource` — разрешён только полный доступ
  ко всем полям коллекции (`fields: ['*']`, без `validation`/`presets`). Поэтому `roles.mjs`
  не ограничивает список полей `directus_users` для «Редактора» — пароль/токен всё равно
  скрываются самим Directus независимо от прав.
- **SQLite — один писатель** (актуально, только пока стенд был на SQLite; на Postgres не
  воспроизводится, но исправление осталось в коде). Параллельные запросы на запись
  (например, `Promise.all` с несколькими `DELETE`) иногда падали с блокировкой базы.
  Скрипты в `directus/setup/` выполняют такие операции последовательно или одним
  bulk-запросом — это не мешает и на Postgres.
- **По умолчанию Flows не могут дёргать localhost.** `IMPORT_IP_DENY_LIST` по умолчанию
  равен `["0.0.0.0", "169.254.169.254"]` — значение `0.0.0.0` заставляет Directus заблокировать
  операцию `request` (и импорт файлов по URL) на **все собственные сетевые интерфейсы**,
  включая `127.0.0.1`. Это защита от SSRF, но она же ломает наш локальный вебхук пересборки:
  запрос падает ещё до открытия TCP-сокета, без ошибки в логах (Flow просто «завершается» с
  пустым результатом). Исправлено в `deploy/directus.env.example`:
  `IMPORT_IP_DENY_LIST=169.254.169.254` (оставляем блокировку облачного metadata-адреса,
  убираем блокировку loopback — мы сознательно обращаемся к своему же серверу).
