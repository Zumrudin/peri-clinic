# Фаза 8 — продакшен на VPS 217.114.0.254 (Beget)

Дата анализа: 2026-09-16. Сервер — тот же, где живёт LoyalPro (`zumrudin.ru`, `forma.zumrudin.ru`).
Доступ: `ssh root@217.114.0.254` по ключу `~/.ssh/id_ed25519` с dev-машины (`MyFinLandVPS`, 89.125.92.223).
Всё ниже собрано только чтением: на проде ничего не менялось.

## 1. Что на сервере сейчас

| Параметр | Значение |
|---|---|
| Хостинг / ОС | Beget VPS (`beget-agent`), Ubuntu 24.04.3 LTS, uptime 160 дней |
| CPU / RAM / swap | 2 vCPU, **1.9 ГБ RAM, swap нет**; занято ~650 МБ, доступно ~1.3 ГБ |
| Диск | 29 ГБ, свободно 16 ГБ (44 %), inode 6 % |
| Сеть | eth0 217.114.0.254 (только IPv4, глобального IPv6 нет), eth1 10.16.0.2/16 (внутренняя сеть Beget) |
| Node | системный 20.20.2, nvm — только v20.20.1. **Node 22 нет** (Directus 12 его требует) |
| pm2 | 6.0.14, `pm2-root.service` включён; процесс `loyalpro` (`/root/loyalpro_new/backend`, порт 3001, ~115 МБ) |
| nginx | 1.24.0 (Ubuntu), http2 есть, **модуля brotli нет**; `nginx -t` OK |
| certbot | есть, `certbot.timer` активен; сертификаты LE: `zumrudin.ru`+`www` (до 18.11), `forma.zumrudin.ru` (до 16.11) |
| ufw | active: 22, 80, 443, **8081, 8082** |
| fail2ban | jail `sshd` |
| sshd | только ключи (`PasswordAuthentication no`, `PermitRootLogin without-password`), 4 ключа в authorized_keys |
| TZ | Europe/Moscow |
| Postgres | локального нет; Beget managed `googugiherie.beget.app:5432` (PG 16.4) доступен напрямую, LoyalPro ходит туда с `DB_SSL=true`. `postgresql-client-16` есть в apt (16.15) |
| Интернет наружу | registry.npmjs.org, nodejs.org, github.com, apt.postgresql.org — доступны |
| Инструменты | rsync, python3, git есть; psql/pg_dump/autossh/brotli — нет |

Другие жильцы (systemd, каталог `/root/bot_project`, ~400 МБ): `mybot.service` (Telegram-бот YClients, ~67 МБ),
`birthday_bot.service` (~51 МБ), `peri_admin.service` (`admin_panel.py`, 127.0.0.1:8081, ~47 МБ).

nginx-вхосты (`/etc/nginx/sites-enabled/`):

- `zumrudin` — `zumrudin.ru`/`www` → upstream `loyalpro_backend` (127.0.0.1:3001). Здесь же объявлен сам `upstream loyalpro_backend` — в наших конфигах его повторно объявлять нельзя.
- `forma-zumrudin.conf` — форма заявки на справку → тот же upstream. Наш сниппет `peri-cert-request.conf` проксирует на `https://forma.zumrudin.ru`, т. е. на проде — на эту же машину через публичный IP; работает, менять не обязательно.
- `yclients_main` — `server_name 217.114.0.254`, порт 80, вебхуки YClients на 8080 (старая система, процесса нет) и 3001.
- `zz-diagtest.conf` — **временные** тест-вхосты от 04.08 (`lp-test.*.sslip.io`), помечены «удалить после диагностики».

Свободны нужные нам порты: 8055 (Directus), 8787 (rebuild).

### Найденные проблемы прода (не наши, но влияют на запуск)

1. **Публичный `python3 -m http.server 8082`** из `/tmp/probe` (pcap-дампы, `big.bin`, 271 МБ) — диагностический хвост с 11.08, открыт в ufw на весь интернет. Убрать процесс и правило ufw (и 8081 — сервис слушает только localhost, правило бесполезно).
2. **Нет swap** при 1.9 ГБ RAM. Сборка Astro с обработкой ~280 картинок (sharp) плюс Directus (~280 МБ на стенде) поверх LoyalPro и ботов — реальный риск OOM-kill, причём убить может и `loyalpro`. Нужен swapfile 2 ГБ до первой сборки.
3. `ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3` глобально в `nginx.conf` — стоит ужать до 1.2/1.3 (касается и LoyalPro; поднять с владельцем).
4. `zz-diagtest.conf` и бэкапы `zumrudin.bak-*` в `sites-available` — мусор от диагностики.
5. `unattended-upgrades` без автоперезагрузки — нормально, но kernel-обновления копятся (160 дней uptime).

## 2. Что нужно peri-сайту (снято со стенда)

| Компонент | Стенд (89.125.92.223) | Требование к проду |
|---|---|---|
| Directus 12.3.1 | pm2 `peri-directus`, **277 МБ RSS**, Node 22 | то же; `max_memory_restart 600M` в ecosystem |
| Rebuild-приёмник | pm2 `peri-rebuild`, 43 МБ, порт 8787 | то же |
| Сборка Astro 7 | ~1 мин 10 с при тёплом кэше картинок (2 vCPU), пик RSS — см. §2.1 | swap + постоянный `ASTRO_CACHE_DIR` |
| БД | `peri_clinic_site` на Beget PG 16.4, **17 МБ**, 132 файла, 3 пользователя; со стенда — через SSH-туннель **через сам прод** (`peri-db-tunnel.service`, 127.0.0.1:5434) | прямое подключение `DB_HOST=googugiherie.beget.app`, `DB_SSL=true`, туннель не нужен |
| uploads | 183 МБ / 186 файлов | rsync на прод, id файлов в БД те же |
| node_modules | Directus 713 МБ + сайт 250 МБ | ~1 ГБ диска |
| Релизы | 5 × ~60 МБ | ~300 МБ |
| Бэкапы | 1.2 ГБ (14 копий, hardlink-и) | + rclone в российский S3 |
| Репозиторий | `origin` у `/srv/peri/site` = локальный путь `/root/peri-clinnic.ru`, **внешнего remote нет** | нужен способ доставки кода на прод |

Итого диска: ~2 ГБ + бэкапы. Памяти в покое: +~330 МБ (Directus + rebuild). На пике сборки — см. §2.1.

### 2.1 Пик памяти сборки

Замер `npm run build` на стенде под `/usr/bin/time -v` 2026-09-16 (2 vCPU, тёплый кэш картинок в `node_modules/.astro`):

- Maximum resident set size: **765 МБ** (процесс `astro build`, sharp работает потоками внутри него)
- Время: **1 мин 47 с**

Бюджет памяти прода на пике сборки: 650 МБ (сейчас) + ~330 МБ (Directus + rebuild) + ~800 МБ (сборка) ≈ 1.8 ГБ при 1.9 ГБ физической — практически впритык, а при холодном кэше картинок (первая сборка на проде) пик выше.
Вывод: без swap запускать сборку нельзя; с 2 ГБ swap, `nice -n 10` и лимитом `--max-old-space-size=1024` сборка проходит, LoyalPro не задевается.
Долгосрочно правильнее поднять тариф VPS до 4 ГБ RAM (в спеке фазы 8 заложено 2 vCPU / 4 ГБ).

## 3. DNS и сертификаты

- `peri-clinic.ru` — NS на Wix (`ns6/ns7.wixdns.net`), apex → 3 A-записи Wix, `www` → CNAME `cdn1.wixdns.net`, TTL 3600. MX и TXT пусты (почты на домене нет — переключение ничего не сломает).
- `zumrudin.ru` — NS Beget; `zumrudin.ru`, `forma.zumrudin.ru` → 217.114.0.254.
- Стенд `peri.zumrudin.ru` / `peri-cms.zumrudin.ru` → 89.125.92.223.

Следствия:

1. Пока NS у Wix, записи правятся в панели Wix (Domains → DNS records). Там можно завести **`cms.peri-clinic.ru` заранее** (A → 217.114.0.254) и получить на него сертификат по HTTP-01 до переключения сайта.
2. Для `peri-clinic.ru` + `www` сертификат по HTTP-01 выдаётся только после перевода A-записей. Чтобы не было окна «сайт есть, HTTPS нет», сертификат выпускаем **заранее по DNS-01** (`certbot certonly --manual --preferred-challenges dns`, TXT `_acme-challenge` в Wix DNS). Продление потом переводим на webroot, когда домен уже указывает на прод.
3. Переключение: apex — три A Wix → одна A 217.114.0.254; `www` — CNAME → A 217.114.0.254 (Wix обычно не даёт снизить TTL ниже 3600, поэтому переход растянется до часа; Wix оставляем живым 2 недели, как в спеке).
4. Перенос NS с Wix на регистратора/Beget — отдельный шаг **после** запуска, не в день переключения.

## 4. Решения, которые нужны от заказчика/владельца

| # | Вопрос | Рекомендация |
|---|---|---|
| 1 | Имя CMS на проде | `cms.peri-clinic.ru` (как в спеке) |
| 2 | Что делать со стендом после запуска: он смотрит в ту же БД `peri_clinic_site` | Прод забирает существующую БД (там живой, вычитанный контент). Стенд: либо выключить `peri-directus`/`peri-rebuild`, либо завести в панели Beget вторую БД `peri_clinic_site_dev` и восстановить туда дамп (роль без `CREATEDB`, сама создать не может). Два Directus на одной БД = правки с любой стороны попадают на прод |
| 3 | Доставка кода на прод | bare-репозиторий на проде `/srv/peri/site.git`, dev пушит по SSH, `build.sh` с `GIT_REF` делает `fetch`+`reset`. Альтернатива — приватный GitHub-репо (как у LoyalPro `Zumrudin/loyalpro`) |
| 4 | Гигиена прода (§1: 8082, diag-вхосты, TLS 1.0/1.1, swap) | сделать до запуска, swap — обязательно |
| 5 | RAM | до запуска хватит 2 ГБ + swap; после — апгрейд до 4 ГБ на Beget |
| 6 | Куда бэкапы вне сервера | S3 российского провайдера (у LoyalPro уже есть бакет в Yandex Object Storage — можно свой бакет там же, `RCLONE_REMOTE` в `peri-backup.service`) |

## 5. План работ

Каждый шаг заканчивается проверкой; шаги A–C не трогают LoyalPro и не видны пользователям.

### A. Подготовка прода (≈1 ч, обратимо)

1. Гигиена: `kill` python http.server 8082, `ufw delete` 8081/8082, удалить `zz-diagtest.conf` + `.bak-*` (перед этим `tar` в `/root/nginx-backups`), `nginx -t && systemctl reload nginx`. Проверка: `ss -tlnp` без 8082, `ufw status`, `curl -I https://zumrudin.ru` = 200/302 как раньше.
2. Swap 2 ГБ: `fallocate -l 2G /swapfile`, `chmod 600`, `mkswap`, `swapon`, строка в `/etc/fstab`, `vm.swappiness=10`. Проверка: `free -h`.
3. Node 22 через nvm (`nvm install 22`, не менять `default`, чтобы не задеть LoyalPro на Node 20). Проверка: `/root/.nvm/versions/node/v22.*/bin/node -v`.
4. `apt install postgresql-client-16` (для `backup.sh`). Проверка: `PGSSLMODE=require psql -h googugiherie.beget.app -U peri_clinic_site -d peri_clinic_site -c 'select 1'` — пароль из `/srv/peri/directus/.env` стенда.
5. Каталоги `/srv/peri/{site,releases,cache/astro,directus,rebuild,backups}`, `/var/www/certbot`.

### B. Directus на `cms.peri-clinic.ru` (≈1–2 ч)

1. В Wix DNS: A `cms` → 217.114.0.254. Проверка: `dig +short cms.peri-clinic.ru`.
2. nginx: новый `deploy/nginx/prod.conf` (см. §6), пока только HTTP-блок для ACME; `certbot certonly --webroot -w /var/www/certbot -d cms.peri-clinic.ru --deploy-hook 'systemctl reload nginx'`.
3. Установка Directus: скопировать `package.json`/`package-lock.json` из `/srv/peri/directus` стенда, `npm ci` под Node 22 (или rsync `node_modules` целиком — быстрее, glibc совместим: 22.04 → 24.04, `pg` без нативных модулей, `sharp` тянет prebuilt).
4. `.env` по `deploy/directus.env.example`: `PUBLIC_URL=https://cms.peri-clinic.ru`, `DB_HOST=googugiherie.beget.app`, `DB_PORT=5432`, `DB_SSL=true`, тот же `SECRET`, что на стенде (иначе слетят сессии, статический токен Builder живёт в БД и переезжает сам), новый `REBUILD_TOKEN`, `IMPORT_IP_DENY_LIST=169.254.169.254`.
5. rsync `uploads/` со стенда (`rsync -a --info=progress2 /srv/peri/directus/uploads/ root@217.114.0.254:/srv/peri/directus/uploads/`), повторить дельту в день переключения.
6. `pm2 start deploy/pm2/ecosystem.config.cjs --only peri-directus && pm2 save`; `PERI_NODE` = путь к Node 22. Проверка: `curl -s http://127.0.0.1:8055/server/health`, вход в админку по HTTPS, превью картинок открываются, `build_log` виден.
   - Пока идёт настройка, стендовый Directus продолжает работать на той же БД: версия одна (12.3.1), миграций нет, конфликта нет. Правки редакторов в этот период в БД, поэтому ничего не теряется.

### C. Пайплайн сборки и сайт (≈1–2 ч)

1. Репозиторий: bare `/srv/peri/site.git` на проде + `git remote add prod ssh://root@217.114.0.254/srv/peri/site.git` на dev; `git clone /srv/peri/site.git /srv/peri/site` на проде.
2. `site.env` (`DIRECTUS_URL=http://127.0.0.1:8055`, токен Builder — тот же, что на стенде, `SITE_URL=https://www.peri-clinic.ru`), `rebuild/.env`, `build.sh` из репо. В `build.sh` добавить `nice -n 10` и `NODE_OPTIONS=--max-old-space-size=1024` (защита LoyalPro).
3. Первая сборка вручную: `PERI_ROOT=/srv/peri bash /srv/peri/rebuild/build.sh`. Проверка: `ls -la /srv/peri/current`, `grep -rl wixstatic /srv/peri/current | wc -l` = 0, `free -h` во время сборки (swap не должен уходить в ноль).
4. `pm2 start … --only peri-rebuild && pm2 save`; проверить Flow «Опубликовать сайт» из админки прода → запись в `build_log` → новый релиз.
5. Сертификат для `peri-clinic.ru` + `www` **по DNS-01 заранее** (TXT в Wix DNS). Проверка: `certbot certificates`.
6. nginx: полный `prod.conf` — `www.peri-clinic.ru` (root `/srv/peri/current`, без `X-Robots-Tag`, HSTS, `gzip_static on`, `/_astro/` immutable, `/uploads/` alias, `peri-redirects.map`, `rewrite` слэшей, `try_files $uri $uri.html $uri/`, сниппет справки), `peri-clinic.ru` → 301 на `www`, `cms.peri-clinic.ru` → 8055 с `limit_req` (`peri-limits.conf` в `conf.d`). `.br` nginx без модуля не отдаст — остаётся `gzip_static`; brotli можно добавить позже пакетом `libnginx-mod-http-brotli` (есть в Ubuntu 24.04).
7. Проверка до DNS: `curl --resolve www.peri-clinic.ru:443:217.114.0.254 -I https://www.peri-clinic.ru/` = 200, обход `docs/CONTENT-MAP.md` тем же `--resolve` (38 URL → 200/301), `node scripts/qa/a11y.mjs` и скриншоты на `https://www.peri-clinic.ru` через `--resolve`/hosts, Lighthouse mobile ≥ 90.

### D. Переключение (≈30 мин работ + до часа распространения DNS)

1. Финальный rsync `uploads/`, финальная сборка на проде, `pm2 save`.
2. В Wix DNS: apex A → 217.114.0.254 (удалить три A Wix), `www` CNAME → A 217.114.0.254. Время — утро буднего дня.
3. Наблюдение: `tail -f /var/log/nginx/access.log`, `dig @8.8.8.8 www.peri-clinic.ru`, `curl -I` с нескольких резолверов. `certbot renew --dry-run` после того, как домен смотрит на прод (перевод продления на webroot).
4. Яндекс.Вебмастер: добавить `www.peri-clinic.ru`, подтвердить (мета-тег через `site_settings` или файл в `public/`), sitemap, главное зеркало `www`, переобход. Метрика: проверить, что счётчик из `site_settings` шлёт хиты после согласия.
5. Обход старого sitemap Wix → всё 200/301 (`scripts/qa/check-links.mjs` + `curl`).
6. Стенд: остановить `peri-directus`/`peri-rebuild` на dev **или** перевести на `peri_clinic_site_dev` (решение №2 из §4). Обновить `peri.zumrudin.ru` → 301 на прод либо оставить как превью с `noindex`.

### E. После запуска (первые 2 недели)

1. `peri-backup.service/.timer` на проде (в `backup.sh` заменить путь к `snapshot.yaml` на `$PERI_ROOT/site/directus/snapshot.yaml`, добавить `PGSSLMODE=require`), `RCLONE_REMOTE` в S3. Проверка: файл в бакете, `pg_restore --list`.
2. Внешний мониторинг доступности `www` и `cms` (UptimeRobot/Яндекс.Мониторинг), алерт в Telegram.
3. Через 72 ч — Вебмастер без критических ошибок; через 2 недели — отключить Wix-сайт (домен остаётся у регистратора Wix, при желании перенести NS на Beget).
4. Апгрейд RAM до 4 ГБ, `libnginx-mod-http-brotli`, TLS 1.2+ глобально (согласовать с LoyalPro).
5. Фаза 9: `docs/ADMIN.md`, обучение редактора, тренировка восстановления уже на проде.

## 6. Что добавить в репозиторий до шага B

- `deploy/nginx/prod.conf` — три server-блока (§C.6), `listen 443 ssl http2` напрямую (на проде нет sslh), HSTS `max-age=31536000` (без preload до проверки), CSP по спеке (self + `mc.yandex.ru` + карты Яндекса) — CSP сначала в `Content-Security-Policy-Report-Only`.
- `deploy/setup.sh` — шаги A.2–A.5 и установка Directus идемпотентно (спека фазы 8 его обещает).
- `deploy/backup.sh` — правки из §E.1.
- `deploy/rebuild/build.sh` — `nice`, `NODE_OPTIONS`.
- `docs/superpowers/plans/2026-09-16-phase-8-production-deploy.md` — этот файл; после запуска — раздел «Что было сделано» по образцу `loyalpro/docs/2026-06-02-deploy-runbook.md`.

## 7. Журнал выполнения

```
2026-09-16 19:34 MSK — A.1 гигиена: /etc/nginx → /root/nginx-backups/etc-nginx-20260916-193409.tar.gz;
                        остановлен python http.server :8082 (orphan, без unit-файла; /tmp/probe не тронут);
                        ufw: удалены allow 8081/tcp и 8082/tcp (v4+v6);
                        zz-diagtest.conf, zumrudin.bak-*, .yclients.swp → /root/nginx-backups/removed-20260916-193409/;
                        nginx -t OK, systemctl reload nginx.
2026-09-16 19:36 MSK — A.2 swap: /swapfile 2G, fstab, vm.swappiness=10 (/etc/sysctl.d/99-peri-swap.conf).
                        Проверка после: zumrudin.ru / www / forma → 200, webhook.v2 → 404 (как до), все сервисы active,
                        pm2 loyalpro online без новых рестартов, слушают только 22/80/443/3001 + localhost.
Не сделано (нужно отдельное решение): TLS 1.0/1.1 в nginx.conf — затрагивает клиентов LoyalPro.
```

## 8. Откат

DNS назад на записи Wix (apex: 185.230.63.171 / .186 / .107; `www` → CNAME `cdn1.wixdns.net`) — Wix живёт ещё 2 недели, контент там не тронут. Прод при этом можно оставлять включённым: он никому не мешает.
