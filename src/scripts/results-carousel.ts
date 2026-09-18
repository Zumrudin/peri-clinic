/** Native scrolling with optional desktop navigation on the home results section. */
export function initResultsCarousel(): void {
  document.querySelectorAll<HTMLElement>('[data-results-carousel]').forEach(root => {
    const rail = root.querySelector<HTMLElement>('[data-results-rail]');
    const navigation = root.querySelector<HTMLElement>('[data-results-navigation]');
    if (!rail || !navigation || root.dataset.resultsReady) return;
    root.dataset.resultsReady = 'true';
    const allCards = Array.from(rail.querySelectorAll<HTMLElement>('.result-card, .case-card'));
    const limit = Number(root.dataset.resultsLimit ?? 10);
    const desktop = root.hasAttribute('data-results-desktop');
    let cards = allCards.slice(0, limit);
    if (!cards.length) return;
    const previous = navigation.querySelector<HTMLButtonElement>('[data-results-prev]')!;
    const next = navigation.querySelector<HTMLButtonElement>('[data-results-next]')!;
    const current = navigation.querySelector<HTMLElement>('[data-results-current]')!;
    const progress = navigation.querySelector<HTMLElement>('[data-results-progress]')!;
    const mobile = window.matchMedia('(max-width: 800px)');
    const enabled = () => mobile.matches || desktop;
    const total = navigation.querySelector<HTMLElement>('[data-results-total]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let frame = 0;

    const offset = (card: HTMLElement) => card.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    const update = () => {
      frame = 0;
      if (!enabled()) return;
      index = cards.reduce((nearest, card, i) =>
        Math.abs(offset(card) - rail.scrollLeft) < Math.abs(offset(cards[nearest]) - rail.scrollLeft) ? i : nearest, 0);
      current.textContent = String(index + 1).padStart(2, '0');
      // The bar tracks the rail 1:1 (from 1/n at the start to full at the end) instead of
      // stepping per card, so it moves with the finger while the counter snaps by card.
      const max = rail.scrollWidth - rail.clientWidth;
      const fraction = max > 0 ? Math.min(1, Math.max(0, rail.scrollLeft / max)) : 1;
      progress.style.transform = `scaleX(${1 / cards.length + (1 - 1 / cards.length) * fraction})`;
      previous.disabled = index === 0;
      next.disabled = index === cards.length - 1;
    };
    const go = (target: number) => {
      if (!enabled()) return;
      rail.scrollTo({ left: offset(cards[Math.max(0, Math.min(target, cards.length - 1))]), behavior: reduced.matches ? 'instant' : 'smooth' });
    };
    const sync = () => {
      cards = desktop && !mobile.matches ? allCards : allCards.slice(0, limit);
      if (total) total.textContent = String(cards.length).padStart(2, '0');
      navigation.hidden = !enabled();
      if (enabled()) rail.tabIndex = 0;
      else rail.removeAttribute('tabindex');
      update();
    };
    previous.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    rail.addEventListener('keydown', event => {
      if (!enabled() || event.target !== rail || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
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
