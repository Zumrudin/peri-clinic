/** Native scroll rails: shared controls, keyboard navigation and boundary states. */
export function initRails(): void {
  document.querySelectorAll<HTMLElement>('[data-rail-root]').forEach((root) => {
    const rail = root.querySelector<HTMLElement>('[data-rail]');
    if (!rail || root.dataset.railReady) return;
    root.dataset.railReady = 'true';
    const previous = root.querySelector<HTMLButtonElement>('[data-rail-prev]');
    const next = root.querySelector<HTMLButtonElement>('[data-rail-next]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 800px)');
    const usesMobileCarousel = () => root.hasAttribute('data-equipment-carousel') && mobile.matches;
    const update = () => {
      if (usesMobileCarousel()) {
        if (previous) previous.disabled = false;
        if (next) next.disabled = false;
        rail.tabIndex = 0;
        return;
      }
      const end = rail.scrollWidth - rail.clientWidth;
      if (previous) previous.disabled = rail.scrollLeft <= 2;
      if (next) next.disabled = rail.scrollLeft >= end - 2;
      if (end <= 2 || (root.hasAttribute('data-mobile-grid') && mobile.matches)) rail.removeAttribute('tabindex');
      else rail.tabIndex = 0;
    };
    const step = (dir: 1 | -1, keyboard = false) => {
      if (usesMobileCarousel()) return;
      const track = rail.querySelector<HTMLElement>('[data-track]') ?? rail;
      const card = track.firstElementChild as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      const amount = card ? card.getBoundingClientRect().width + gap : rail.clientWidth;
      rail.scrollBy({ left: dir * amount, behavior: keyboard || reduced.matches ? 'instant' : 'smooth' });
    };
    previous?.addEventListener('click', () => step(-1));
    next?.addEventListener('click', () => step(1));
    rail.addEventListener('keydown', event => {
      if (event.target !== rail) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1, true);
      }
    });
    rail.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(rail);
    mobile.addEventListener('change', update);
    update();
  });
}
