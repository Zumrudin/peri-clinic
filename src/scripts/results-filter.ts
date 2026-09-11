/**
 * Category filter for /result: clicking a [data-filter] button shows only the
 * [data-category] cards whose value matches (or all of them, for the "Все" button
 * whose data-filter is "all"). Plain show/hide — no routing, no animation — matching
 * the rest of the site's interactive scripts (see menu.ts, header.ts).
 */
export function initResultsFilter(root: HTMLElement | null): void {
  if (!root) return;
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-filter]');
  const cards = root.querySelectorAll<HTMLElement>('[data-category]');
  if (!buttons.length || !cards.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter ?? 'all';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      cards.forEach((card) => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });
}
