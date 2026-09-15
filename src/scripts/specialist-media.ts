export function initSpecialistMedia() {
  document.querySelectorAll<HTMLElement>('[data-specialist-media]').forEach(root => {
    if (root.dataset.ready) return;
    root.dataset.ready = 'true';
    const rail = root.querySelector<HTMLElement>('[data-media-rail]')!;
    const cards = Array.from(rail.children) as HTMLElement[];
    const controls = root.querySelector<HTMLElement>('[data-media-controls]')!;
    const previous = root.querySelector<HTMLButtonElement>('[data-media-prev]')!;
    const next = root.querySelector<HTMLButtonElement>('[data-media-next]')!;
    const pagination = root.querySelector<HTMLElement>('[data-media-pagination]')!;
    const progress = root.querySelector<HTMLElement>('[data-media-progress]')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      controls.hidden = pagination.hidden = max <= 2;
      previous.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max - 2;
      const visible = Math.min(1, rail.clientWidth / rail.scrollWidth);
      const fraction = max > 0 ? Math.max(0, Math.min(1, rail.scrollLeft / max)) : 0;
      progress.style.transform = `translateX(${fraction * (1 - visible) * 100}%) scaleX(${visible})`;
    };
    const go = (i: number, keyboard = false) => rail.scrollTo({ left: rail.scrollLeft + cards[i].getBoundingClientRect().left - rail.getBoundingClientRect().left - 2, behavior: reduced.matches || keyboard ? 'instant' : 'smooth' });
    const step = (direction: number, keyboard: boolean) => {
      const stride = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : rail.clientWidth;
      const index = direction > 0 ? Math.floor((rail.scrollLeft + 2) / stride) + 1 : Math.ceil((rail.scrollLeft - 2) / stride) - 1;
      go(Math.max(0, Math.min(cards.length - 1, index)), keyboard);
    };
    previous.addEventListener('click', e => step(-1, e.detail === 0));
    next.addEventListener('click', e => step(1, e.detail === 0));
    rail.addEventListener('scroll', update, { passive:true });
    rail.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const current = cards.findIndex(card => card.contains(document.activeElement));
      const i = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : Math.max(0,Math.min(cards.length - 1,current + (e.key === 'ArrowRight' ? 1 : -1)));
      go(i, true); cards[i].querySelector('a')?.focus({ preventScroll:true });
    });
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    document.addEventListener('astro:before-swap', () => observer.disconnect(), { once:true });
    update();

    const dialog = root.querySelector<HTMLDialogElement>('[data-media-dialog]')!;
    const photo = dialog.querySelector<HTMLImageElement>('[data-media-image]')!;
    const video = dialog.querySelector<HTMLVideoElement>('[data-media-video]')!;
    const track = dialog.querySelector<HTMLTrackElement>('[data-media-track]')!;
    const error = dialog.querySelector<HTMLElement>('[data-media-error]')!;
    let opener: HTMLAnchorElement | undefined;
    let overflow = '';
    root.querySelectorAll<HTMLAnchorElement>('[data-media-open]').forEach(link => link.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); opener = link;
      const isVideo = !!link.dataset.video;
      photo.hidden = isVideo; video.hidden = !isVideo; error.hidden = true;
      dialog.querySelector<HTMLElement>('[data-media-caption]')!.textContent = link.dataset.caption || '';
      dialog.querySelector<HTMLAnchorElement>('[data-media-fallback]')!.href = link.href;
      if (isVideo) {
        video.poster = link.dataset.poster || '';
        video.src = link.href;
        if (link.dataset.captions) { video.crossOrigin = 'anonymous'; track.src = link.dataset.captions; track.default = true; }
        video.load();
      } else { photo.src = link.href; photo.alt = link.dataset.alt || ''; }
      overflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      dialog.showModal();
      if (isVideo) void video.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
      dialog.querySelector<HTMLButtonElement>('[data-media-close]')!.focus();
    }));
    [photo,video].forEach(element => element.addEventListener('error', () => { if (dialog.open) error.hidden = false; }));
    dialog.querySelector('[data-media-close]')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const b=dialog.getBoundingClientRect(); if(e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => {
      video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.removeAttribute('crossorigin'); track.removeAttribute('src'); track.default = false; video.load(); photo.removeAttribute('src');
      document.documentElement.style.overflow = overflow;
      opener?.focus({ preventScroll:true });
    });
  });
}
