import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPath } from './seo.ts';

test('canonicalPath(): file-format build paths become the clean URLs nginx serves', () => {
  assert.equal(canonicalPath('/index.html'), '/');
  assert.equal(canonicalPath('/'), '/');
  assert.equal(canonicalPath('/result.html'), '/result');
  assert.equal(canonicalPath('/result'), '/result');
  assert.equal(canonicalPath('/result/'), '/result');
  assert.equal(canonicalPath('/uslugi-i-ceny.html'), '/uslugi-i-ceny');
  assert.equal(canonicalPath('/404.html'), '/404');
  assert.equal(canonicalPath('kontakty.html'), '/kontakty');
});

import { seoText, medicalClinicJsonLd, webPageJsonLd } from './seo.ts';

test('SEO metadata removes CMS formatting while preserving text', () => {
  assert.equal(seoText(' <p>Инъекционная\n_косметология_ &amp; уход</p> '), 'Инъекционная косметология & уход');
});
test('Clinic and pages share stable IDs on the configured origin', () => {
  const origin = 'https://prod.peri-clinic.zumrudin.ru/';
  const clinic = medicalClinicJsonLd({name:'PERI CLINIC',phone:'+79250177778',city:'Москва',address_short:'ул. Генерала Белова, 28',hours:'Ежедневно, 10:00–22:00',nearest_metro:'Домодедовская',metro_walk_time:'7 минут пешком',metro_directions:'Выход к улице Генерала Белова.'},origin,origin+'logo.png');
  assert.equal(clinic['@id'], origin+'#clinic');
  assert.equal(clinic.openingHours, 'Mo-Su 10:00-22:00');
  assert.equal(clinic.address?.addressLocality, 'Москва');
  assert.equal(clinic.amenityFeature?.name, 'Метро Домодедовская — 7 минут пешком');
  assert.equal(clinic.additionalProperty?.value, 'Выход к улице Генерала Белова.');
  assert.equal(webPageJsonLd(origin+'result','Результаты','Фото',origin).about['@id'],clinic['@id']);
});

import { areaServedJsonLd, geoMeta, localTitle } from './seo.ts';

const place = { district: 'Орехово-Борисово Южное', okrug: 'Южный административный округ', okrugShort: 'ЮАО', postalCode: '115583', regionCode: 'RU-MOW', latitude: 55.6049, longitude: 37.7217 };

test('Clinic JSON-LD carries the district, okrug and coordinates without any visible copy', () => {
  const origin = 'https://www.peri-clinic.ru/';
  const clinic = medicalClinicJsonLd({name:'PERI CLINIC',phone:'+79250177778',city:'Москва',address_short:'Москва, ул. Генерала Белова, 28, корпус 3',nearest_metro:'Домодедовская'},origin,origin+'logo.png',place);
  // The CMS address starts with the city for readers; schema wants the street alone.
  assert.equal(clinic.address?.streetAddress, 'ул. Генерала Белова, 28, корпус 3');
  assert.equal(clinic.address?.postalCode, '115583');
  assert.deepEqual(clinic.geo, { '@type': 'GeoCoordinates', latitude: 55.6049, longitude: 37.7217 });
  assert.deepEqual(clinic.areaServed?.map((a) => a.name), ['Орехово-Борисово Южное', 'Южный административный округ', 'ЮАО', 'Москва']);
  assert.deepEqual(clinic.containedInPlace, { '@type': 'AdministrativeArea', name: 'Орехово-Борисово Южное, ЮАО, Москва' });
  assert.match(clinic.description ?? '', /метро Домодедовская/);
  assert.match(clinic.description ?? '', /ЮАО/);
});
test('Without location facts the clinic node stays as before', () => {
  const clinic = medicalClinicJsonLd({name:'PERI CLINIC',phone:'+7',city:'Москва',address_short:'ул. Генерала Белова, 28'},'https://x/','https://x/l.png');
  assert.equal(clinic.geo, undefined);
  assert.equal(clinic.areaServed, undefined);
  assert.equal(clinic.address?.postalCode, undefined);
});
test('areaServedJsonLd(): city alone when no location facts are passed', () => {
  assert.deepEqual(areaServedJsonLd('Москва').map((a) => a.name), ['Москва']);
});
test('geoMeta(): region, place name and both coordinate notations', () => {
  assert.deepEqual(geoMeta('Москва', place), {
    'geo.region': 'RU-MOW', 'geo.placename': 'Москва, ЮАО, Орехово-Борисово Южное',
    'geo.position': '55.6049;37.7217', ICBM: '55.6049, 37.7217',
  });
});
test('localTitle(): swaps the city-wide phrase for the metro, leaves other titles alone', () => {
  assert.equal(localTitle('Косметология в Москве: услуги и цены — PERI CLINIC', 'Домодедовская'), 'Косметология метро Домодедовская: услуги и цены — PERI CLINIC');
  assert.equal(localTitle('Косметология в Москве: услуги и цены — PERI CLINIC', ''), 'Косметология в Москве: услуги и цены — PERI CLINIC');
  assert.equal(localTitle('Контакты PERI CLINIC у метро Домодедовская', 'Домодедовская'), 'Контакты PERI CLINIC у метро Домодедовская');
});
