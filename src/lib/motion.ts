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
  return steps * step || 0; // `|| 0` folds Math.round's -0 into +0

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
