// Browser helpers from the saved concept; production sources are untouched.
import { i as project, o as snapTarget, t as animateSpring, n as reducedMotion } from './_astro/spring.Nf4_pPRs.js';
import { n as horizontalDrag } from './_astro/loop-carousel.DcS_Ht8k.js';
type SpringHandle = { cancel: () => void };
export { horizontalDrag as n };

/** Shared staff/equipment motion: real cards rotate, with no cloned links or IDs. */
export function initLoopCarousel({ rail, track, cards, previous, next, announce, enabled = () => true }: {
  rail: HTMLElement;
  track: HTMLElement;
  cards: HTMLElement[];
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  announce: () => void;
  enabled?: () => boolean;
}) {
  // track.scrollWidth is layout width in the track's own space, unaffected by its transform.
  const overflow = () => enabled() && track.scrollWidth > rail.clientWidth + 2;
  const cardStep = () => {
    const first = track.firstElementChild as HTMLElement | null;
    if (!first) return 0;
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap || '0') || 0;
    return first.getBoundingClientRect().width + gap;
  };

  // Infinite carousel with one unbounded position `u` (px, negative = content moved left).
  // `shifted` is how much of `u` the DOM has absorbed by rotating cards; the visible
  // translate is `u - shifted`, kept within (-step, 0] so cards always cover the rail and a
  // single flick can travel several cards without a blank edge. Every mutation of `u` goes
  // through setPosition(), whether it comes from the finger, a spring or a button.
  let u = 0;
  let shifted = 0;
  let target = 0;
  let velocity = 0;
  let step = 0;
  let base = 0;
  let swipeOrigin = 0;
  const singleStep = () => !!rail.closest('.portraits') && matchMedia('(max-width: 800px)').matches;
  let spring: SpringHandle | null = null;
  const rotate = (direction: 1 | -1) => {
    const focus = document.activeElement as HTMLElement | null;
    if (direction > 0) track.append(track.firstElementChild!);
    else track.prepend(track.lastElementChild!);
    rail.scrollLeft = 0;
    if (focus && rail.contains(focus)) focus.focus({ preventScroll: true });
  };
  const setPosition = (next: number) => {
    if (step <= 0) return;
    u = next;
    while (u - shifted <= -step + 0.5) {
      rotate(1);
      shifted -= step;
    }
    while (u - shifted > 0.5) {
      rotate(-1);
      shifted += step;
    }
    const applied = u - shifted;
    track.style.transform = Math.abs(applied) < 0.5 ? '' : `translateX(${applied}px)`;
  };
  const finish = () => {
    spring = null;
    setPosition(target);
    u = shifted = target = velocity = 0;
    track.style.transform = '';
    announce();
  };
  const run = (instant = false) => {
    spring?.cancel();
    if (instant || reducedMotion()) return finish();
    spring = animateSpring(
      { from: u, to: target, velocity, response: 0.4, damping: 1 },
      (value, v) => {
        velocity = v;
        setPosition(value);
      },
      finish,
    );
  };
  const settle = (releaseVelocity: number) => {
    if (singleStep()) {
      // A flick can finish the adjacent card, but never throw the list past a person.
      const distance = u - swipeOrigin;
      const intent = distance + Math.max(-step * 0.15, Math.min(step * 0.15, releaseVelocity * 0.08));
      target = swipeOrigin + (Math.abs(intent) >= step * 0.22 ? Math.sign(intent) * step : 0);
      velocity = 0;
      run();
      return;
    }
    velocity = releaseVelocity;
    target = shifted + snapTarget(u - shifted + project(releaseVelocity), step, Math.max(1, cards.length - 1));
    run();
  };
  const go = (direction: 1 | -1, instant = false) => {
    if (!overflow() || cards.length < 2) return;
    if (!spring) {
      step = cardStep();
      if (!step) return;
      target = shifted + Math.round((u - shifted) / step) * step;
      velocity = 0;
    }
    target -= direction * step;
    run(instant);
  };
  horizontalDrag(rail, {
    grab: () => {
      if (!overflow() || cards.length < 2) {
        step = 0;
        return false;
      }
      step = cardStep();
      base = u;
      swipeOrigin = shifted + Math.round((u - shifted) / step) * step;
      const moving = !!spring;
      spring?.cancel();
      spring = null;
      return moving;
    },
    move: (dx) => {
      if (step) setPosition(singleStep()
        ? Math.max(swipeOrigin - step, Math.min(swipeOrigin + step, base + dx))
        : base + dx);
    },
    release: (releaseVelocity) => {
      if (step) settle(releaseVelocity);
    },
  }, enabled);
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  rail.addEventListener('keydown', (e) => {
    if (!enabled()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1, true);
    }
  });

  const reset = () => {
    spring?.cancel();
    spring = null;
    u = shifted = target = velocity = step = 0;
    track.style.transform = '';
    rail.scrollLeft = 0;
  };
  // A breakpoint or orientation change invalidates the measured distance between cards.
  let width = rail.clientWidth;
  new ResizeObserver(() => {
    if (width === rail.clientWidth) return;
    width = rail.clientWidth;
    reset();
  }).observe(rail);
  return { reset };
}

export { initLoopCarousel as t };
