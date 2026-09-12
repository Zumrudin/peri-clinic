/** Mobile-only navigation; native scrolling remains usable without JavaScript. */
export function initResultsCarousel(): void {
  document.querySelectorAll<HTMLElement>('[data-results-carousel]').forEach(root => {
    const rail = root.querySelector<HTMLElement>('[data-results-rail]');
    const navigation = root.querySelector<HTMLElement>('[data-results-navigation]');
    if (!rail || !navigation || root.dataset.resultsReady) return;
    root.dataset.resultsReady = 'true';
    const cards = Array.from(rail.querySelectorAll<HTMLElement>('.result-card')).slice(0, 10);
    const previous = navigation.querySelector<HTMLButtonElement>('[data-results-prev]')!;
    const next = navigation.querySelector<HTMLButtonElement>('[data-results-next]')!;
    const current = navigation.querySelector<HTMLElement>('[data-results-current]')!;
    const progress = navigation.querySelector<HTMLElement>('[data-results-progress]')!;
    const mobile = window.matchMedia('(max-width: 800px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let frame = 0;

    const offset = (card: HTMLElement) => card.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    const update = () => {
      frame = 0;
      if (!mobile.matches) return;
      index = cards.reduce((nearest, card, i) =>
        Math.abs(offset(card) - rail.scrollLeft) < Math.abs(offset(cards[nearest]) - rail.scrollLeft) ? i : nearest, 0);
      current.textContent = String(index + 1).padStart(2, '0');
      progress.style.transform = `scaleX(${(index + 1) / cards.length})`;
      previous.disabled = index === 0;
      next.disabled = index === cards.length - 1;
    };
    const go = (target: number) => {
      if (!mobile.matches) return;
      rail.scrollTo({ left: offset(cards[Math.max(0, Math.min(target, cards.length - 1))]), behavior: reduced.matches ? 'instant' : 'smooth' });
    };
    const sync = () => {
      navigation.hidden = !mobile.matches;
      if (mobile.matches) rail.tabIndex = 0;
      else rail.removeAttribute('tabindex');
      update();
    };
    previous.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    rail.addEventListener('keydown', event => {
      if (!mobile.matches || event.target !== rail || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      go(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    rail.addEventListener('scroll', () => {
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    new ResizeObserver(update).observe(rail);
    mobile.addEventListener('change', sync);
    sync();
  });
}
