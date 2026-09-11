import { test } from 'node:test';
import assert from 'node:assert/strict';
import { em, telHref, whatsappHref, phoneDigits, formatRuDate, formatPrice } from './markup.ts';

test('em(): underscores become <em>, newlines become <br>, html is escaped', () => {
  assert.equal(em('Красота,\n_основанная_\nна медицине'), 'Красота,<br><em>основанная</em><br>на медицине');
  assert.equal(em('a & <b>'), 'a &amp; &lt;b&gt;');
  assert.equal(em(''), '');
  assert.equal(em(undefined), '');
});

test('phoneDigits()/telHref(): strips formatting and keeps leading +', () => {
  assert.equal(phoneDigits('+7 925 017-77-78'), '79250177778');
  assert.equal(telHref('+7 925 017-77-78'), 'tel:+79250177778');
  assert.equal(telHref('8 (925) 017-77-78'), 'tel:+79250177778');
});

test('whatsappHref(): wa.me link with encoded prefilled text', () => {
  assert.equal(
    whatsappHref('+7 925 017-77-78', 'Здравствуйте! Хочу записаться на Volnewmer'),
    'https://wa.me/79250177778?text=' + encodeURIComponent('Здравствуйте! Хочу записаться на Volnewmer'),
  );
  assert.equal(whatsappHref('+7 925 017-77-78'), 'https://wa.me/79250177778');
});

test('formatRuDate(): ISO date becomes DD.MM.YYYY', () => {
  assert.equal(formatRuDate('2026-08-12'), '12.08.2026');
  assert.equal(formatRuDate('2026-08-12T00:00:00.000Z'), '12.08.2026');
  assert.equal(formatRuDate(null), '');
  assert.equal(formatRuDate(''), '');
});

test('formatPrice(): thousands-separated rubles, null passes through', () => {
  assert.equal(formatPrice(500), '500 ₽');
  assert.equal(formatPrice(15000), '15 000 ₽');
  assert.equal(formatPrice(2500000), '2 500 000 ₽');
  assert.equal(formatPrice(null), null);
});
