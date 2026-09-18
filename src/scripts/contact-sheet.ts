/**
 * Contact sheet (<dialog id="contact-sheet">): opened by any [data-open-sheet] element.
 * data-context="Volnewmer" on the trigger is appended to the WhatsApp prefilled text.
 */
import { project, rubberband, createVelocityTracker } from '../lib/motion';
import { animateSpring, reducedMotion, type SpringHandle } from './spring';

export function initContactSheet(): void {
  const sheet = document.getElementById('contact-sheet') as HTMLDialogElement | null;
  if (!sheet || typeof sheet.showModal !== 'function') return;

  const wa = sheet.querySelector<HTMLAnchorElement>('[data-whatsapp]');
  const baseText = wa?.dataset.text ?? '';
  const waBase = wa?.dataset.base ?? '';

  const setContext = (context: string | undefined) => {
    if (!wa) return;
    const text = context ? `${baseText}: ${context}` : baseText;
    wa.href = text ? `${waBase}?text=${encodeURIComponent(text)}` : waBase;
  };

  const open = (context?: string) => {
    setContext(context);
    sheet.showModal();
    document.body.classList.add('sheet-open');
  };
  const close = () => sheet.close();

  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-open-sheet]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger.dataset.context);
  });

  sheet.addEventListener('click', (e) => {
    // Backdrop click: the dialog itself is the target only outside its inner panel.
    if (e.target === sheet) close();
  });
  sheet.querySelector('[data-close-sheet]')?.addEventListener('click', close);
  sheet.addEventListener('close', () => document.body.classList.remove('sheet-open'));

  const panel = sheet.querySelector<HTMLElement>('.sheet__panel');
  if (panel) initSheetDrag(sheet, panel);

  // Analytics hook: any [data-goal] element site-wide (sheet rows, MobileCtaBar's call
  // button, etc.) fires a peri:contact event that Metrika.astro turns into a reachGoal.
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-goal]');
    if (el) document.dispatchEvent(new CustomEvent('peri:contact', { detail: { goal: el.dataset.goal } }));
  });
}

/** On phones the sheet docks to the bottom and shows a grab handle, so it must actually be
 *  draggable: the panel follows the finger 1:1 downwards (rubber-bands upwards), the projected
 *  landing point decides between dismiss and snap-back, and the spring inherits the finger's
 *  velocity. Grabbing mid-entry works because the start value is read from the live transform. */
function initSheetDrag(sheet: HTMLDialogElement, panel: HTMLElement): void {
  const mobile = window.matchMedia('(max-width: 800px)');
  const tracker = createVelocityTracker();
  let tracking = false;
  let dragged = false;
  let startX = 0;
  let startY = 0;
  let base = 0;
  let y = 0;
  let spring: SpringHandle | null = null;

  const setY = (value: number) => {
    y = value;
    panel.style.transform = `translateY(${value}px)`;
  };
  // Inline styles only exist while a drag or its spring is alive: cleared afterwards so the
  // CSS enter/exit transitions keep owning the panel.
  const clearInline = () => {
    panel.style.transform = '';
    panel.style.transition = '';
    y = 0;
  };
  const settle = (to: number, velocity: number, onDone: () => void) => {
    spring?.cancel();
    if (reducedMotion()) {
      spring = null;
      onDone();
      return;
    }
    spring = animateSpring({ from: y, to, velocity, response: 0.35, damping: 1 }, setY, () => {
      spring = null;
      onDone();
    });
  };
  const dismiss = (velocity: number) => {
    // The CSS closed state is translateY(100%) — the same place the spring lands — so clearing the
    // inline transform right before close() causes no visible jump.
    settle(panel.offsetHeight, velocity, () => {
      clearInline();
      sheet.close();
    });
  };
  const snapBack = (velocity: number) => settle(0, velocity, clearInline);

  panel.addEventListener('pointerdown', (e) => {
    if (!mobile.matches || e.button !== 0) return;
    tracking = true;
    dragged = false;
    startX = e.clientX;
    startY = e.clientY;
    spring?.cancel();
    spring = null;
    const current = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
    base = current;
    if (current) {
      // Grabbed while still arriving or leaving: freeze it under the finger.
      dragged = true;
      panel.style.transition = 'none';
      setY(current);
    }
    tracker.reset();
    tracker.add(e.clientY, e.timeStamp);
  });
  panel.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragged) {
      if (Math.abs(dy) <= 10 || Math.abs(dy) <= Math.abs(dx)) return;
      dragged = true;
      base = y - dy; // recognised after the slop: continue from where the panel is, no jump
      panel.style.transition = 'none';
    }
    if (!panel.hasPointerCapture(e.pointerId)) panel.setPointerCapture(e.pointerId);
    tracker.add(e.clientY, e.timeStamp);
    const raw = base + dy;
    setY(raw >= 0 ? raw : rubberband(raw, panel.offsetHeight));
  });
  const end = (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    if (!dragged) return;
    const velocity = e.type === 'pointercancel' ? 0 : tracker.velocity(e.timeStamp);
    const projected = y + project(velocity);
    if (projected > panel.offsetHeight * 0.4 || velocity > 600) dismiss(velocity);
    else snapBack(velocity);
  };
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
  // A drag that ends over a row must not follow its link.
  panel.addEventListener(
    'click',
    (e) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dragged = false;
    },
    true,
  );
  sheet.addEventListener('close', () => {
    spring?.cancel();
    spring = null;
    tracking = false;
    dragged = false;
    clearInline();
  });
}
