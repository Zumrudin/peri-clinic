# Directus: роли и доступ

## База данных

Postgres 16 на управляемом инстансе Beget (`googugiherie.beget.app`), тот же сервер, что и у
LoyalPro, но **отдельная база** (`peri_clinic_site`, роль без `CREATEDB`/`SUPERUSER` — обычное
ограничение управляемого хостинга) и **отдельный SSH-туннель**: `peri-db-tunnel.service`
(`deploy/systemd/peri-db-tunnel.service`) держит `127.0.0.1:5434 → googugiherie.beget.app:5432`
через `root@217.114.0.254`. Отдельный туннель нужен, чтобы падение/рестарт туннеля LoyalPro не
роняло админку Peri, и наоборот. Мигрировали со стендового SQLite на эту базу 2026-09-09,
данные в SQLite были тестовыми — просто сделали `directus bootstrap` заново; старый файл лежит
в `/srv/peri/backups/pre-postgres-sqlite.db` на всякий случай.

Почему не SQLite: локальный SQLite-файл требовал пересборки нативного модуля `sqlite3` из
исходников под конкретную glibc (см. ниже) — хрупко и пришлось бы повторять на продакшен-сервере.
Postgres на Beget — уже готовая, российская, управляемая инфраструктура, и это официально
рекомендуемая Directus база для продакшена. Драйвер `pg` — чистый JS, без нативной сборки.
Эта же база остаётся постоянной и после переезда сайта на выделенный российский VPS — туда
переедут только Astro и Directus (через тот же туннель), не сама БД.

**Прод и стенд с 2026-09-16 (фаза 8):** продакшен на `217.114.0.254` ходит в ту же базу
напрямую (без туннеля, TLS с закреплённым корневым CA Beget — см. `deploy/directus.env.example`)
и работает в схеме **`public`**. Стенд переведён в отдельную схему **`dev`** той же базы
(`DB_SEARCH_PATH=dev` в `/srv/peri/directus/.env`): роль не имеет `CREATEDB`, вторую базу
может создать только панель Beget, а схему — мы сами. `dev` — копия `public` на момент
переключения (дамп `pg_dump --schema=public` с переписанным префиксом схемы, восстановлен одной
транзакцией; таблицы, строки и sequence сверены 1:1; исходники в
`/srv/peri/backups/dev-schema-2026-09-16T17-02-32/`). Правки редакторов на стенде **не
попадают** на прод и наоборот. Бэкап `deploy/backup.sh` снимает всю базу целиком — обе схемы.
Если когда-нибудь появится вторая база от Beget, достаточно восстановить туда `dev` и убрать
`DB_SEARCH_PATH`.

**Важно про версию клиента:** сервер — Postgres 16.x, а Ubuntu 22.04 из коробки ставит
`postgresql-client` версии 14 — `pg_dump`/`pg_restore` при таком рассинхроне версий отказываются
работать («server version mismatch»). Нужен официальный репозиторий PGDG:

```bash
install -d /usr/share/postgresql-common/pgdg
curl -sSf -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
apt-get update && apt-get install -y postgresql-client-16
```

Восстановление из бэкапа (`deploy/backup.sh`, дамп в `pg_dump -Fc`):

```bash
PGPASSWORD=... pg_restore -h 127.0.0.1 -p 5434 -U peri_clinic_site -d peri_clinic_site --clean --if-exists \
  /srv/peri/backups/<дата>/data.dump
```

Тренировка восстановления **пройдена не «на словах»**: роль без `CREATEDB` не может поднять
отдельную временную базу, поэтому дамп конвертировали в текстовый SQL (`pg_restore -f`),
подставили схему `drill_restore` вместо `public` и прогнали через `psql` в ту же базу —
таблицы и счётчики строк (`directus_fields`, `directus_collections`, `directus_users`)
совпали с оригиналом 1:1, временную схему удалили. Если понадобится настоящее
изолированное восстановление (не в той же БД), нужна либо вторая схема/база от Beget, либо
временный грант `CREATEDB` на роль.

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
