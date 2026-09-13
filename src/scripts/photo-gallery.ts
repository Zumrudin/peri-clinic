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
  const gestures = (element: HTMLElement, move: (direction: number) => void) => {
    let startX = 0, startY = 0, tracking = false, dragged = false;
    element.addEventListener('dragstart', e => e.preventDefault());
    element.addEventListener('pointerdown', e => { if (e.button !== 0) return; startX = e.clientX; startY = e.clientY; tracking = true; dragged = false; });
    element.addEventListener('pointermove', e => { if (tracking && Math.abs(e.clientX - startX) > 10 && Math.abs(e.clientX - startX) > Math.abs(e.clientY - startY)) { dragged = true; if (!element.hasPointerCapture(e.pointerId)) element.setPointerCapture(e.pointerId); } });
    element.addEventListener('pointerup', e => { if (!tracking) return; tracking = false; const dx = e.clientX - startX; if (dragged && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - startY)) move(dx < 0 ? 1 : -1); });
    element.addEventListener('pointercancel', () => { tracking = false; dragged = false; });
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
    gestures(rail, rotate);
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
