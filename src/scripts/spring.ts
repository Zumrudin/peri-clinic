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

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
