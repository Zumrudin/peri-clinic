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

test('rubberband(): monotonic, sign-preserving, never exceeds the dimension', () => {
  assert.equal(rubberband(0, 300), 0);
  assert.ok(rubberband(50, 300) > 0 && rubberband(50, 300) < 50);
  assert.ok(rubberband(-50, 300) < 0);
  assert.ok(rubberband(100, 300) > rubberband(50, 300));
  assert.ok(rubberband(1e9, 300) < 300);
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
  v.add(0, 1000);
  v.add(10, 1016);
  v.add(20, 1032);
  v.add(30, 1048);
  assert.ok(Math.abs(v.velocity(1048) - 625) < 1); // 30px / 48ms
  v.add(30, 1300); // finger held still
  assert.equal(v.velocity(1300), 0);
  assert.equal(createVelocityTracker().velocity(0), 0);
});
