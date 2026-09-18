"""Build a review register from a read-only CMS snapshot and verified normative text.

Run from the repository root. Requires the downloaded source text at the explicit
temporary path below. Does not modify the CMS or publish any proposed codes.
"""
from pathlib import Path
import csv
import hashlib
import json
import re
from collections import Counter

ROOT = Path('docs/medical-codes/2026-09-18')
PDF_URL = 'https://zubalmaz.ru/wp-content/uploads/2023/11/prikaz_mzrf_13.10.2017_804n_v24.09.2020_izm26.10.2022.pdf'
OFFICIAL = 'https://publication.pravo.gov.ru/Document/View/0001201711080036'
text = Path('/tmp/peri-804n-alt.txt').read_text()
catalog = {}
for page, content in enumerate(text.split('\f'), 1):
    lines = content.splitlines()
    for i, line in enumerate(lines):
        match = re.match(r'^([AB]\d{2}\.\d{2,3}\.\d{3}(?:\.\d{3})?)\s+(.+)', line)
        if not match:
            continue
        code, name = match.groups()
        j = i + 1
        while j < len(lines) and lines[j].startswith(' ') and lines[j].strip():
            name += ' ' + lines[j].strip()
            j += 1
        catalog[code] = {'name': name, 'page': page}

# A code's presence in the nomenclature and its applicability to a clinic protocol
# are separate findings. Candidate codes never populate the recommended field.
DIRECT = 'Соответствует описанному вмешательству'
CONDITIONAL = 'Условно: требуется подтверждение протокола'
PENDING = 'Код не установлен по имеющимся данным'
MATERIAL = 'Расходный материал, не отдельное вмешательство'

def result(code='', candidates=(), note='', status=None):
    return {'status': status or (DIRECT if code else CONDITIONAL if candidates else PENDING),
            'code': code, 'candidates': list(candidates), 'note': note}

def classify(slug, name):
    if slug == 'pigment-lumec':
        return result('A20.01.005', note='Соответствие на уровне фототерапии кожи (IPL). Это не лазерная коагуляция; название аппарата и зона не создают новый код.')
    if slug == 'laser-epilation':
        return result('A14.01.013', note='Проведение эпиляции. Зоны, пол пациента и количество сеансов — характеристики тарифа; код A14.01.012 обозначает депиляцию.')
    if slug == 'kosemotologicheskie-pilingi':
        if 'МИЛАЙН' in name:
            return result(candidates=['A16.01.024'], note='Только если это дерматологический пилинг. Название отбеливающей программы само по себе не подтверждает вмешательство; для интимных зон уточнить кожу/слизистую и метод.')
        return result('A16.01.024', note='Для заявленного в каталоге дерматологического пилинга. Марка состава не изменяет код услуги.')
    if slug == 'konturnaya-plastika':
        if 'Лонгидаза' in name:
            return result(candidates=['A11.01.002', 'A11.01.003'], note='Это не введение наполнителя. Нужны цель и путь введения: подкожный или внутрикожный. Код выбирается по фактическому вмешательству, а не по названию средства.')
        if 'Увлажнение' in name:
            return result(candidates=['A11.01.003', 'A11.01.012', 'A11.01.013'], note='Увлажнение губ не подтверждает коррекцию формы. Уточнить вмешательство, слой введения, назначение и регистрационную категорию вводимого материала.')
        return result('A11.01.013', note='Для заявленной коррекции формы искусственным наполнителем. Если фактически выполняется иное вмешательство, нужна переклассификация. A16.01.026 — отдельное существующее название «Внутрикожная контурная пластика», не второй обязательный код той же инъекции.')
    if slug == 'mezoterapiya-i-biorevitalizaciya':
        return result(candidates=['A11.01.003', 'A11.01.012'], note='Раздел объединяет разные вмешательства. A11.01.003 — только внутрикожное введение лекарственного препарата; A11.01.012 — введение искусственного имплантата в мягкие ткани. Выбрать по протоколу и регистрационной документации. Название средства само по себе не даёт кода.')
    if slug == 'botullinoterapiya':
        if 'гипергидроз' in name.lower():
            return result(candidates=['A11.01.003'], note='Подходит при подтверждённом внутрикожном введении лекарственного препарата. Нельзя переносить код внутримышечной инъекции из остальных строк ботулинотерапии.')
        return result(candidates=['A11.02.002', 'A11.01.003'], note='A11.02.002 — при внутримышечном введении, A11.01.003 — при внутрикожном. Требуется путь введения для конкретного протокола; зона и единицы токсина этого не доказывают.')
    if slug == 'droppers':
        return result('A11.12.003', note='Для заявленного внутривенного введения лекарственных препаратов. Это код введения, не лечебного эффекта программы. A11.12.003.001 — отдельный подвид непрерывного введения, выбирать при соответствующем протоколе. Курс — количество процедур, не новый код.')
    if slug == 'heleo':
        if name.strip().upper() == 'LED':
            return result('A20.01.005', note='Фототерапия кожи; самостоятельное LED-воздействие без фотосенсибилизатора не обозначать кодом фотодинамической терапии.')
        return result(candidates=['A22.01.007', 'A20.01.005'], note='A22.01.007 — фотодинамическая терапия при указанных в номенклатуре заболеваниях и соответствующем протоколе; A20.01.005 — фототерапия кожи. В описании клиники есть оба режима, а строка прайса режим не уточняет.')
    if slug == 'mikrotokovaya-terapiya':
        return result(candidates=['A17.01.009'] if 'Лимфодренаж' in name else ['A17.01.010'], note='Нужно подтвердить медицинский протокол: официальное название содержит «при заболеваниях кожи и подкожной клетчатки». Уход/маска в составе программы не получают автоматически этот код.')
    if slug == 'plazmoterapiya-plazmolifting':
        return result(note='Для всей PRP-процедуры однозначный код не установлен. Аутоплазму нельзя автоматически считать лекарственным препаратом или искусственным наполнителем. A11.12.009 описывает только взятие крови, не всю плазмотерапию.')
    if slug == 'lipolitiki':
        return result(candidates=['A11.01.002'], note='Только для подкожного введения лекарственного препарата. Сначала подтвердить путь введения и регистрационный статус применяемого средства; код не подтверждает допустимость инъекционного применения косметики.')
    if slug in ['volnewmer', 'rf-lifting-inmode']:
        return result(note='Название RF-лифтинга не позволяет автоматически выбрать A17.01.008 (токи ультравысокой частоты). Требуются инструкция/РУ аппарата, параметры и описание вмешательства; для Morpheus8 — также сведения об абляции/коагуляции. Код по сходству не назначен.')
    if slug == 'pladuo':
        return result(note='Аргоновая/азотная плазма не равна лазерной шлифовке или плазмотерапии кровью. Нужны РУ, инструкция и конкретный режим воздействия. Код не выбран.')
    if slug == 'tesla-former':
        return result(note='В описании клиники указана магнитная стимуляция мышц. Автоматически относить её к электростимуляции мышц A17.02.001 нельзя; нужна документация и описание медицинского вмешательства.')
    if slug == 'beautylizer':
        return result(note='RSL с вращающимися сферами не подтверждает вакуумный массаж A21.01.007. Требуются протокол, зоны и обоснование медицинского массажа; единый точный код для всей программы не установлен.')
    if slug == 'profeccial':
        if 'Аквапилинг' in name:
            return result(candidates=['A16.01.024'], note='Если фактически выполняется дерматологический пилинг. Аквапилинг не равен ультразвуковому пилингу A22.01.001.002. Для комбинированной программы нужен состав вмешательств.')
        return result(note='Многофункциональный аппарат: программа «Голливуд» и RF-воздействие не имеют подтверждённого единого кода по торговому названию. Нужны этапы и инструкция аппарата.')
    if slug == 'uhodovye-procedury':
        if 'PRXT33' in name:
            return result(candidates=['A16.01.024'], note='Если основное вмешательство — дерматологический пилинг. Для всей экспресс-программы нужно описание этапов.')
        return result(note='Моделирующая/лифтинг-программа и маска не раскрывают медицинское вмешательство. Нельзя автоматически использовать код парафиновой маски или медицинского массажа.')
    if slug == 'maski':
        return result(note='В каталоге увлажняющие, успокаивающие и альгинатные маски. A20.01.001 означает именно парафиновую маску; универсального кода всем перечисленным маскам не назначено.')
    if slug == 'kosmetologicheskie-chistki':
        return result(candidates=['A14.01.009', 'A14.01.010', 'A22.01.001.002'], note='Коды отдельных фактически выполняемых этапов: удаление комедонов/милиумов, ультразвуковой пилинг. Это не готовый набор для каждой чистки; нужны состав и метод. A14.01.005 не использован как универсальный код всей услуги.')
    if slug == 'microtoki':
        return result(candidates=['A16.01.017', 'A16.01.017.001'], note='Несмотря на slug microtoki, название — Sensitec, удаление новообразований. Общий код — только для доброкачественных новообразований кожи; подвид .001 — только при электрокоагуляции. Нужны диагноз и метод.')
    raise ValueError((slug, name))

procedures = json.loads((ROOT/'procedures-source.json').read_text())
items = json.loads((ROOT/'price-items-source.json').read_text())
titles = {p['slug']: p['title'] for p in procedures}
rows = []
for item in sorted(items, key=lambda x: x['id']):
    slug = item['procedure']['slug']
    rows.append({'scope': 'Актуальный прайс Directus', 'id': str(item['id']), 'slug': slug,
                 'service': titles[slug], 'item': item['name'], **classify(slug, item['name'])})
for p in procedures:
    if not any(x['procedure']['slug'] == p['slug'] for x in items):
        rows.append({'scope': 'Каталог без строки цены', 'id': '', 'slug': p['slug'],
                     'service': p['title'], 'item': '', **classify(p['slug'], p['title'])})

# These archive sections were explicitly omitted by the price seed. Preserve their
# provenance so they are not mistaken for currently published CMS services.
archive = json.loads(Path('docs/references/wix-price-viewer/price-list.json').read_text())
archive_ids = {'dermatology-consultation', 'trichology-consultation', 'collagen-therapy',
               'stimulators', 'injection-extra', 'aesthetic-extra'}
for section in archive['sections']:
    for category in section['subcategories']:
        slug = category['id']
        if slug not in archive_ids:
            continue
        for item in category['services']:
            name = item['name']
            if slug == 'dermatology-consultation':
                data = result('B01.008.003' if 'первичная' in name else 'B01.008.004', note='Приём врача-косметолога; статус главного врача не создаёт отдельный код услуги.')
            elif slug == 'trichology-consultation':
                data = result(candidates=['B01.008.001' if 'первичная' in name else 'B01.008.002'], note='Если приём ведёт врач-дерматовенеролог. Требуется подтверждение специальности; название «трихолог» само по себе этого не устанавливает.')
            elif slug == 'aesthetic-extra':
                data = result('A21.01.010', note='Пирсинг. Серьги — включённый материал, не отдельный код медицинского вмешательства.')
            elif slug == 'injection-extra' and 'Канюля' in name:
                data = result(status=MATERIAL, note='Канюля — расходный материал. Не подменять кодом катетеризации или самостоятельной инъекции.')
            elif slug == 'injection-extra':
                data = result(candidates=['B01.003.004.001'], note='Местная анестезия: подтвердить фактический метод и то, как этап включён в услугу. «1 зона» метод не определяет.')
            else:
                data = result(candidates=['A11.01.012', 'A11.01.013', 'A11.01.003'], note='Коллагенотерапия/стимуляция коллагена — цель или торговое описание. Код зависит от вмешательства: имплантат, наполнитель для коррекции формы либо внутрикожное введение лекарства. Сочетания с плазмой требуют отдельного описания.')
            rows.append({'scope': 'Архив прайса 17.04.2026; актуальность не подтверждена',
                         'id': '', 'slug': slug, 'service': category['name'], 'item': name, **data})

used = sorted({code for row in rows for code in ([row['code']] if row['code'] else []) + row['candidates']}
              | {'A16.01.026', 'A11.12.009', 'A11.12.003.001', 'A17.01.008', 'A17.02.001', 'A21.01.007', 'A20.01.001', 'A14.01.012'})
assert all(c in catalog for c in used)
assert len(items) == 221 and len(procedures) == 21
assert len({x['id'] for x in rows if x['scope'] == 'Актуальный прайс Directus'}) == 221

fields = ['Источник перечня', 'ID строки Directus', 'Slug', 'Услуга', 'Позиция прайса',
          'Статус соответствия', 'Код по описанию услуги', 'Официальное название',
          'Коды только для проверки протокола', 'Названия условных кодов', 'Основание и ограничения', 'Источник кода']
with (ROOT/'service-codes.csv').open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f, delimiter=';')
    writer.writerow(fields)
    for row in rows:
        codes = ([row['code']] if row['code'] else []) + row['candidates']
        writer.writerow([row['scope'], row['id'], row['slug'], row['service'], row['item'], row['status'],
                         row['code'], catalog[row['code']]['name'] if row['code'] else '',
                         ' | '.join(row['candidates']), ' | '.join(catalog[c]['name'] for c in row['candidates']),
                         row['note'], ' | '.join(f'{PDF_URL}#page={catalog[c]["page"]}' for c in codes)])

(ROOT/'service-codes.json').write_text(json.dumps({'date': '2026-09-18', 'rows': rows,
    'codebook': {c: {**catalog[c], 'source': f'{PDF_URL}#page={catalog[c]["page"]}'} for c in used}}, ensure_ascii=False, indent=2)+'\n')
codebook = ['# Проверенные коды и точные наименования', '',
    'Источник — текст приказа № 804н, редакция от 24.09.2020 с изменениями от 26.10.2022. Номер страницы — в PDF, считая обложку первой страницей.', '',
    '**Наличие кода в этой таблице не означает, что он назначен услуге клиники.** Часть кодов приведена для условного выбора или объяснения неподходящих соответствий.', '',
    '| Код | Официальное наименование | Страница источника |', '|---|---|---|']
for c in used:
    codebook.append(f'| {c} | {catalog[c]["name"]} | [стр. {catalog[c]["page"]}]({PDF_URL}#page={catalog[c]["page"]}) |')
codebook += ['', f'Официальное опубликование исходного приказа: {OFFICIAL}',
             '', 'SHA-256 проверенного PDF: '+hashlib.sha256(Path('/tmp/peri-804n-alt.pdf').read_bytes()).hexdigest()]
(ROOT/'verified-codebook.md').write_text('\n'.join(codebook)+'\n')
print(json.dumps({'all_rows_including_archive': len(rows), 'current_price': dict(Counter(x['status'] for x in rows if x['scope']=='Актуальный прайс Directus')), 'verified_codes': len(used)}, ensure_ascii=False))
