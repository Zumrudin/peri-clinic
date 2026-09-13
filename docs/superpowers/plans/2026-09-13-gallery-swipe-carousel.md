# Плавный зацикленный драг для галерей на главной — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two home-page gallery rails ("О клинике" clinic photos and "Специалисты" team) visually follow the finger/pointer while dragging, instead of only reacting on release, while keeping the existing infinite loop, keyboard nav, buttons and click-guard exactly as they are.

**Architecture:** Both rails already share one behavior script, `src/scripts/photo-gallery.ts`, and its `gestures()` helper (used for both rail dragging and the lightbox image swipe). We extend `gestures()` with an optional "live" mode used only by the two rails: during `pointermove` it applies a clamped `transform: translateX()` to the rail so it tracks the pointer, and on release it either commits into the existing DOM-rotation `rotate()` (which keeps doing the infinite loop + FLIP animation, unchanged) or springs back with a short CSS transition. The lightbox image swipe (`gestures(image, ...)`) keeps calling the function without the new option, so its behavior is byte-for-byte unchanged.

**Tech Stack:** Vanilla TypeScript (`src/scripts/photo-gallery.ts`), Astro component (`src/components/gallery/Gallery.astro`, unchanged), Playwright-core E2E QA scripts (`scripts/qa/about-clinic.mjs`, `scripts/qa/about-clinic-edge.mjs`) as this repo's test suite for browser interaction code (there is no jsdom/unit-test harness for `src/scripts/*.ts`).

Spec: `docs/superpowers/specs/2026-09-13-gallery-swipe-carousel-design.md`

---

## Before you start

This repo has no unit-test harness for DOM scripts (`npm test` only runs `node --test` over `src/**/*.test.ts`, and none exist for `src/scripts/`). The existing convention is Playwright-core QA scripts under `scripts/qa/` acting as the test suite for exactly this kind of interaction code — `scripts/qa/about-clinic.mjs` and `scripts/qa/about-clinic-edge.mjs` already assert on the rails' drag/rotate/lightbox behavior. This plan extends those two files instead of inventing a new test mechanism.

You'll need a running dev server that serves live TypeScript (not `astro preview`, which serves a stale build). The sandbox this plan was written in already has other unrelated dev/preview servers running on ports 4321/4322/4332/4333 (other people's sessions on a shared box — do not touch or kill them). Start your own isolated instance on an explicit, unlikely-to-collide port for all QA runs in this plan:

```bash
cd /root/peri-clinnic.ru
npm run dev -- --port 4399 > /tmp/gallery-qa-dev.log 2>&1 &
echo $! > /tmp/gallery-qa-dev.pid
```

Wait until it's serving (poll, don't sleep-guess):

```bash
until curl -s -o /dev/null http://127.0.0.1:4399/; do sleep 1; done
curl -s http://127.0.0.1:4399/ | grep -o 'astro-dev-toolbar' | head -n1   # confirms this is the *dev* server, not a stale preview
```

Expected: prints `astro-dev-toolbar` (present in dev builds only).

Chrome is already present at `/usr/bin/google-chrome` (matches the `executablePath` the QA scripts use), and Directus is already running via pm2 (`peri-directus`), which the content loaders need even in dev mode — no extra setup required there.

At the end of the plan (last step of Task 3), stop the dev server:

```bash
kill "$(cat /tmp/gallery-qa-dev.pid)"
```

---

### Task 1: Live-follow drag on the rails, verified via `about-clinic.mjs`

**Files:**
- Modify: `scripts/qa/about-clinic.mjs:44-48` (extend the existing drag assertions)
- Modify: `src/scripts/photo-gallery.ts:49-58` (the `gestures` function) and `src/scripts/photo-gallery.ts:82` (its rail call site)

- [ ] **Step 1: Extend the QA script with live-follow and spring-back assertions (still against the OLD, unmodified script — this must fail first)**

Open `scripts/qa/about-clinic.mjs`. Find this block (currently lines 44-48):

```js
    // Drag must rotate without opening a photo.
    const box=await team.locator('[data-photo]').first().boundingBox();
    await page.mouse.move(box.x+box.width*.7,box.y+100);
    await page.mouse.down(); await page.mouse.move(box.x+box.width*.2,box.y+100,{steps:8}); await page.mouse.up();
    assert.equal(await dialog.evaluate(d=>d.open),false);
```

Replace it with:

```js
    // Drag must rotate without opening a photo, following the finger live and looping.
    const rail=team.locator('[data-rail]');
    const box=await team.locator('[data-photo]').first().boundingBox();
    const overflowing=await team.locator('.gallery-nav').isVisible();
    const beforeDragId=await team.locator('[data-photo]').first().getAttribute('data-id');
    await page.mouse.move(box.x+box.width*.7,box.y+100);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.45,box.y+100,{steps:8});
    if (overflowing) assert.notEqual(await rail.evaluate(el=>getComputedStyle(el).transform),'none'); // live-follow mid-drag
    await page.mouse.move(box.x+box.width*.2,box.y+100,{steps:8});
    await page.mouse.up();
    assert.equal(await dialog.evaluate(d=>d.open),false);
    if (overflowing) {
      assert.notEqual(await team.locator('[data-photo]').first().getAttribute('data-id'),beforeDragId); // committed rotate
      assert.equal(await rail.evaluate(el=>getComputedStyle(el).transform),'none'); // settled, no leftover transform
      // Short drag below the commit threshold must spring back without rotating.
      const beforeShortDragId=await team.locator('[data-photo]').first().getAttribute('data-id');
      await page.mouse.move(box.x+box.width*.5,box.y+100);
      await page.mouse.down();
      await page.mouse.move(box.x+box.width*.35,box.y+100,{steps:4});
      await page.mouse.up();
      await page.waitForFunction(()=>{
        const el=document.querySelector('[data-gallery="clinic-team"] [data-rail]');
        return el && getComputedStyle(el).transform==='none';
      });
      assert.equal(await team.locator('[data-photo]').first().getAttribute('data-id'),beforeShortDragId);
    }
```

- [ ] **Step 2: Run against the unmodified source and confirm it FAILS**

```bash
node scripts/qa/about-clinic.mjs http://127.0.0.1:4399
```

Expected: an `AssertionError` on the `assert.notEqual(...,'none')` live-follow check (the rail's `transform` is still `'none'` mid-drag, because `photo-gallery.ts` hasn't changed yet). This confirms the new assertion actually exercises new behavior.

- [ ] **Step 3: Implement live-follow drag in `gestures()`**

Open `src/scripts/photo-gallery.ts`. Replace the whole `gestures` function (currently lines 49-58):

```ts
  const gestures = (element: HTMLElement, move: (direction: number) => void) => {
    let startX = 0, startY = 0, tracking = false, dragged = false;
    element.addEventListener('dragstart', e => e.preventDefault());
    element.addEventListener('pointerdown', e => { if (e.button !== 0) return; startX = e.clientX; startY = e.clientY; tracking = true; dragged = false; });
    element.addEventListener('pointermove', e => { if (tracking && Math.abs(e.clientX - startX) > 10 && Math.abs(e.clientX - startX) > Math.abs(e.clientY - startY)) { dragged = true; if (!element.hasPointerCapture(e.pointerId)) element.setPointerCapture(e.pointerId); } });
    element.addEventListener('pointerup', e => { if (!tracking) return; tracking = false; const dx = e.clientX - startX; if (dragged && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - startY)) move(dx < 0 ? 1 : -1); });
    element.addEventListener('pointercancel', () => { tracking = false; dragged = false; });
    element.addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopImmediatePropagation(); dragged = false; } }, true);
  };
```

with:

```ts
  // `live` (rails only — lightbox image swipe keeps the plain snap-on-release behavior) makes the
  // element visually track the pointer during drag, then either commits into `move()` (which does the
  // real DOM-rotation infinite loop) or springs back, instead of only reacting on release.
  const gestures = (element: HTMLElement, move: (direction: number) => void, live?: { step: () => number; overflow: () => boolean }) => {
    let startX = 0, startY = 0, tracking = false, dragged = false, cardStep = 0, dragEnabled = false;
    const resetTransform = (animate: boolean) => {
      if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.style.transition = 'transform 200ms ease-out';
        element.addEventListener('transitionend', () => { element.style.transition = ''; }, { once: true });
      } else {
        element.style.transition = '';
      }
      element.style.transform = '';
    };
    element.addEventListener('dragstart', e => e.preventDefault());
    element.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      startX = e.clientX; startY = e.clientY; tracking = true; dragged = false;
      if (live) { cardStep = live.step(); dragEnabled = cardStep > 0 && live.overflow(); }
    });
    element.addEventListener('pointermove', e => {
      if (!tracking) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        dragged = true;
        if (!element.hasPointerCapture(e.pointerId)) element.setPointerCapture(e.pointerId);
        if (live && dragEnabled) {
          const clamped = Math.max(-cardStep, Math.min(cardStep, dx));
          element.style.transition = '';
          element.style.transform = `translateX(${clamped}px)`;
        }
      }
    });
    element.addEventListener('pointerup', e => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!live) {
        if (dragged && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
        return;
      }
      if (!dragEnabled) return;
      if (dragged && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > cardStep * 0.25) {
        resetTransform(false);
        move(dx < 0 ? 1 : -1);
      } else {
        resetTransform(true);
      }
    });
    element.addEventListener('pointercancel', () => {
      tracking = false; dragged = false;
      if (live && dragEnabled) resetTransform(true);
    });
    element.addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopImmediatePropagation(); dragged = false; } }, true);
  };
```

Then find the rail call site (currently line 82):

```ts
    gestures(rail, rotate);
```

Replace with:

```ts
    gestures(rail, rotate, {
      step: () => {
        const first = rail.firstElementChild as HTMLElement | null;
        if (!first) return 0;
        const style = getComputedStyle(rail);
        const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
        return first.getBoundingClientRect().width + gap;
      },
      overflow,
    });
```

Leave the lightbox call site exactly as-is:

```ts
  gestures(image, direction => show(index + direction));
```

- [ ] **Step 4: Run `npm run check` to catch type errors**

```bash
npm run check
```

Expected: no new diagnostics from `src/scripts/photo-gallery.ts`.

- [ ] **Step 5: Rerun the QA script and confirm it PASSES**

The dev server on port 4399 serves live TS, so no rebuild step is needed — just rerun:

```bash
node scripts/qa/about-clinic.mjs http://127.0.0.1:4399
```

Expected: all `PASS ...` lines print for widths `1440, 1024, 800, 375`, including the new live-follow/spring-back assertions, no `AssertionError`.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/photo-gallery.ts scripts/qa/about-clinic.mjs
git commit -m "fix: rails follow the pointer live during drag, keep loop and click-guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Real-touch coverage for both rails via `about-clinic-edge.mjs`

**Files:**
- Modify: `scripts/qa/about-clinic-edge.mjs`

Task 1 already implements and verifies live-drag with desktop mouse events (via `about-clinic.mjs`, across all four widths including 1440/1024 desktop). This task adds coverage with **real touch** (CDP `Input.dispatchTouchEvent`, the same mechanism the file already uses for the lightbox swipe test) on a mobile viewport, for **both** `clinic-team` and `clinic-rooms` rails, per the spec's acceptance criteria. Since the underlying behavior was already implemented and verified in Task 1, this test is expected to pass immediately — there's no meaningful "red" step here (it exercises the same code path through a different input mechanism/viewport, not new behavior).

- [ ] **Step 1: Add the real-touch rail-drag block**

Open `scripts/qa/about-clinic-edge.mjs`. Insert this new block right after the closing `}` of the `for (const size of [1,2]) { ... }` loop (i.e. after line 38, before the `const page=await context.newPage();...axe...` block that currently starts at line 39):

```js
  {
    const page=await context.newPage();
    await page.goto(base,{waitUntil:'networkidle'});
    const session=await context.newCDPSession(page);
    for (const id of ['clinic-team','clinic-rooms']) {
      const gallery=page.locator(`[data-gallery="${id}"]`);
      if (!(await gallery.locator('.gallery-nav').isVisible())) continue; // not overflowing at this viewport, nothing to drag
      const rail=gallery.locator('[data-rail]');
      const box=await gallery.locator('[data-photo]').first().boundingBox();
      const beforeId=await gallery.locator('[data-photo]').first().getAttribute('data-id');
      const y=box.y+box.height*.5, startX=box.x+box.width*.8;
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX-box.width*.4,y}]});
      assert.notEqual(await rail.evaluate(el=>getComputedStyle(el).transform),'none'); // live-follow mid-touch
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX-box.width*.8,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.notEqual(await gallery.locator('[data-photo]').first().getAttribute('data-id'),beforeId); // committed rotate, loops
      assert.equal(await rail.evaluate(el=>getComputedStyle(el).transform),'none'); // settled
    }
    await page.close();
    console.log('PASS real-touch live drag follows finger and loops on clinic-team and clinic-rooms rails');
  }
```

- [ ] **Step 2: Run and confirm it PASSES**

```bash
node scripts/qa/about-clinic-edge.mjs http://127.0.0.1:4399
```

Expected: existing `PASS ... touch/wrap, focus trap` lines for both photo counts, the new `PASS real-touch live drag follows finger and loops on clinic-team and clinic-rooms rails` line, and `PASS axe accessibility: about section and lightbox` — no `AssertionError`.

- [ ] **Step 3: Commit**

```bash
git add scripts/qa/about-clinic-edge.mjs
git commit -m "test: cover real-touch live drag on both home gallery rails

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Final sanity pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full existing test/QA suite once more end-to-end**

```bash
npm test
npm run check
node scripts/qa/about-clinic.mjs http://127.0.0.1:4399
node scripts/qa/about-clinic-edge.mjs http://127.0.0.1:4399
node scripts/qa/a11y.mjs http://127.0.0.1:4399 /
```

Expected: all green, `a11y.mjs` reports 0 serious/critical violations on `/` (exits 0).

- [ ] **Step 2: Check whether the regenerated QA screenshots changed**

`scripts/qa/about-clinic.mjs` writes `docs/qa/about-clinic/about-{width}.png` (and lightbox/specialist screenshots) as a side effect of the run above.

```bash
git status --porcelain docs/qa/about-clinic/
```

If it prints changed files, view a couple with the Read tool to confirm they still look correct (settled carousel state, no visual regression), then:

```bash
git add docs/qa/about-clinic/
git commit -m "docs: refresh about-clinic QA screenshots after live-drag change

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If `git status --porcelain` prints nothing, skip the commit — the screenshots are pixel-identical (expected, since the carousel settles into the same visual state either way).

- [ ] **Step 3: Stop the isolated dev server**

```bash
kill "$(cat /tmp/gallery-qa-dev.pid)"
```
