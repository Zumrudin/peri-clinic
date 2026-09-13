/** Two independent galleries; rotation reuses real cards, never duplicate links/IDs. */
export function initPhotoGalleries() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
  if (!dialog || dialog.dataset.ready) return;
  dialog.dataset.ready = 'true';
  const image = dialog.querySelector<HTMLImageElement>('[data-lightbox-image]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]')!;
  const count = dialog.querySelector<HTMLElement>('[data-lightbox-count]')!;
  const error = dialog.querySelector<HTMLElement>('[data-lightbox-error]')!;
  const prev = dialog.querySelector<HTMLButtonElement>('[data-lightbox-prev]')!;
  const next = dialog.querySelector<HTMLButtonElement>('[data-lightbox-next]')!;
  let active: HTMLAnchorElement[] = [];
  let index = 0;
  let restore: (() => void) | undefined;
  let oldOverflow = '';
  const show = (target: number) => {
    index = (target + active.length) % active.length;
    const photo = active[index];
    error.hidden = true;
    image.src = photo.href;
    image.alt = photo.querySelector('img')?.alt || photo.dataset.caption || '';
    caption.textContent = photo.dataset.caption || '';
    count.textContent = `${index + 1} / ${active.length}`;
    prev.hidden = next.hidden = active.length < 2;
    if (active.length > 1) for (const n of [-1, 1]) { const preload = new Image(); preload.src = active[(index + n + active.length) % active.length].href; }
  };
  image.addEventListener('error', () => { error.hidden = false; });
  const open = (photos: HTMLAnchorElement[], selected: HTMLAnchorElement, onClose: () => void) => {
    active = photos; restore = onClose; show(photos.indexOf(selected));
    oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus();
  };
  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).filter(button => !button.hidden && !button.disabled);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
  dialog.addEventListener('click', e => { if (e.target === dialog || (e.target as HTMLElement).classList.contains('lightbox-inner')) dialog.close(); });
  dialog.addEventListener('close', () => { document.documentElement.style.overflow = oldOverflow; restore?.(); image.removeAttribute('src'); });
  // `live` (rails only — lightbox image swipe keeps the plain snap-on-release behavior) makes the
  // element visually track the pointer during drag, then either commits into `move()` (which does the
  // real DOM-rotation infinite loop) or springs back, instead of only reacting on release.
  const gestures = (element: HTMLElement, move: (direction: number) => void, live?: { step: () => number; overflow: () => boolean }) => {
    let startX = 0, startY = 0, tracking = false, dragged = false, cardStep = 0, dragEnabled = false;
    // `pointermove`'s live-follow branch takes over mid spring-back by setting `transition = ''`
    // directly, which fires `transitioncancel`, not `transitionend` — so the listener below would
    // never self-remove through that path. Track it explicitly and clear it before re-registering
    // or when a new drag interrupts the spring, so listeners can't accumulate.
    let springCleanup: (() => void) | null = null;
    const clearSpring = () => { if (springCleanup) { element.removeEventListener('transitionend', springCleanup); springCleanup = null; } };
    const resetTransform = (animate: boolean) => {
      clearSpring();
      if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.style.transition = 'transform 200ms ease-out';
        springCleanup = () => { element.style.transition = ''; springCleanup = null; };
        element.addEventListener('transitionend', springCleanup, { once: true });
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
          clearSpring();
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
        // Order matters: rotate() reads each card's live rect right after this to compute its FLIP
        // animation, so the transform must already be cleared or the reorder would jump visibly.
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
  gestures(image, direction => show(index + direction));
  document.querySelectorAll<HTMLElement>('[data-gallery]').forEach(root => {
    root.dataset.interactive = 'true';
    const rail = root.querySelector<HTMLElement>('[data-rail]')!;
    const cards = Array.from(rail.querySelectorAll<HTMLElement>('[data-card]'));
    const photos = cards.map(card => card.querySelector<HTMLAnchorElement>('[data-photo]')!);
    const nav = root.querySelector<HTMLElement>('.gallery-nav')!;
    const status = root.querySelector<HTMLElement>('[data-gallery-status]')!;
    const overflow = () => rail.scrollWidth > rail.clientWidth + 2;
    const rotate = (direction: number) => {
      if (!overflow() || cards.length < 2) return;
      const focus = document.activeElement as HTMLElement;
      const positions = new Map(cards.map(card => [card, card.getBoundingClientRect().left]));
      if (direction > 0) rail.append(rail.firstElementChild!); else rail.prepend(rail.lastElementChild!);
      rail.scrollLeft = 0;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) cards.forEach(card => {
        card.getAnimations().forEach(animation => animation.cancel());
        const delta = positions.get(card)! - card.getBoundingClientRect().left;
        if (Math.abs(delta) < rail.clientWidth) card.animate([{ transform: `translateX(${delta}px)` }, { transform: 'translateX(0)' }], { duration: 250, easing: 'ease-out' });
      });
      if (rail.contains(focus)) focus.focus({ preventScroll: true });
      const first = rail.querySelector<HTMLAnchorElement>('[data-photo]')!;
      status.textContent = `Фотография ${photos.indexOf(first) + 1} из ${photos.length}`;
    };
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
    root.querySelector('[data-prev]')!.addEventListener('click', () => rotate(-1));
    root.querySelector('[data-next]')!.addEventListener('click', () => rotate(1));
    rail.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); rotate(e.key === 'ArrowRight' ? 1 : -1); } });
    photos.forEach(photo => photo.addEventListener('click', e => {
      e.preventDefault();
      open(photos, photo, () => {
        const selected = active[index];
        const card = selected.closest<HTMLElement>('[data-card]')!;
        if (overflow()) { while (rail.firstElementChild !== card) rail.append(rail.firstElementChild!); rail.scrollLeft = 0; }
        selected.focus({ preventScroll: true });
      });
    }));
    new ResizeObserver(() => { nav.hidden = !overflow() || cards.length < 2; }).observe(rail);
  });
  // Standalone portrait opens the same team gallery, starting with this specialist.
  document.querySelectorAll<HTMLAnchorElement>('[data-standalone-photo]').forEach(link => link.addEventListener('click', e => {
    const source = document.querySelector<HTMLScriptElement>('[data-team-photos]');
    if (!source) return;
    e.preventDefault();
    const photos = (JSON.parse(source.textContent || '[]') as {full:string;title:string;alt:string;id:string}[]).map(item => {
      const a = document.createElement('a'); a.href = item.full; a.dataset.caption = item.title; a.dataset.id = item.id;
      const img = document.createElement('img'); img.alt = item.alt; a.append(img); return a;
    });
    const selected = photos.find(p => p.dataset.id === link.dataset.id);
    if (selected) open(photos, selected, () => link.focus({ preventScroll: true }));
  }));
}
