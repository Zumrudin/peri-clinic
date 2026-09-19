/**
 * Declarative Directus schema for the Peri site.
 * Field helpers produce {field, type, meta, schema} objects understood by POST /fields.
 * Labels are Russian (meta.translations) so editors see a Russian admin.
 */

const ru = (label) => [{ language: 'ru-RU', translation: label }];

const base = (field, type, label, meta = {}, schema = {}) => ({
  field,
  type,
  meta: { translations: ru(label), ...meta },
  schema,
});

export const f = {
  id: () => ({ field: 'id', type: 'integer', meta: { hidden: true, readonly: true }, schema: { is_primary_key: true, has_auto_increment: true } }),
  status: () =>
    base(
      'status',
      'string',
      'Статус',
      {
        interface: 'select-dropdown',
        display: 'labels',
        width: 'half',
        options: {
          choices: [
            { text: 'Опубликовано', value: 'published' },
            { text: 'Черновик', value: 'draft' },
            { text: 'В архиве', value: 'archived' },
          ],
        },
        display_options: {
          showAsDot: true,
          choices: [
            { text: 'Опубликовано', value: 'published', foreground: '#FFFFFF', background: '#2ECDA7' },
            { text: 'Черновик', value: 'draft', foreground: '#18222F', background: '#D3DAE4' },
            { text: 'В архиве', value: 'archived', foreground: '#FFFFFF', background: '#A2B5CD' },
          ],
        },
      },
      { default_value: 'draft', is_nullable: false },
    ),
  sort: () => base('sort', 'integer', 'Порядок', { interface: 'input', hidden: true }),
  dateUpdated: () =>
    base('date_updated', 'timestamp', 'Изменено', { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, width: 'half' }),
  userUpdated: () =>
    base('user_updated', 'uuid', 'Кем изменено', { special: ['user-updated'], interface: 'select-dropdown-m2o', readonly: true, hidden: true, width: 'half' }),

  str: (field, label, o = {}) =>
    base(field, 'string', label, { interface: 'input', width: o.width || 'full', note: o.note, required: o.required, options: o.options }, { default_value: o.default, is_nullable: !o.required }),
  slug: (field = 'slug', label = 'URL (slug)') =>
    base(field, 'string', label, { interface: 'input', width: 'half', required: true, note: 'Латиницей, без пробелов: volnewmer, rf-lifting-inmode', options: { slug: true, trim: true } }, { is_unique: true, is_nullable: false }),
  text: (field, label, o = {}) =>
    base(field, 'text', label, { interface: 'input-multiline', note: o.note, width: o.width || 'full' }),
  html: (field, label, o = {}) =>
    base(field, 'text', label, {
      interface: 'input-rich-text-html',
      note: o.note,
      options: { toolbar: ['bold', 'italic', 'underline', 'h2', 'h3', 'numlist', 'bullist', 'link', 'removeformat'] },
    }),
  bool: (field, label, def = false, o = {}) =>
    base(field, 'boolean', label, { interface: 'boolean', width: o.width || 'half', note: o.note, special: ['cast-boolean'] }, { default_value: def }),
  int: (field, label, o = {}) => base(field, 'integer', label, { interface: 'input', width: o.width || 'half', note: o.note }),
  image: (field, label, o = {}) =>
    base(field, 'uuid', label, { interface: 'file-image', special: ['file'], width: o.width || 'half', note: o.note, required: o.required }),
  file: (field, label, o = {}) => base(field, 'uuid', label, { interface: 'file', special: ['file'], width: o.width || 'half', note: o.note, options: o.options }),
  date: (field, label) => base(field, 'date', label, { interface: 'datetime', width: 'half' }),
  select: (field, label, choices, o = {}) =>
    base(field, 'string', label, { interface: 'select-dropdown', width: o.width || 'half', options: { choices } }, { default_value: o.default }),
  m2o: (field, label, related, o = {}) =>
    base(field, 'integer', label, {
      interface: 'select-dropdown-m2o',
      width: o.width || 'half',
      note: o.note,
      required: o.required,
      display: 'related-values',
      display_options: { template: o.template || '{{title}}' },
      options: { template: o.template || '{{title}}' },
    }),
  o2m: (field, label, o = {}) =>
    base(field, 'alias', label, { interface: 'list-o2m', special: ['o2m'], note: o.note, options: { template: o.template || '{{title}}', enableCreate: true, enableSelect: true } }),
  files: (field, label, o = {}) => base(field, 'alias', label, { interface: 'files', special: ['files'], note: o.note }),
  repeater: (field, label, fields, o = {}) =>
    base(field, 'json', label, {
      interface: 'list',
      special: ['cast-json'],
      note: o.note,
      options: { template: o.template || '{{title}}', fields },
    }),
  tags: (field, label, o = {}) => base(field, 'json', label, { interface: 'tags', special: ['cast-json'], note: o.note, options: { presets: [] } }),
  divider: (field, label) => base(field, 'alias', label, { interface: 'presentation-divider', special: ['alias', 'no-data'], options: { title: label } }),
};

const rep = (field, label, type = 'string', iface = 'input', extra = {}) => ({
  field,
  name: label,
  type,
  meta: { interface: iface, width: 'full', ...extra },
});

const seo = () => [
  f.divider('seo_divider', 'SEO'),
  f.str('seo_title', 'SEO: заголовок (title)', { note: 'До 60 символов. Пусто — берётся название.' }),
  f.text('seo_description', 'SEO: описание (description)', { note: 'До 160 символов' }),
  f.image('og_image', 'Картинка для соцсетей (OG)'),
];

const timestamps = () => [f.dateUpdated(), f.userUpdated()];

// ---------------------------------------------------------------------------

export const collections = [
  {
    collection: 'site_settings',
    meta: { singleton: true, icon: 'settings', translations: ru('Настройки сайта'), sort: 1, group: 'group_settings' },
    fields: [
      f.id(),
      f.divider('d_contacts', 'Контакты'),
      f.str('phone', 'Телефон (как показывать)', { width: 'half', default: '+7 925 017-77-78' }),
      f.str('email', 'E-mail', { width: 'half' }),
      f.str('city', 'Город', { width: 'half', default: 'Москва' }),
      f.str('hours', 'Часы работы', { width: 'half', default: 'Ежедневно, 10:00–22:00' }),
      f.str('address_short', 'Адрес (одной строкой)'),
      f.text('address_lines', 'Адрес (для баннера, с переносами)'),
      f.str('map_embed_src', 'Яндекс.Карта: ссылка iframe (конструктор)', { note: 'https://yandex.ru/map-widget/v1/?um=constructor%3A...' }),
      f.str('map_link', 'Ссылка «Открыть в Яндекс.Картах»'),
      f.divider('d_messengers', 'Мессенджеры и соцсети'),
      f.str('telegram_url', 'Telegram (ссылка для записи)', { width: 'half' }),
      f.str('whatsapp_phone', 'WhatsApp: номер', { width: 'half', note: 'Пусто — берётся основной телефон' }),
      f.str('whatsapp_text', 'WhatsApp: текст по умолчанию', { default: 'Здравствуйте! Хочу записаться в PERI CLINIC' }),
      f.str('max_url', 'MAX (ссылка)', { width: 'half' }),
      f.str('vk_url', 'ВКонтакте', { width: 'half' }),
      f.str('instagram_url', 'Instagram*', { width: 'half' }),
      f.str('telegram_channel_url', 'Telegram-канал', { width: 'half' }),
      f.str('shop_url', 'Интернет-магазин', { width: 'half', default: 'https://periclinic-shop.ru' }),
      f.str('spravka_form_url', 'Форма заявки на справку (iframe)', { width: 'half' }),
      f.divider('d_legal', 'Юридическая информация'),
      f.str('legal_entity', 'Юридическое лицо'),
      f.str('ogrn', 'ОГРН', { width: 'half' }),
      f.str('inn', 'ИНН', { width: 'half' }),
      f.str('kpp', 'КПП', { width: 'half' }),
      f.str('legal_address', 'Юридический адрес'),
      f.str('license_number', 'Лицензия: номер', { width: 'half' }),
      f.str('license_date', 'Лицензия: дата', { width: 'half' }),
      f.str('license_issuer', 'Лицензия: кем выдана'),
      f.file('license_file', 'Лицензия: файл (PDF)'),
      f.text('contraindications_text', 'Дисклеймер о противопоказаниях', { note: 'Показывается на каждой странице' }),
      f.text('non_offer_text', 'Текст «не оферта»'),
      f.text('instagram_disclaimer', 'Пометка про Instagram/Meta'),
      f.divider('d_misc', 'Прочее'),
      f.text('tagline', 'Слоган в подвале'),
      f.str('metrika_id', 'Яндекс.Метрика: номер счётчика', { width: 'half' }),
      f.str('yandex_verification', 'Яндекс.Вебмастер: код подтверждения', { width: 'half' }),
      f.bool('show_prices', 'Показывать цены на сайте', false),
      f.bool('metrika_requires_consent', 'Метрика только после согласия на cookie', true),
      f.image('default_og_image', 'OG-картинка по умолчанию'),
      f.str('seo_title_suffix', 'Суффикс title', { default: 'PERI CLINIC' }),
      ...timestamps(),
    ],
  },

  {
    collection: 'home',
    meta: { singleton: true, icon: 'home', translations: ru('Главная страница'), sort: 2, group: 'group_content' },
    fields: [
      f.id(),
      f.divider('d_hero', 'Первый экран'),
      f.str('hero_eyebrow', 'Надзаголовок'),
      f.text('hero_title', 'Заголовок', { note: 'Переносы строк сохраняются. _слово_ — золотой курсив.' }),
      f.text('hero_lead', 'Подзаголовок'),
      f.str('hero_primary_label', 'Кнопка', { width: 'half', default: 'Подобрать процедуру' }),
      f.str('hero_secondary_label', 'Текстовая ссылка', { width: 'half', default: 'Смотреть результаты' }),
      f.image('hero_image', 'Фото', { required: true }),
      f.str('hero_image_alt', 'Фото: alt-текст'),
      f.text('hero_note', 'Круглая плашка'),
      f.repeater('hero_facts', 'Факты (3 шт.)', [rep('value', 'Число'), rep('label', 'Подпись', 'text', 'input-multiline')], { template: '{{value}} {{label}}' }),
      f.divider('d_ticker', 'Бегущая строка'),
      f.tags('ticker_items', 'Фразы'),
      f.divider('d_categories', 'Блок «Направления»'),
      f.str('categories_eyebrow', 'Надзаголовок'),
      f.text('categories_title', 'Заголовок'),
      f.text('categories_lead', 'Текст'),
      f.divider('d_approach', 'Блок «Философия»'),
      f.str('approach_eyebrow', 'Надзаголовок'),
      f.text('approach_title', 'Заголовок'),
      f.text('approach_lead', 'Текст'),
      f.image('approach_image', 'Фото'),
      f.str('approach_image_alt', 'Фото: alt-текст'),
      f.str('approach_badge', 'Круглый бейдж', { width: 'half', default: 'PERI CARE' }),
      f.repeater('principles', 'Принципы', [rep('title', 'Заголовок'), rep('text', 'Текст', 'text', 'input-multiline')]),
      f.str('approach_link_label', 'Ссылка: текст', { width: 'half' }),
      f.str('approach_link_href', 'Ссылка: адрес', { width: 'half', default: '/kontakty' }),
      f.divider('d_devices', 'Блок «Технологии»'),
      f.str('devices_eyebrow', 'Надзаголовок'),
      f.text('devices_title', 'Заголовок'),
      f.text('devices_lead', 'Текст'),
      f.str('devices_all_label', 'Кнопка каталога'),
      f.str('devices_consultation_title', 'Заголовок консультации'),
      f.str('devices_consultation_label', 'Кнопка консультации'),
      f.str('devices_catalog_title', 'Заголовок каталога'),
      f.text('devices_catalog_lead', 'Лид каталога'),
      f.str('devices_catalog_seo_title', 'SEO-заголовок каталога'),
      f.str('devices_catalog_seo_description', 'SEO-описание каталога'),

      f.divider('d_cases', 'Блок «До и после»'),
      f.str('cases_eyebrow', 'Надзаголовок'),
      f.text('cases_title', 'Заголовок'),
      f.text('cases_lead', 'Текст'),
      f.divider('d_reviews', 'Блок «Отзывы»'),
      f.str('reviews_eyebrow', 'Надзаголовок'),
      f.text('reviews_title', 'Заголовок'),
      f.str('reviews_rating', 'Рейтинг', { width: 'half', default: '5.0' }),
      f.str('reviews_rating_label', 'Подпись рейтинга', { width: 'half', default: 'рейтинг клиники' }),
      f.divider('d_cta', 'Блок «Записаться»'),
      f.str('cta_eyebrow', 'Надзаголовок'),
      f.text('cta_title', 'Заголовок'),
      f.text('cta_lead', 'Текст'),
      f.str('cta_button_label', 'Кнопка', { width: 'half', default: 'Записаться' }),
      f.image('cta_image', 'Фото'),
      f.str('cta_image_alt', 'Фото: alt-текст'),
      ...seo(),
      ...timestamps(),
    ],
  },

  {
    collection: 'service_categories',
    meta: { icon: 'category', translations: ru('Направления (категории)'), display_template: '{{title}}', sort: 3, group: 'group_content', sort_field: 'sort' },
    fields: [
      f.id(), f.status(), f.sort(),
      f.str('title', 'Название', { required: true, width: 'half' }),
      f.slug(),
      f.str('short_title', 'Короткое название (для меню)', { width: 'half' }),
      f.str('tagline', 'Подпись на карточке', { width: 'half', note: 'Лифтинг · Омоложение · Качество кожи' }),
      f.image('cover', 'Обложка', { required: true }),
      f.str('cover_alt', 'Обложка: alt-текст'),
      f.text('intro_title', 'Заголовок на странице'),
      f.html('description', 'Описание'),
      f.bool('show_on_home', 'Показывать на главной', true),
      f.o2m('procedures', 'Процедуры'),
      ...seo(),
      ...timestamps(),
    ],
  },

  {
    collection: 'procedures',
    meta: { icon: 'spa', translations: ru('Процедуры'), display_template: '{{title}}', sort: 4, group: 'group_content', sort_field: 'sort', archive_field: 'status', archive_value: 'archived', unarchive_value: 'draft' },
    fields: [
      f.id(), f.status(), f.sort(),
      f.str('title', 'Название', { required: true, width: 'half' }),
      f.slug(),
      f.m2o('category', 'Направление', 'service_categories', { required: true }),
      f.m2o('device', 'Аппарат', 'devices', { template: '{{name}}' }),
      f.str('icd10', 'Код МКБ-10', { width: 'half', note: 'Например L90.5. Показывается на сайте рядом с ценами.' }),
      f.str('subtitle', 'Подзаголовок', { note: 'Одна строка под названием' }),
      f.text('summary', 'Краткое описание (для карточек)'),
      f.image('cover', 'Обложка'),
      f.str('cover_alt', 'Обложка: alt-текст'),
      f.files('gallery', 'Галерея'),
      f.divider('d_facts', 'Ключевые факты'),
      f.str('duration', 'Длительность', { width: 'half', note: '30–60 минут' }),
      f.str('rehab', 'Реабилитация', { width: 'half', note: 'Не требуется' }),
      f.str('effect_duration', 'Эффект', { width: 'half', note: 'До 12 месяцев' }),
      f.str('sessions', 'Курс', { width: 'half', note: '1–3 процедуры' }),
      f.divider('d_content', 'Содержание'),
      f.text('lead', 'Вводный абзац'),
      f.html('body', 'Основной текст'),
      f.repeater('steps', 'Как проходит процедура', [rep('title', 'Этап'), rep('text', 'Описание', 'text', 'input-multiline')]),
      f.repeater('benefits', 'Преимущества', [rep('title', 'Заголовок'), rep('text', 'Описание', 'text', 'input-multiline')]),
      f.html('indications', 'Показания'),
      f.html('contraindications', 'Противопоказания'),
      f.o2m('faq', 'Вопросы и ответы', { template: '{{question}}' }),
      f.o2m('cases', 'Результаты до/после'),
      f.o2m('price_items', 'Цены', { template: '{{name}} — {{price}} ₽' }),
      f.bool('show_on_home', 'Показывать на главной', false),
      f.str('legacy_wix_url', 'Старый адрес на Wix', { width: 'half' }),
      ...seo(),
      ...timestamps(),
    ],
  },

  {
    collection: 'price_items',
    meta: { icon: 'payments', translations: ru('Цены'), display_template: '{{name}} — {{price}} ₽', sort: 5, group: 'group_content', sort_field: 'sort', hidden: true },
    fields: [
      f.id(), f.sort(),
      f.m2o('procedure', 'Процедура', 'procedures'),
      f.str('price_group', 'Раздел прайса без страницы процедуры', { note: 'Для консультаций и других услуг без отдельной страницы. Заполняется вместо процедуры.' }),
      f.str('price_group_category', 'Направление раздела прайса', { note: 'Slug родительского направления. Пусто — самостоятельный раздел.' }),
      f.int('price_group_sort', 'Порядок самостоятельного раздела'),
      f.str('name', 'Название позиции', { required: true }),
      f.str('medical_service_code', 'Код медицинской услуги', { width: 'half', note: 'Подтверждённый код по номенклатуре Минздрава. Не МКБ и не код препарата.' }),
      f.str('medical_service_name', 'Наименование по номенклатуре', { note: 'Точное название медицинского вмешательства, соответствующее коду.' }),
      f.int('price', 'Цена врача, ₽', { width: 'half' }),
      f.int('price_max', 'Максимальная цена врача, ₽', { width: 'half' }),
      f.int('price_head_doctor', 'Цена гл. врача, ₽', { width: 'half', note: 'Пусто, если у процедуры одна цена' }),
      f.str('unit', 'Единица', { width: 'half', note: 'за зону / за 1 мл' }),
      f.str('note', 'Примечание', { width: 'half' }),
    ],
  },

  {
    collection: 'devices',
    meta: { icon: 'precision_manufacturing', translations: ru('Аппараты'), display_template: '{{name}}', sort: 6, group: 'group_content', sort_field: 'sort' },
    fields: [
      f.id(), f.status(), f.sort(),
      f.str('name', 'Название', { required: true, width: 'half' }),
      f.str('short', 'Короткое описание', { width: 'half', note: 'Игольчатый RF-лифтинг' }),
      f.str('manufacturer', 'Производитель', { width: 'half' }),
      f.str('country', 'Страна', { width: 'half' }),
      f.image('image', 'Изображение (PNG без фона)'),
      f.html('description', 'Описание'),
      f.m2o('procedure', 'Основная процедура', 'procedures'),
      f.bool('show_on_home', 'Показывать на главной', true),
      ...timestamps(),
    ],
  },

  {
    collection: 'case_categories',
    meta: { icon: 'folder', translations: ru('Группы результатов'), display_template: '{{title}}', sort: 7, group: 'group_gallery', sort_field: 'sort' },
    fields: [
      f.id(), f.sort(),
      f.str('title', 'Название', { required: true, width: 'half' }),
      f.slug(),
      f.m2o('procedure', 'Связанная процедура', 'procedures'),
    ],
  },

  {
    collection: 'before_after_cases',
    meta: { icon: 'compare', translations: ru('До и после'), display_template: '{{title}}', sort: 8, group: 'group_gallery', sort_field: 'sort', archive_field: 'status', archive_value: 'archived', unarchive_value: 'draft' },
    fields: [
      f.id(), f.status(), f.sort(),
      f.str('title', 'Название', { required: true, width: 'half' }),
      f.m2o('category', 'Группа', 'case_categories'),
      f.m2o('procedure', 'Процедура', 'procedures'),
      f.image('before', 'Фото «до»'),
      f.image('after', 'Фото «после»'),
      f.image('combined', 'Общее фото до/после (если одно)', { note: 'Используется, если нет раздельных фото' }),
      f.text('result', 'Что сделано / результат'),
      f.tags('result_points', 'Тезисы результата'),
      f.date('date', 'Дата'),
      f.bool('show_on_home', 'Показывать на главной', false),
      f.bool('needs_review', 'Требует проверки (после импорта)', false, { note: 'Пока включено — на сайт не попадает' }),
      ...timestamps(),
    ],
  },

  {
    collection: 'reviews',
    meta: { icon: 'reviews', translations: ru('Отзывы'), display_template: '{{author_name}} — {{procedure_label}}', sort: 9, group: 'group_reviews', sort_field: 'sort', archive_field: 'status', archive_value: 'archived', unarchive_value: 'draft' },
    fields: [
      f.id(), f.status(), f.sort(),
      f.str('author_name', 'Имя', { required: true, width: 'half' }),
      f.date('date', 'Дата'),
      f.int('rating', 'Оценка (1–5)'),
      f.str('procedure_label', 'Процедура (подпись)', { width: 'half' }),
      f.m2o('procedure', 'Связанная процедура', 'procedures'),
      f.text('text', 'Текст отзыва'),
      f.select('source', 'Источник', [
        { text: 'Сайт', value: 'site' },
        { text: 'Яндекс', value: 'yandex' },
        { text: '2ГИС', value: '2gis' },
        { text: 'ПроДокторов', value: 'prodoctorov' },
      ], { default: 'site' }),
      f.str('source_url', 'Ссылка на источник', { width: 'half' }),
      f.bool('show_on_home', 'Показывать на главной', false),
      ...timestamps(),
    ],
  },

  {
    collection: 'faq_items',
    meta: { icon: 'help', translations: ru('Вопросы и ответы'), display_template: '{{question}}', sort: 10, group: 'group_reviews', sort_field: 'sort' },
    fields: [
      f.id(), f.status(), f.sort(),
      f.str('question', 'Вопрос', { required: true }),
      f.html('answer', 'Ответ'),
      f.select('scope', 'Где показывать', [
        { text: 'Общие (страница услуг)', value: 'general' },
        { text: 'На странице процедуры', value: 'procedure' },
      ], { default: 'procedure' }),
      f.m2o('procedure', 'Процедура', 'procedures'),
      ...timestamps(),
    ],
  },

  {
    collection: 'pages',
    meta: { icon: 'article', translations: ru('Страницы'), display_template: '{{title}}', sort: 11, group: 'group_pages', sort_field: 'sort', archive_field: 'status', archive_value: 'archived', unarchive_value: 'draft' },
    fields: [
      f.id(), f.status(), f.sort(),
      f.str('title', 'Заголовок', { required: true, width: 'half' }),
      f.slug(),
      f.select('template', 'Шаблон', [
        { text: 'Информационная', value: 'info' },
        { text: 'Юридический документ', value: 'legal' },
        { text: 'Программа лояльности', value: 'loyalty' },
        { text: 'Справка (с формой)', value: 'spravka' },
      ], { default: 'info' }),
      f.text('lead', 'Вводный текст'),
      f.html('body', 'Текст'),
      f.files('attachments', 'Файлы для скачивания'),
      f.bool('noindex', 'Скрыть от поисковиков', false),
      f.str('legacy_wix_url', 'Старый адрес на Wix', { width: 'half' }),
      ...seo(),
      ...timestamps(),
    ],
  },

  {
    collection: 'build_log',
    meta: { icon: 'published_with_changes', translations: ru('Публикации сайта'), display_template: '{{status}} {{started_at}}', sort: 12, group: 'group_settings' },
    fields: [
      f.id(),
      base_ts('started_at', 'Начало'),
      base_ts('finished_at', 'Конец'),
      f.select('status', 'Статус', [
        { text: 'Идёт сборка', value: 'running' },
        { text: 'Опубликовано', value: 'ok' },
        { text: 'Ошибка', value: 'failed' },
      ]),
      f.str('triggered_by', 'Кем запущено', { width: 'half' }),
      f.text('message', 'Лог'),
    ],
  },
];

collections.push(
  { collection: 'clinic_about', meta: { icon: 'local_hospital', group: 'group_content', singleton: true, translations: ru('О клинике — тексты блока') }, fields: [
    f.id(), f.str('eyebrow', 'Надзаголовок', { required: true }), f.text('title', 'Заголовок'), f.text('description', 'Описание клиники'),
    f.str('rooms_title', 'Заголовок интерьеров'), f.str('team_title', 'Заголовок команды'), f.str('details_label', 'Кнопка страницы специалиста'),
    f.str('license_label', 'Подпись ссылки на документы'), f.str('license_href', 'Адрес документов'), f.text('demo_notice', 'Пометка временных фотографий'),
  ] },
  { collection: 'clinic_photos', meta: { icon: 'photo_library', group: 'group_content', sort_field: 'sort', translations: ru('Фотографии клиники') }, fields: [
    f.id(), f.status(), f.sort(), f.bool('is_demo', 'Временное изображение из референса'), f.image('image', 'Фотография', { required: true }), f.str('title', 'Подпись', { required: true }), f.str('image_alt', 'Описание фотографии'),
  ] },
  { collection: 'specialists', meta: { icon: 'people', group: 'group_content', sort_field: 'sort', display_template: '{{name}}', translations: ru('Специалисты') }, fields: [
    f.id(), f.status(), f.sort(), f.bool('is_demo', 'Демонстрационный профиль', false, { note: 'Включить для временных портретов: страница не индексируется и не попадает в sitemap.' }), f.slug(), f.str('name', 'Имя', { required: true }), f.str('role', 'Специализация', { required: true }),
    f.image('image', 'Портрет', { required: true }), f.str('image_alt', 'Описание фотографии'), f.int('focus_y', 'Положение кадра по вертикали, %', { note: 'От 0 до 100. По умолчанию 35.' }),
    f.html('body', 'Описание специалиста'),
    f.str('media_title', 'Заголовок медиараздела', { default: 'Знакомство со специалистом' }),
    f.text('media_description', 'Описание медиараздела'),
    f.o2m('media_items', 'Фото и видео', { template: '{{title}}', note: 'Добавьте материал: загрузите фотографию или видео с устройства. Для видео можно выбрать обложку. Порядок меняется перетаскиванием.' }),
    f.repeater('media', 'Ранее добавленные материалы (ссылки)', [
      rep('title', 'Заголовок'), rep('description', 'Подпись', 'text', 'input-multiline'),
      rep('image_url', 'Публичная ссылка на фото / обложку'), rep('image_alt', 'Описание изображения'), rep('focus_y', 'Положение кадра по вертикали, % (0–100)', 'integer'),
      rep('video_url', 'Прямая ссылка на видео (необязательно)'), rep('captions_url', 'Субтитры WebVTT (необязательно)'),
    ], { note: 'Порядок карточек меняется перетаскиванием. Фото обязательно. Новые видео загружайте через раздел «Фото и видео». Ссылки Telegram не поддерживаются. Только публичные HTTPS или локальные /media/... ссылки без access_token. Без видео карточка открывается как фотография.' }),
    ...seo(),
  ] },
);

collections.push({ collection: 'specialist_media', meta: { icon: 'perm_media', hidden: true, sort_field: 'sort', display_template: '{{title}}', translations: ru('Материалы специалистов') }, fields: [
  f.id(), f.sort(), { ...f.m2o('specialist', 'Специалист', 'specialists', { required: true, template: '{{name}}' }), meta: { ...f.m2o('specialist', 'Специалист', 'specialists', { required: true, template: '{{name}}' }).meta, hidden: true } },
  f.str('title', 'Заголовок', { required: true }), f.text('description', 'Подпись'),
  f.image('image', 'Фотография / обложка видео', { note: 'Для видео необязательно: без обложки показывается портрет специалиста.' }),
  f.str('image_alt', 'Описание фотографии'),
  f.file('video', 'Видеофайл', { note: 'MP4 (H.264/AAC) или WebM, до 50 МБ. Для видео с телефона выберите экспорт в MP4.', options: { mimeTypes: ['video/mp4', 'video/webm'] } }),
  ...timestamps(),
] });

function base_ts(field, label) {
  return base(field, 'timestamp', label, { interface: 'datetime', width: 'half', readonly: true });
}

/** Sidebar folders (collections with no table). */
export const groups = [
  { collection: 'group_content', meta: { icon: 'folder', translations: ru('Контент'), sort: 1, collapse: 'open' }, schema: null },
  { collection: 'group_gallery', meta: { icon: 'folder', translations: ru('Галерея до/после'), sort: 2, collapse: 'open' }, schema: null },
  { collection: 'group_reviews', meta: { icon: 'folder', translations: ru('Отзывы и FAQ'), sort: 3, collapse: 'open' }, schema: null },
  { collection: 'group_pages', meta: { icon: 'folder', translations: ru('Страницы'), sort: 4, collapse: 'open' }, schema: null },
  { collection: 'group_settings', meta: { icon: 'folder', translations: ru('Настройки'), sort: 5, collapse: 'closed' }, schema: null },
];

/** Relations: [collection, field, related_collection, {one_field, sort_field}] */
export const relations = [
  ['specialist_media', 'specialist', 'specialists', { one_field: 'media_items', sort_field: 'sort', on_delete: 'CASCADE', one_deselect_action: 'delete' }],
  ['procedures', 'category', 'service_categories', { one_field: 'procedures', sort_field: 'sort' }],
  ['procedures', 'device', 'devices', {}],
  ['price_items', 'procedure', 'procedures', { one_field: 'price_items', sort_field: 'sort' }],
  ['devices', 'procedure', 'procedures', {}],
  ['case_categories', 'procedure', 'procedures', {}],
  ['before_after_cases', 'category', 'case_categories', {}],
  ['before_after_cases', 'procedure', 'procedures', { one_field: 'cases', sort_field: 'sort' }],
  ['reviews', 'procedure', 'procedures', {}],
  ['faq_items', 'procedure', 'procedures', { one_field: 'faq', sort_field: 'sort' }],
];

/** File relations for `special: ['file']` (uuid → directus_files). */
export const fileFields = [];
for (const c of collections) {
  for (const fld of c.fields) {
    if (fld.meta?.special?.includes('file')) fileFields.push([c.collection, fld.field]);
  }
}

/** M2M to files via junction collections for `special: ['files']`. */
export const filesJunctions = [
  ['procedures', 'gallery'],
  ['pages', 'attachments'],
];

/** Folders for uploads. */
export const folders = ['Главная', 'Направления', 'Процедуры', 'Аппараты', 'До-после', 'Документы', 'Лого'];

export const contentCollections = collections.map((c) => c.collection).filter((c) => c !== 'build_log');
