/** Service videos in a real browser: the desktop row and the unchanged mobile carousel.
 * node scripts/qa/procedure-videos-desktop.mjs [base=http://127.0.0.1:4322] [path=/volnewmer]
 * The page needs at least four videos so that the row overflows at 1024 and 1440 px.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const base = process.argv[2] || 'http://127.0.0.1:4322';
const path = process.argv[3] || '/volnewmer';
const out = 'docs/qa/treatment-videos-desktop';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });

const state = page => page.evaluate(() => {
  const root = document.querySelector('.treatment-videos [data-home-reels]');
  const rail = root.querySelector('[data-reels-rail]');
  const bounds = rail.getBoundingClientRect();
  const end = bounds.right - parseFloat(getComputedStyle(rail).paddingRight);
  return {
    scrollLeft: rail.scrollLeft,
    tail: rail.style.getPropertyValue('--reels-tail'),
    current: [...root.querySelectorAll('[data-reels-dot]')].findIndex(dot => dot.getAttribute('aria-current') === 'true'),
    cards: [...root.querySelectorAll('[data-reel]')].map(card => {
      const box = card.getBoundingClientRect(), video = card.querySelector('video'), cover = card.querySelector('[data-reel-caption-toggle]');
      return {
        whole: box.left >= bounds.left - 1 && box.right <= end + 1, seen: box.right > bounds.left + 40 && box.left < bounds.right - 40,
        inert: card.inert, playing: !video.paused, muted: video.muted, poster: video.getAttribute('poster'),
        captionHidden: card.hasAttribute('data-caption-hidden'), coverHidden: cover.getAttribute('aria-hidden'), coverTab: cover.getAttribute('tabindex'),
      };
    }),
  };
});
const plays = (page, index) => page.waitForFunction(i => {
  const video = document.querySelectorAll('.treatment-videos [data-reel-video]')[i];
  return !video.paused && video.currentTime > .1 && !video.error;
}, index, { timeout: 30000 });
// A visitor clicks the visible part of the card, above its caption and controls.
const clickCard = async (page, index) => {
  const point = await page.evaluate(i => {
    const rail = document.querySelector('.treatment-videos [data-reels-rail]').getBoundingClientRect();
    const card = document.querySelectorAll('.treatment-videos [data-reel]')[i].getBoundingClientRect();
    return { x: (Math.max(card.left, rail.left) + Math.min(card.right, rail.right)) / 2, y: card.top + card.height * .35 };
  }, index);
  await page.mouse.click(point.x, point.y);
};
const open = async width => {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
  const reject = page.locator('[data-cookie-reject]');
  if (await reject.isVisible()) await reject.click();
  assert.equal(await page.locator('.treatment-videos [data-home-reels]').getAttribute('data-mobile-only'), null);
  // The site scrolls smoothly by default; instant jumps keep the measurements and clicks below deterministic.
  await page.locator('.treatment-videos').evaluate(el => scrollTo({ top: el.getBoundingClientRect().top + scrollY - 200, behavior: 'instant' }));
  await plays(page, 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no page overflow');
  return { context, page, errors };
};
const finish = async ({ context, page, errors }, width, checks) => {
  const axe = await new AxeBuilder({ page }).include('.treatment-videos').analyze();
  assert.deepEqual(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id), []);
  assert.deepEqual(errors, []);
  console.log(`PASS ${width}: ${checks}`);
  await context.close();
};
const capture = async (page, width) => {
  // The site scrolls smoothly by default; instant jumps keep the measurements and clicks below deterministic.
  await page.locator('.treatment-videos').evaluate(el => scrollTo({ top: el.getBoundingClientRect().top + scrollY - 200, behavior: 'instant' }));
  await page.waitForTimeout(2000);
  // Fixed panels are hidden only for the picture; every check runs with the real interface.
  const style = await page.addStyleTag({ content: '.header, .floating-contact, .cookie-notice, .mobile-cta-bar { visibility: hidden !important; }' });
  await page.screenshot({ path: `${out}/${width}.png` });
  await style.evaluate(element => element.remove());
};

try {
  for (const width of [1024, 1440]) {
    const session = await open(width);
    const { page } = session;
    let s = await state(page);
    assert.ok(s.cards.length >= 4, 'fixture needs an overflowing row');
    assert.equal(s.tail, '0px', 'no empty tail');
    assert.ok(s.cards.every(card => !card.inert), 'row cards stay clickable');
    assert.ok(s.cards[0].muted);
    assert.deepEqual([s.cards[0].coverHidden, s.cards[0].coverTab], [null, null]);
    assert.ok(s.cards.slice(1).every(card => card.coverHidden === 'true' && card.coverTab === '-1'), 'waiting covers left to the play buttons');
    await page.waitForFunction(() => [...document.querySelectorAll('.treatment-videos [data-reel-video]')].every(video => video.getAttribute('poster')));
    await capture(page, width);

    const inPlace = s.cards.findLastIndex((card, index) => index > 0 && card.whole);
    assert.ok(inPlace > 0);
    await clickCard(page, inPlace);
    await plays(page, inPlace);
    s = await state(page);
    assert.equal(s.current, inPlace);
    assert.equal(s.scrollLeft, 0, 'a whole card starts without moving the row');
    assert.equal(s.cards[0].playing, false);
    assert.equal(s.cards[0].captionHidden, false, 'the previous card shows its title again');

    const clipped = s.cards.findIndex(card => !card.whole && card.seen);
    assert.ok(clipped > inPlace, 'fixture needs a clipped card');
    await clickCard(page, clipped);
    await plays(page, clipped);
    await page.waitForTimeout(800);
    s = await state(page);
    assert.equal(s.current, clipped);
    assert.ok(s.cards[clipped].whole, 'a clipped card scrolls in whole');

    if (clipped + 1 < s.cards.length) {
      await page.evaluate(i => { const video = document.querySelectorAll('.treatment-videos [data-reel-video]')[i]; video.currentTime = video.duration - .3; }, clipped);
      await plays(page, clipped + 1);
      await page.waitForTimeout(800);
      s = await state(page);
      assert.equal(s.current, clipped + 1, 'the next clip follows');
      assert.ok(s.cards[clipped + 1].whole);
    }

    await page.locator('.treatment-videos [data-reels-rail]').focus();
    await page.keyboard.press('Home');
    await plays(page, 0);
    s = await state(page);
    assert.deepEqual([s.current, s.scrollLeft], [0, 0], 'keyboard returns to the first card');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => [...document.querySelectorAll('.treatment-videos [data-reel-video]')].every(video => video.paused));
    await page.locator('.treatment-videos [data-reel]').nth(1).locator('[data-reel-toggle]').click();
    await plays(page, 1);
    assert.equal((await state(page)).current, 1);
    await finish(session, width, 'row, posters, in-place start, reveal, advance, keyboard, reduced motion, axe');
  }

  for (const width of [375, 800]) {
    const session = await open(width);
    const { page } = session;
    let s = await state(page);
    assert.ok(s.cards.slice(1).every(card => card.inert), 'mobile keeps the carousel');
    assert.ok(s.cards.every(card => card.coverHidden === null && card.coverTab === null));
    assert.ok(parseFloat(s.tail) > 0, 'carousel tail lets the last card reach the start');
    await capture(page, width);
    // Keep the dots clear of the fixed header and the mobile call bar, as a visitor would.
    const dot = page.locator('.treatment-videos [data-reels-dot]').nth(1);
    await dot.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await dot.click();
    await plays(page, 1);
    s = await state(page);
    assert.equal(s.current, 1);
    assert.equal(s.cards[0].playing, false);
    await finish(session, width, 'carousel, inert neighbours, tail, dot navigation, axe');
  }

  {
    const session = await open(1440);
    const { page } = session;
    const button = (index, control) => page.locator('.treatment-videos [data-reel]').nth(index).locator(control);
    const count = (await state(page)).cards.length;
    for (let i = 0; i < count; i++) {
      await plays(page, i);
      await page.evaluate(i => { const video = document.querySelectorAll('.treatment-videos [data-reel-video]')[i]; video.currentTime = video.duration - .3; }, i);
      if (i + 1 < count) await page.waitForFunction(next => [...document.querySelectorAll('.treatment-videos [data-reels-dot]')].findIndex(dot => dot.getAttribute('aria-current') === 'true') === next, i + 1);
    }
    await page.locator('.treatment-videos [data-reels-rail]').focus();
    await page.keyboard.press('Home');
    await button(0, '[data-reel-toggle]').click();
    await plays(page, 0);
    await page.waitForTimeout(1500);
    let s = await state(page);
    assert.equal(s.current, 0, 'a finished clip that was unloaded replays from its start');

    const clipped = s.cards.findIndex(card => !card.whole && card.seen);
    await button(clipped, '[data-reel-toggle]').click();
    await plays(page, clipped);
    await page.evaluate(() => document.querySelector('.treatment-videos [data-reels-rail]').scrollTo({ left: 0, behavior: 'instant' }));
    await page.waitForFunction(i => document.querySelectorAll('.treatment-videos [data-reel-video]')[i].paused, clipped);
    const play = await button(clipped, '[data-reel-toggle]').boundingBox();
    await page.mouse.click(play.x + play.width / 2, play.y + play.height / 2);
    await plays(page, clipped);
    await page.waitForTimeout(800);
    assert.ok((await state(page)).cards[clipped].whole, 'the play button of a clipped active card scrolls it in');

    await page.evaluate(() => document.querySelector('.treatment-videos [data-reels-rail]').scrollTo({ left: 0, behavior: 'instant' }));
    await button(0, '[data-reel-toggle]').click();
    await plays(page, 0);
    await button(2, '[data-reel-mute]').click();
    await plays(page, 2);
    s = await state(page);
    assert.deepEqual([s.current, s.cards[0].playing, s.cards[2].muted], [2, false, false], 'sound on a waiting card starts that card with sound');

    await page.setViewportSize({ width: 700, height: 1000 });
    await page.waitForTimeout(800);
    await plays(page, 2);
    assert.equal((await state(page)).current, 2, 'leaving the row keeps the chosen clip');
    await finish(session, 1440, 'replay after unloading, clipped active card, sound on a waiting card, leaving the row');
  }
} finally { await browser.close(); }
