# PERI CLINIC — сайт клиники (замена Wix)

Astro (статика) + self-hosted Directus (админка) + nginx. Дизайн-спека и план: `docs/superpowers/`.

## Требования

- Node 22 (`nvm use`), Python 3 с `fonttools` и `brotli` (только для пересборки шрифтов).

## Команды

```bash
npm install
npm run dev        # http://127.0.0.1:4321
npm run build      # dist/
npm run preview    # http://127.0.0.1:4322 — отдаёт dist/
npm test           # unit-тесты хелперов
npm run fonts      # пересобрать сабсеты шрифтов в public/fonts/
node scripts/qa/screenshots.mjs http://127.0.0.1:4322 docs/qa/<phase> / [пути...]
```

## Структура

- `src/data/*.json` — временные фикстуры контента (до подключения Directus).
- `src/assets/home/` — оригиналы фотографий, оптимизируются при сборке (AVIF/WebP).
- `src/styles/tokens.css` — дизайн-токены; `base.css` — шрифты, сброс, кнопки, типографика.
- `src/components/{shell,ui,home}` — шапка, подвал, лист контактов, секции главной.
- `src/scripts/` — поведение (меню, sticky-шапка, reveal, ленты, лист контактов).
- `public/fonts/` — Cormorant Garamond + Golos Text (OFL), сабсет кириллица+латиница.

## Запись на приём

Формы нет: кнопка «Записаться» открывает лист с кнопками «Позвонить / Telegram / WhatsApp / MAX».
Ссылки задаются в `src/data/site.json` (после фазы 3 — в настройках Directus).
