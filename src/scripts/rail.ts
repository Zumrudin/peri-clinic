/**
 * Horizontal scroll-snap rail with prev/next buttons.
 * Markup: <div data-rail-root> <button data-rail-prev> <button data-rail-next> <div data-rail> <card/>… </div> </div>
 */
export function initRails(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLElement>('[data-rail-root]').forEach((root) => {
    const rail = root.querySelector<HTMLElement>('[data-rail]');
    if (!rail) return;
    const step = (dir: 1 | -1) => {
      const card = rail.firstElementChild as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(rail).columnGap || getComputedStyle(rail).gap || '0') || 0;
      const amount = card ? card.getBoundingClientRect().width + gap : 360;
      rail.scrollBy({ left: dir * amount, behavior: reduced ? 'auto' : 'smooth' });
    };
    root.querySelector('[data-rail-prev]')?.addEventListener('click', () => step(-1));
    root.querySelector('[data-rail-next]')?.addEventListener('click', () => step(1));
  });
}
