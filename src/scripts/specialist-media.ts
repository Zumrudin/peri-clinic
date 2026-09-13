export function initSpecialistMedia() {
  document.querySelectorAll<HTMLElement>('[data-specialist-media]').forEach(root => {
    if (root.dataset.ready) return;
    root.dataset.ready = 'true';
    const rail = root.querySelector<HTMLElement>('[data-media-rail]')!;
    const cards = Array.from(rail.children) as HTMLElement[];
    const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-media-dot]'));
    const pagination = root.querySelector<HTMLElement>('[data-media-pagination]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      if (pagination) pagination.hidden = rail.scrollWidth <= rail.clientWidth + 2;
      const left = rail.getBoundingClientRect().left;
      const nearest = cards.reduce((best, card, i) => Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[best].getBoundingClientRect().left - left) ? i : best, 0);
      dots.forEach((dot, i) => i === nearest ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current'));
    };
    const go = (i: number) => rail.scrollTo({ left: rail.scrollLeft + cards[i].getBoundingClientRect().left - rail.getBoundingClientRect().left - 2, behavior: reduced.matches ? 'instant' : 'smooth' });
    dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));
    rail.addEventListener('scroll', update, { passive:true });
    rail.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key) || rail.scrollWidth <= rail.clientWidth + 2) return;
      e.preventDefault();
      const current = cards.findIndex(card => card.contains(document.activeElement));
      const i = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : Math.max(0,Math.min(cards.length - 1,current + (e.key === 'ArrowRight' ? 1 : -1)));
      go(i); cards[i].querySelector('a')?.focus({ preventScroll:true });
    });
    new ResizeObserver(update).observe(rail);
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
