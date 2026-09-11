# CONTENT-MAP — соответствие Wix URL и нового сайта

Сформировано 2026-09-10 скриптом `scripts/migrate/01-sitemap.mjs` из `https://www.peri-clinic.ru/pages-sitemap.xml`. Всего URL в sitemap: 38.

| Wix URL | Тип | Новый адрес | Примечание |
|---|---|---|---|
| https://www.peri-clinic.ru/heleo | procedure | /heleo |  |
| https://www.peri-clinic.ru/mikrotokovaya-terapiya | procedure | /mikrotokovaya-terapiya |  |
| https://www.peri-clinic.ru/pladuo | procedure | /pladuo |  |
| https://www.peri-clinic.ru/loyaltyprogram | legal_page | /loyaltyprogram |  |
| https://www.peri-clinic.ru/uhodovye-procedury | procedure | /uhodovye-procedury |  |
| https://www.peri-clinic.ru/normativno-parvovye-dokumenty | legal_page | /normativno-parvovye-dokumenty |  |
| https://www.peri-clinic.ru/microtoki | procedure | /microtoki | НЕ редирект на mikrotokovaya-terapiya, как предполагалось в исходном плане — реальная отдельная страница "Удаление новообразований Sensitec". |
| https://www.peri-clinic.ru/mezoterapiya-i-biorevitalizaciya | procedure | /mezoterapiya-i-biorevitalizaciya |  |
| https://www.peri-clinic.ru/копия-маски | redirect | 301 → /esteticheskaya-kosmetologiya | Заголовок "Чистки" — забытый backup-черновик, не совпадает по смыслу с /maski. |
| https://www.peri-clinic.ru/yuridicheskaya-informaciya | legal_page | /yuridicheskaya-informaciya | Хаб-страница со ссылками на прочие юр. документы. |
| https://www.peri-clinic.ru/profeccial | procedure | /profeccial |  |
| https://www.peri-clinic.ru/result | results | /result |  |
| https://www.peri-clinic.ru/soglashenie | legal_page | /soglashenie | Отдельное согласие на обработку персональных данных от 01.01.2026; повторно проверено 2026-09-11. |
| https://www.peri-clinic.ru/injekcionnaya-cosmetologiya | category | /injekcionnaya-cosmetologiya |  |
| https://www.peri-clinic.ru/rf-lifting-inmode | procedure | /rf-lifting-inmode |  |
| https://www.peri-clinic.ru/beautylizer | procedure | /beautylizer |  |
| https://www.peri-clinic.ru/plazmoterapiya-plazmolifting | procedure | /plazmoterapiya-plazmolifting |  |
| https://www.peri-clinic.ru/uslugi-i-ceny | services_overview | /uslugi-i-ceny |  |
| https://www.peri-clinic.ru/konturnaya-plastika | procedure | /konturnaya-plastika |  |
| https://www.peri-clinic.ru/apparatnaya-kosmetologiya | category | /apparatnaya-kosmetologiya |  |
| https://www.peri-clinic.ru/spravka | legal_page | /spravka |  |
| https://www.peri-clinic.ru/polzovatelskoe-soglashenie | legal_page | /polzovatelskoe-soglashenie |  |
| https://www.peri-clinic.ru/lipolitiki | procedure | /lipolitiki |  |
| https://www.peri-clinic.ru/копия-услуги-и-цены | redirect | 301 → /uslugi-i-ceny | Заголовок "бэкап Услуги и цены" — явный backup. |
| https://www.peri-clinic.ru/kosemotologicheskie-pilingi | procedure | /kosemotologicheskie-pilingi |  |
| https://www.peri-clinic.ru/uridicheskaya-informaciya | legal_page | /uridicheskaya-informaciya | Организационные документы — источник ОГРН/ИНН/лицензии. |
| https://www.peri-clinic.ru/pigment-lumec | procedure | /pigment-lumec |  |
| https://www.peri-clinic.ru/maski | procedure | /maski |  |
| https://www.peri-clinic.ru/kontakty-organov | legal_page | /kontakty-organov |  |
| https://www.peri-clinic.ru/botullinoterapiya | procedure | /botullinoterapiya |  |
| https://www.peri-clinic.ru/tesla-former | procedure | /tesla-former |  |
| https://www.peri-clinic.ru/laser-epilation | procedure | /laser-epilation |  |
| https://www.peri-clinic.ru/volnewmer | procedure | /volnewmer |  |
| https://www.peri-clinic.ru/poryadok-oplaty | legal_page | /poryadok-oplaty |  |
| https://www.peri-clinic.ru/politika | legal_page | /politika | Канонический документ 152-ФЗ. |
| https://www.peri-clinic.ru/esteticheskaya-kosmetologiya | category | /esteticheskaya-kosmetologiya |  |
| https://www.peri-clinic.ru/droppers | procedure | /droppers | Не в pages-sitemap.xml, но живая опубликованная страница ("Капельницы") — найдена как ссылка на странице категории. Slug оставлен как на Wix (droppers), не переименован в "kapelnicy", как предполагал исходный план. |
