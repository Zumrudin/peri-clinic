# Apple-design fixes for the homepage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage gestures and motion follow Apple's fluid-interface rules (1:1 tracking, velocity hand-off, momentum projection, interruptible springs, symmetric paths, size-aware typography, material accessibility) as specified in `docs/superpowers/specs/2026-09-18-apple-design-fixes-design.md`.

**Architecture:** Pure gesture physics (projection, rubber-band, analytic spring, velocity tracker, snap) live in `src/lib/motion.ts` and are unit-tested with `node --test`. A tiny rAF runner `src/scripts/spring.ts` drives springs in the DOM. The gallery rail becomes an infinite carousel with one unbounded position value that rotates DOM cards as it crosses card boundaries; the lightbox and contact sheet reuse the same physics. CSS-only fixes (press feedback, header exit, materials, rem typography) sit in the owning components per repo conventions.

**Tech Stack:** Astro 7 static build, vanilla TS scripts, CSS custom properties, Playwright + CDP touch for QA. No animation libraries.

**Workflow:** branch `feat/apple-design-fixes` in worktree `.worktrees/apple-design-fixes`. After each task: `npm run check && npm test`, commit. Stand rebuild: `cp /srv/peri/site/deploy/rebuild/build.sh /tmp/peri-build.sh && GIT_REF=origin/feat/apple-design-fixes bash /tmp/peri-build.sh` (copy first: `git reset --hard` rewrites the running script otherwise).

---

### Task 1: Pure gesture physics (`src/lib/motion.ts`)

**Files:**
- Create: `src/lib/motion.ts`
- Test: `src/lib/motion.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, rubberband, snapTarget, createSpring, createVelocityTracker } from './motion.ts';

test('project(): Apple exponential-decay projection, 0.998 by default', () => {
  assert.equal(project(0), 0);
  // 1000 px/s → (1 * 0.998) / 0.002 = 499 px
  assert.ok(Math.abs(project(1000) - 499) < 1e-9);
  assert.ok(project(-1000) < 0);
  assert.ok(project(1000, 0.99) < project(1000)); // snappier rate stops sooner
});

test('rubberband(): monotonic, sign-preserving, bounded by dimension*constant', () => {
  assert.equal(rubberband(0, 300), 0);
  assert.ok(rubberband(50, 300) > 0 && rubberband(50, 300) < 50);
  assert.ok(rubberband(-50, 300) < 0);
  assert.ok(rubberband(100, 300) > rubberband(50, 300));
  assert.ok(rubberband(1e9, 300) < 300 * 0.55);
});

test('snapTarget(): nearest multiple of step, clamped to ±maxSteps', () => {
  assert.equal(snapTarget(-140, 300, 3), 0);
  assert.equal(snapTarget(-160, 300, 3), -300);
  assert.equal(snapTarget(-1700, 300, 3), -900);
  assert.equal(snapTarget(1700, 300, 2), 600);
  assert.equal(snapTarget(100, 0, 3), 0);
});

test('createSpring(): critically damped reaches target without overshoot and carries velocity', () => {
  const s = createSpring({ from: 0, to: 100, response: 0.4, damping: 1 });
  assert.equal(s.at(0).value, 0);
  let prev = 0;
  for (let t = 0.016; t < 2; t += 0.016) {
    const { value } = s.at(t);
    assert.ok(value >= prev - 1e-6, `monotonic at ${t}`);
    assert.ok(value <= 100 + 1e-6, `no overshoot at ${t}`);
    prev = value;
  }
  assert.equal(s.at(2).done, true);
  assert.equal(s.at(2).value, 100);
  const fast = createSpring({ from: 0, to: 100, velocity: 2000, response: 0.4, damping: 1 });
  assert.ok(fast.at(0.05).value > s.at(0.05).value, 'initial velocity moves it further early');
  const away = createSpring({ from: 0, to: 100, velocity: -3000, response: 0.4, damping: 1 });
  assert.ok(away.at(0.03).value < 0, 'velocity pointing away is honoured, not cut');
});

test('createSpring(): under-damped overshoots then settles', () => {
  const s = createSpring({ from: 0, to: 100, response: 0.3, damping: 0.6 });
  let max = 0;
  for (let t = 0; t < 3; t += 0.01) max = Math.max(max, s.at(t).value);
  assert.ok(max > 100, 'overshoots');
  assert.equal(s.at(3).done, true);
});

test('createVelocityTracker(): px/s over the last window, zero after a pause', () => {
  const v = createVelocityTracker(100);
  v.add(0, 1000); v.add(10, 1016); v.add(20, 1032); v.add(30, 1048);
  assert.ok(Math.abs(v.velocity(1048) - 625) < 1); // 30px / 48ms
  v.add(30, 1300); // finger held still
  assert.equal(v.velocity(1300), 0);
  assert.equal(createVelocityTracker().velocity(0), 0);
});
```

- [x] **Step 2: Run to verify it fails** — `node --test src/lib/motion.test.ts` → FAIL (module not found).

- [x] **Step 3: Implement**

```ts
/**
 * Gesture physics shared by the gallery rails, the lightbox and the contact sheet.
 * Pure math, no DOM, so it runs under `node --test`.
 *
 * The numbers follow Apple's "Designing Fluid Interfaces" (WWDC 2018): projection is the
 * exponential-decay form UIScrollView ships (not the textbook v²/2a), and springs are
 * parameterised by *response* (seconds) and *damping ratio* rather than mass/stiffness so
 * the values in components read like Apple's tables (damping 1.0 = no overshoot).
 */

/** Where a flick would come to rest, in px, from a release velocity in px/s. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further past it, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Nearest multiple of `step` to a projected position, clamped to ±maxSteps steps. */
export function snapTarget(projected: number, step: number, maxSteps: number): number {
  if (step <= 0) return 0;
  const steps = Math.max(-maxSteps, Math.min(maxSteps, Math.round(projected / step)));
  return steps * step;
}

export interface SpringOptions {
  from: number;
  to: number;
  /** Initial velocity in units/s — hand the gesture's release velocity straight in. */
  velocity?: number;
  /** Seconds to approach the target; not a duration, the settle time emerges from it. */
  response?: number;
  /** 1 = critically damped (default UI), < 1 overshoots. */
  damping?: number;
}
export interface SpringState {
  value: number;
  velocity: number;
  done: boolean;
}

/** Analytic damped spring (mass 1): exact at any t, so frames never drift with rAF jitter. */
export function createSpring({ from, to, velocity = 0, response = 0.4, damping = 1 }: SpringOptions) {
  const omega = (2 * Math.PI) / Math.max(response, 0.01);
  const zeta = Math.min(Math.max(damping, 0.05), 1);
  const x0 = from - to;
  return {
    at(t: number): SpringState {
      if (t <= 0) return { value: from, velocity, done: false };
      let x: number;
      let v: number;
      if (zeta >= 1) {
        const b = velocity + omega * x0;
        const e = Math.exp(-omega * t);
        x = (x0 + b * t) * e;
        v = (b - omega * (x0 + b * t)) * e;
      } else {
        const wd = omega * Math.sqrt(1 - zeta * zeta);
        const b = (velocity + zeta * omega * x0) / wd;
        const e = Math.exp(-zeta * omega * t);
        const cos = Math.cos(wd * t);
        const sin = Math.sin(wd * t);
        x = e * (x0 * cos + b * sin);
        v = e * ((b * wd - zeta * omega * x0) * cos - (x0 * wd + zeta * omega * b) * sin);
      }
      const done = Math.abs(x) < 0.5 && Math.abs(v) < 5;
      return done ? { value: to, velocity: 0, done } : { value: to + x, velocity: v, done };
    },
  };
}

/** Release velocity from the last `windowMs` of pointer samples; 0 if the finger paused. */
export function createVelocityTracker(windowMs = 100) {
  const samples: { x: number; t: number }[] = [];
  return {
    reset() {
      samples.length = 0;
    },
    add(x: number, t: number) {
      samples.push({ x, t });
      while (samples.length > 1 && t - samples[0].t > windowMs) samples.shift();
    },
    velocity(now: number): number {
      if (samples.length < 2) return 0;
      const last = samples[samples.length - 1];
      if (now - last.t > windowMs) return 0;
      const first = samples[0];
      const dt = last.t - first.t;
      return dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;
    },
  };
}
```

- [x] **Step 4: Run tests** — `npm test` → all pass (15 + 6).
- [x] **Step 5: Commit** — `git add src/lib/motion.ts src/lib/motion.test.ts docs/superpowers && git commit -m "feat: gesture physics lib (projection, rubber-band, spring, velocity)"`

### Task 2: rAF spring runner (`src/scripts/spring.ts`)

- [x] **Step 1: Create**

```ts
import { createSpring, type SpringOptions } from '../lib/motion';

export interface SpringHandle {
  cancel(): void;
}

/** Drives a `createSpring()` on requestAnimationFrame. Cancel it on the next pointerdown and
 *  start a new one from the value/velocity of the last frame — that is what makes motion
 *  interruptible without a jump. */
export function animateSpring(
  options: SpringOptions,
  onFrame: (value: number, velocity: number) => void,
  onDone?: () => void,
): SpringHandle {
  const spring = createSpring(options);
  const start = performance.now();
  let frame = requestAnimationFrame(tick);
  function tick(now: number) {
    const state = spring.at((now - start) / 1000);
    onFrame(state.value, state.velocity);
    if (state.done) onDone?.();
    else frame = requestAnimationFrame(tick);
  }
  return { cancel: () => cancelAnimationFrame(frame) };
}
```

- [x] **Step 2:** `npm run check` passes. Commit with Task 3.

### Task 3: Gallery rails as infinite carousel + lightbox swipe/morph (`src/scripts/photo-gallery.ts`, `Lightbox.astro`)

Rewrite per spec §1–2. Key state per rail: `u` (unbounded position), `shifted` (px absorbed by DOM rotations), `target`, `spring`. `setPosition(next, cardStep)` rotates while `u - shifted <= -cardStep` (append first, `shifted -= cardStep`) or `> 0` (prepend last, `shifted += cardStep`) and writes `translateX(u - shifted)`. `settle(velocity)`: `target = shifted + snapTarget(u - shifted + project(velocity), cardStep, cards.length - 1)`; reduced-motion → jump; else `animateSpring({from: u, to: target, velocity, response: .4, damping: 1})`, on done reset `u = shifted = target = 0`, clear transform, announce. `go(direction)`: `target = (spring ? target : shifted + Math.round((u - shifted)/cardStep)*cardStep) - direction*cardStep`, spring from `u` with the last frame velocity. Pointerdown while a spring runs: cancel, mark `dragged = true` (a grab is not a tap). Lightbox image: same tracker; live `translateX`, rubber-band when only one photo; release → `project()` decides; slide out with velocity → `show(next)` → slide in from the opposite side. Open/close morph between thumbnail rect and image rect via WAAPI; `cancel` event intercepted for Escape; `.is-closing` fades the dialog while the image flies back.

- [x] **Step 1:** Implement (full code lands in the file; see commit).
- [x] **Step 2:** `Lightbox.astro`: remove `figure { transform: scale(0.97) }` rules, add `.photo-lightbox.is-closing { opacity: 0 }`, `figure img { will-change: transform }`.
- [x] **Step 3:** Update `scripts/qa/about-clinic-edge.mjs`: the "settled" assertion polls up to 1500 ms for `transform === 'none'`.
- [x] **Step 4:** `npm run check && npm test`; commit `feat: gallery rails and lightbox follow the finger with momentum and interruptible springs`.

### Task 4: Contact sheet swipe-to-dismiss (`src/scripts/contact-sheet.ts`, `ContactSheet.astro`)

- [x] Add `initSheetDrag(sheet)` per spec §3 (mobile only, reads presentation transform on grab, rubber-band upwards, projection ≥ 40 % height or v > 600 px/s dismisses with velocity, click guard).
- [x] CSS: `@media (max-width: 800px) { .sheet__panel { touch-action: none; } }`.
- [x] Commit `feat: contact sheet can be dragged shut on mobile`.

### Task 5: Press feedback (CSS only)

- [x] `Categories.astro`: `.service-card { transition: transform var(--dur-press) var(--ease-out); } .service-card:active { transform: scale(0.985); }`
- [x] `Devices.astro`: same on `a.machine-card`. `Gallery.astro`: same on `.gallery-photo`. `home.css`: `.home-section .home-text-link:active { opacity: .7 }`.
- [x] Commit `feat: press feedback on home cards and gallery photos`.

### Task 6: Sticky header symmetric exit (`header.ts`, `Header.astro`)

- [x] `header.ts`: `is-leaving` state machine per spec §5 with `animationend` + 400 ms fallback, cancel on re-stick, immediate under reduced motion.
- [x] `Header.astro`: `.header.is-sticky.is-leaving { animation: headerOut 0.25s var(--ease-out) both; }` + `@keyframes headerOut { to { transform: translateY(-100%); } }`.
- [x] Commit `fix: sticky header leaves along the path it arrived on`.

### Task 7: Continuous results progress (`results-carousel.ts`, `Cases.astro`)

- [x] `update()`: `const max = rail.scrollWidth - rail.clientWidth; const fraction = max > 0 ? Math.min(1, Math.max(0, rail.scrollLeft / max)) : 1; progress.style.transform = \`scaleX(${1 / cards.length + (1 - 1 / cards.length) * fraction})\`;`
- [x] `Cases.astro`: drop `transition: transform var(--dur-fast)` from `.results-navigation__track span` (and the reduced-motion override).
- [x] Commit `fix: results progress bar tracks the rail 1:1`.

### Task 8: Reveal threshold (`reveal.ts`)

- [x] `{ threshold: 0, rootMargin: '0px 0px -40px' }`. Commit `fix: reveal blocks as soon as they enter, not after 12% of their height`.

### Task 9: Typography in rem + size-specific tracking

- [x] Run once (not committed):
```bash
node -e '
const fs=require("fs"),path=require("path");
const files=[];(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);const s=fs.statSync(p);if(s.isDirectory())walk(p);else if(/\.(astro|css)$/.test(f))files.push(p);}})("src");
const rem=n=>{const r=+(n/16).toFixed(4);return `${r}rem`;};
const conv=v=>v.replace(/(\d+(?:\.\d+)?)px/g,(m,n)=>rem(+n));
for(const f of files){let s=fs.readFileSync(f,"utf8");const o=s;
 s=s.replace(/(font-size\s*:\s*)([^;}]+)/g,(m,k,v)=>k+conv(v));
 s=s.replace(/(\bfont\s*:\s*)([^;}]+)/g,(m,k,v)=>k+v.replace(/(\d+(?:\.\d+)?)px(?=\/|\s)/g,(mm,n)=>rem(+n)));
 s=s.replace(/(--(?:t-[a-z0-9-]+|home-heading|home-card-title)\s*:\s*)([^;}]+)/g,(m,k,v)=>k+conv(v));
 if(s!==o){fs.writeFileSync(f,s);console.log("converted",f);}}'
```
- [x] Review `git diff` (only font sizes changed, spacing untouched). Tracking: `base.css` `h1 { letter-spacing: -0.035em } h2 { letter-spacing: -0.025em }`, `home.css` `.home-section h2 { letter-spacing: -0.02em }`, `ContactSheet.astro` `.sheet__title { letter-spacing: -0.02em }`.
- [x] Verify pixel-identity: screenshots of `/` before/after at 375/1440 compared with `sharp` raw buffers (≤ 0.1 % differing pixels allowed for font hinting).
- [x] Commit `feat: type sizes in rem so browser font-size settings apply; size-specific tracking`.

### Task 10: Materials, nav underline, scroll edges

- [x] `base.css`: `@media (prefers-reduced-transparency: reduce)` and `@media (prefers-contrast: more)` blocks for `.glass-panel`, `.glass-chip`.
- [x] `Header.astro`: underline via `transform: scaleX()`; `.header.is-sticky { border-bottom-color: transparent }`; reduced-transparency → solid ivory, no blur.
- [x] `ContactSheet.astro`: reduced-transparency → backdrop without blur. `MobileCtaBar.astro`: translucent bar + `::before` gradient edge; solid under reduced-transparency.
- [x] Commit `feat: translucency respects reduced-transparency/contrast; nav underline on transform; soft scroll edges`.

### Task 11: QA script, stand build, screenshots

- [x] Create `scripts/qa/apple-design.mjs` (Playwright, CDP touch at 375, mouse at 1440): rail live-follow + no-jump on release + multi-card flick + settle; sheet drag-dismiss and drag-restore; lightbox live swipe + morph animation present; progress fraction continuous; header `is-leaving` then unstuck; rem scaling (`html{font-size:20px}` → body 18.75px); reduced-transparency emulation → header `backdrop-filter: none`.
- [x] Build stand from branch, run `apple-design.mjs`, `about-clinic-edge.mjs`, `a11y.mjs https://peri.zumrudin.ru /` and screenshots into `docs/qa/apple-design/`; copy to `/var/www/peri-concepts/apple-design-2026-09-18/`; check links return 200.
- [x] Commit `docs: apple-design QA (script, screenshots)`.
