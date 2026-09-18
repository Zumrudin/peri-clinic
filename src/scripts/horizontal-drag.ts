import { createVelocityTracker } from '../lib/motion';

const DRAG_SLOP = 10;

interface DragHandlers {
  /** Called on pointerdown. Return true when the pointer grabbed something already in motion:
   *  that counts as a drag from the first pixel (and must not turn into a click). */
  grab: (event: PointerEvent) => boolean;
  /** dx from the point where the drag was recognised, so nothing jumps by the slop distance. */
  move: (dx: number) => void;
  /** Release velocity in px/s from the last ~100 ms of movement (0 on pointercancel). */
  release: (velocity: number) => void;
}

/** Horizontal drag recogniser shared by the rails and the lightbox photo: 10px slop, pointer
 *  capture once committed, and the click that follows a drag is swallowed in the capture phase
 *  so a swipe over a photo never opens it. */
export function horizontalDrag(element: HTMLElement, handlers: DragHandlers, enabled = () => true): void {
  const tracker = createVelocityTracker();
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let tracking = false;
  let dragged = false;
  element.addEventListener('dragstart', (e) => e.preventDefault());
  element.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !enabled()) return;
    tracking = true;
    startX = originX = e.clientX;
    startY = e.clientY;
    dragged = handlers.grab(e);
    tracker.reset();
    tracker.add(e.clientX, e.timeStamp);
  });
  element.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragged) {
      if (Math.abs(dx) <= DRAG_SLOP || Math.abs(dx) <= Math.abs(dy)) return;
      dragged = true;
      originX = e.clientX;
    }
    if (!element.hasPointerCapture(e.pointerId)) element.setPointerCapture(e.pointerId);
    tracker.add(e.clientX, e.timeStamp);
    handlers.move(e.clientX - originX);
  });
  const end = (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    if (!dragged) return;
    handlers.release(e.type === 'pointercancel' ? 0 : tracker.velocity(e.timeStamp));
  };
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener(
    'click',
    (e) => {
      if (dragged) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragged = false;
      }
    },
    true,
  );
}

