import { initLoopCarousel } from './loop-carousel';

export function initEquipmentCarousels() {
  document.querySelectorAll<HTMLElement>('[data-equipment-carousel]').forEach(root => {
    if (root.dataset.equipmentReady) return;
    root.dataset.equipmentReady = 'true';
    // Staff captions vary with CMS text, loaded fonts and viewport width. Follow the
    // actual card height instead of fixing a number that only fits one phone size.
    const staffCard = document.querySelector<HTMLElement>('#approach-team [data-card]');
    if (staffCard) {
      new ResizeObserver(([entry]) => {
        root.style.setProperty('--equipment-card-height', `${entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height}px`);
      }).observe(staffCard);
    }
    const mobile = window.matchMedia('(max-width: 800px)');
    const rail = root.querySelector<HTMLElement>('[data-rail]')!;
    const track = root.querySelector<HTMLElement>('[data-track]')!;
    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-card]'));
    const previous = root.querySelector<HTMLButtonElement>('[data-rail-prev]')!;
    const next = root.querySelector<HTMLButtonElement>('[data-rail-next]')!;
    const status = root.querySelector<HTMLElement>('[data-equipment-status]')!;
    const carousel = initLoopCarousel({
      rail, track, cards, previous, next,
      enabled: () => mobile.matches,
      announce: () => { status.textContent = track.firstElementChild?.querySelector('h3')?.textContent || ''; },
    });
    const update = () => {
      carousel.reset();
      root.toggleAttribute('data-interactive', mobile.matches);
      // Restore editorial order when returning to the native desktop rail.
      if (!mobile.matches) cards.forEach(card => track.append(card));
    };
    mobile.addEventListener('change', update);
    update();
  });
}
