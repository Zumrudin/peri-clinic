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
  assert.equal(clinic.directions, 'Выход к улице Генерала Белова.');
  assert.equal(webPageJsonLd(origin+'result','Результаты','Фото',origin).about['@id'],clinic['@id']);
});
