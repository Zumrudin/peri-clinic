# Directus: роли и доступ

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
- **SQLite — один писатель.** Параллельные запросы на запись (например, `Promise.all` с
  несколькими `DELETE`) иногда падают с блокировкой базы. Скрипты в `directus/setup/`
  выполняют такие операции последовательно или одним bulk-запросом.
- **По умолчанию Flows не могут дёргать localhost.** `IMPORT_IP_DENY_LIST` по умолчанию
  равен `["0.0.0.0", "169.254.169.254"]` — значение `0.0.0.0` заставляет Directus заблокировать
  операцию `request` (и импорт файлов по URL) на **все собственные сетевые интерфейсы**,
  включая `127.0.0.1`. Это защита от SSRF, но она же ломает наш локальный вебхук пересборки:
  запрос падает ещё до открытия TCP-сокета, без ошибки в логах (Flow просто «завершается» с
  пустым результатом). Исправлено в `deploy/directus.env.example`:
  `IMPORT_IP_DENY_LIST=169.254.169.254` (оставляем блокировку облачного metadata-адреса,
  убираем блокировку loopback — мы сознательно обращаемся к своему же серверу).
