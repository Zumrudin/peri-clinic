# Видео услуг на десктопе: план реализации

> Для исполнителя: задачи выполняются по порядку (superpowers:executing-plans), шаги
> отмечаются чекбоксами. Спецификация: `docs/superpowers/specs/2026-10-04-treatment-videos-desktop-design.md`.

**Цель:** показать блок «Видео о процедуре» от 801 px с выбором видео на месте
и автоматическими обложками, не меняя мобильную версию.

**Архитектура:** контроллер `src/scripts/home-reels.ts` получает режим ряда для
немобильных лент на ширине от 801 px: активная карточка задаётся выбором, а не
прокруткой. Сборка добавляет к MP4/HLS каждого рилса WebP первого кадра,
`prepareReels` подставляет его при пустой обложке. `TreatmentPage` больше не передаёт
`mobileOnly` и раскладывает блок по сетке страницы.

**Стек:** Astro 5 (static), TypeScript, `node --test`, ffmpeg/libwebp, Playwright + axe.

## Файлы

- `src/lib/reelVideoUrl.ts`: `reelPosterUrl()`; тест в `src/lib/homeReels.test.ts`.
- `src/lib/reelVideoFiles.ts`: `cacheReelPoster()` и общий атомарный вывод ffmpeg;
  новый тест `src/lib/reelVideoFiles.test.ts`.
- `src/pages/media/posters/[file].ts`: статические пути обложек (не в `/media/reels/`,
  где nginx сужает MIME-типы до потоков).
- `src/lib/homeReelContent.ts`: обложка из CMS или первый кадр.
- `src/scripts/home-reels.ts`: режим ряда.
- `src/templates/TreatmentPage.astro`: блок на всех ширинах.
- `scripts/qa/procedure-videos.mjs`, `scripts/qa/video-publication.mjs`: новые ожидания;
  `scripts/qa/procedure-videos-desktop.mjs`: браузерная проверка режима ряда.

### Задача 1. Адрес обложки

- [x] Тест в `src/lib/homeReels.test.ts`:

```ts
test('first-frame posters are versioned next to derived streams', () => {
  assert.equal(reelPosterUrl('/media/specialists/abcd-1234.mov'), '/media/posters/abcd-1234-v1.webp');
  assert.equal(reelPosterUrl('https://example.com/clip.mp4'), undefined);
});
```

- [x] `node --test src/lib/homeReels.test.ts` падает: `reelPosterUrl` не экспортирован.
- [x] В `reelVideoUrl.ts` вынести общий разбор имени и добавить функцию:

```ts
const ownedName = (url: string) => url.match(/^\/media\/specialists\/([a-f0-9-]+)\.(?:mp4|webm|mov)$/i)?.[1];
export function reelPosterUrl(url: string): string | undefined {
  const name = ownedName(url);
  return name ? `/media/posters/${name}-v1.webp` : undefined;
}
```

- [x] Тест проходит вместе с прежними проверками MP4/HLS.

### Задача 2. Извлечение первого кадра

- [x] `src/lib/reelVideoFiles.test.ts`: ролик `testsrc2` 720×1280 → `cacheReelPoster()`
  даёт RIFF/WEBP 540×960; ролик 360×640 не увеличивается; повторный вызов с
  несуществующим входом возвращает готовый файл без перезаписи (mtime прежний).
- [x] Тест падает: функции нет.
- [x] В `reelVideoFiles.ts` общий `derive(directory, name, args)` (проверка кеша,
  временный файл с расширением цели, `rename`, очистка) для `cacheReelVideo` с прежними
  аргументами и для обложки:

```ts
export const cacheReelPoster = (input: string, name: string, directory: string) => derive(directory, name, output =>
  ['-i', input, '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=min(540\\,iw):-2', '-c:v', 'libwebp', '-quality', '80', '-map_metadata', '-1', output]);
```

- [x] `npm test` проходит.

### Задача 3. Публикация и подстановка обложек

- [x] `src/pages/media/posters/[file].ts`: для каждого источника `getReelSources()`
  путь `…-v1.webp`; GET берёт исходник через `cacheVideo`, затем `cacheReelPoster`
  в `REEL_POSTER_CACHE_DIR` (по умолчанию `.cache/reel-posters`), `image/webp`.
- [x] `prepareReels`: `image_url: poster?.src ?? reelPosterUrl(source)`.

### Задача 4. Режим ряда в контроллере

- [x] `update()` сравнивает `reduced.matches` с `reducedSeen` и останавливает видео при
  смене: Chrome пропускает `change`, если `.matches` уже вернул новое значение.
- [x] `const wide = matchMedia('(min-width: 801px)')`, `row = () => !mobileOnly && wide.matches`.
- [x] `update()`: в режиме ряда активная карточка не вычисляется по прокрутке; `inert`
  только вне режима ряда; подложка неактивной карточки получает `tabindex="-1"` и
  `aria-hidden="true"`; обложки назначаются всем карточкам.
- [x] `go()`: в режиме ряда остановить текущее, показать её подпись, сделать цель
  активной (`resetCaption`), прокрутить ленту только если цель обрезана — до начала
  ближайшей карточки, при которой цель видна целиком до правого поля.
- [x] `visible()`: в режиме ряда ещё и не меньше половины карточки внутри ленты.
- [x] Клик по кнопке запуска или подложке неактивной карточки в режиме ряда: снять
  ручную паузу, `go(index)`, `play()`. Поведение активной карточки прежнее.
- [x] `layout()`: в режиме ряда `--reels-tail: 0px`; пересчёт при смене `wide`.

### Задача 5. Блок на странице услуги

- [x] Убрать `mobileOnly` и `display: none`. Базово: контейнер, поля, нижний отступ
  `var(--section)`, `--reels-gutter: var(--gutter)`, заголовок `var(--t-h2-s)`/1.1.
  До 800 px: прежние нижний отступ 56 px и размер заголовка.

### Задача 6. QA-скрипты

- [x] `procedure-videos.mjs`: маркера `data-mobile-only` нет; у каждого видео есть
  `data-poster`, файл существует в `dist`.
- [x] `video-publication.mjs`: карточка выбирается её точкой (работает в обоих режимах).
- [x] `procedure-videos-desktop.mjs`: 1024 и 1440 — нет переполнения страницы, первое
  видео играет без звука, клик по третьей карточке запускает её на месте без сдвига,
  обрезанная карточка прокручивается целиком в поле, после окончания идёт следующая,
  обложки у всех, стрелки, reduced motion, axe без serious/critical, без ошибок
  страницы; 375 — прежняя карусель (неактивные inert, хвост ленты больше нуля).

### Задача 7. Проверка на сборке

- [x] Тестовые карточки в dev-CMS (6 опубликованных у volnewmer, одна с обложкой,
  черновик; одна у второй услуги), идентификаторы сохранить для удаления.
- [x] `npm test`, `npm run check`, `npm run build`, `node scripts/qa/seo.mjs dist`,
  `npm run preview`, затем `procedure-videos.mjs`, `procedure-videos-desktop.mjs`,
  `specialist-shared-reels.mjs`, `check-links.mjs`; снимки 375/800/1024/1440.
- [x] Удалить тестовые карточки, файлы библиотеки не трогать.

### Задача 8. Выпуск

- [x] Коммит `feat: show service videos on desktop with in-place selection`,
  `git push origin main`, на проде `git -C /srv/peri/site pull --ff-only` и POST
  `/rebuild` с `X-Rebuild-Token`.
- [x] Живой сайт: `video-publication.mjs` по снимку рабочей CMS,
  `procedure-videos-desktop.mjs` для страницы с видео, снимки по внешним ссылкам.
- [x] Записать результаты проверок в этот план.

## Результаты проверок (2026-10-04)

Локально на dev-CMS с временными карточками (6 опубликованных у volnewmer, одна с обложкой
из CMS, один черновик, одно видео у второй услуги; карточки удалены, файлы библиотеки не тронуты):

- `npm test` 36/36, `astro check` 0 errors / 0 warnings, сборка 45 страниц.
- `procedure-videos.mjs`: 20 услуг — изоляция, публикация, порядок, пустое состояние,
  MP4/HLS и обложки.
- `procedure-videos-desktop.mjs`: 1024 и 1440 (ряд, обложки, запуск на месте, докрутка
  обрезанной карточки, переход к следующей, клавиатура, reduced motion, axe), 375 и 800
  (карусель, inert, хвост ленты, точки, axe) и регрессии по ревью — две серии подряд без сбоев.
- `video-publication.mjs`: все видео играют на 393 и 1440 px, включая хвост.
- Мобильная вёрстка 375/800 совпала с боевой до выпуска по всем измеренным размерам.
- axe: 0 serious/critical на `/volnewmer`, `/heleo`, профиле специалиста; на главной один
  прежний minor (`image-redundant-alt`).
- Не проверено: WebKit/Safari (браузер не установлен, на сервер с почти полным диском не ставили).

Найдено по ходу:

- Chrome пропускал `change` у `prefers-reduced-motion`, если `.matches` уже прочитан:
  `update()` теперь замечает смену сам (воспроизводилось в тесте профиля специалиста).
- Ревью: повтор досмотренного видео после выгрузки перескакивал в конец; кнопка запуска
  сильно обрезанной активной карточки не работала; выход из режима ряда менял активное
  видео; кнопка звука на ожидающей карточке меняла звук чужой. Всё исправлено, на каждый
  случай есть проверка в `procedure-videos-desktop.mjs`.
- Клик по точке на 800 px падал в 2 запусках из 6 и на боевом сайте со старым кодом: на `html`
  стоит `scroll-behavior: smooth`. Скрипт использует мгновенные прокрутки.
- nginx сужает MIME-типы в `/media/reels/` до потоков, поэтому обложки лежат в
  `/media/posters/`; конфигурацию менять не пришлось. Заголовка `immutable` у обложек нет
  (общий `location /`, остаются ETag и Last-Modified, файлы 15–25 КБ).

Выпуск:

- Коммит `389523d` отправлен в GitHub и bare-репозиторий прода, на проде `git pull --ff-only`,
  пересборка через приёмник (HTTP 202, сборка 1 мин 32 с, результат `ok`), релиз
  `2026-10-04T20-16-51`.
- Живой `/volnewmer`: 6 карточек, без `data-mobile-only`, обложки 200 `image/webp` (WebP
  540×960); `procedure-videos-desktop.mjs` — все 5 серий PASS; `video-publication.mjs` по снимку
  рабочей CMS — PASS (393 и 1440); профиль специалиста — PASS (375/800/1440); axe — 0 serious/critical.
- Живая главная: 12 роликов по порядку из CMS играют на 393 px (`video-publication.mjs`),
  End/Home/стрелки работают, на десктопе блок скрыт; при загрузке единственный запрос к медиа —
  постер подарка, как и раньше.
- `home-reels.mjs` на боевой главной падает на шаге End: скрипт рассчитан на два ролика dev-данных
  (ожидает, что последняя карточка — индекс 1), на проде их 12. Поведение проверено отдельно по
  реальным данным, как описано выше.
- `check-links.mjs` помечает четыре ссылки на `/specialisty/*`: проверка учитывает только
  `dist/*.html` верхнего уровня, страницы существуют и отдают 200.
- Dev-стенд `peri.zumrudin.ru` не обновлялся: в его рабочей копии лежат незакоммиченные правки.
