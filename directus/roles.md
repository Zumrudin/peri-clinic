# Directus: роли и доступ

| Роль | Политика | Доступ |
|---|---|---|
| Administrator | (встроенная) | всё; только разработчик |
| Редактор | «Редактор: контент» | вход в админку; создание/правка/удаление во всех контентных коллекциях и файлах; правка «Настройки сайта»; журнал публикаций — только чтение |
| Builder | «Builder: сборка сайта» | без входа в админку; статический токен пользователя `builder@peri.local`; чтение контента и файлов, запись в `build_log` |

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
