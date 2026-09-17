/**
 * Category filter for /result: clicking a [data-filter] button shows only the
 * [data-category] cards whose value matches (or all of them, for the "Все" button
 * whose data-filter is "all"). The DOM change is plain show/hide; the motion comes from
 * wrapping it in document.startViewTransition() — cards carry view-transition-name
 * (see result.astro), so the browser morphs the grid reflow for us. Browsers without
 * the API, and reduced-motion users, get the instant toggle.
 */
export function initResultsFilter(root: HTMLElement | null): void {
  if (!root) return;
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-filter]');
  const cards = root.querySelectorAll<HTMLElement>('[data-category]');
  if (!buttons.length || !cards.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter ?? 'all';
      const apply = () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        cards.forEach((card) => {
          const match = filter === 'all' || card.dataset.category === filter;
          card.classList.toggle('is-hidden', !match);
          // A card that was display:none never intersected, so reveal.ts still has it at
          // opacity 0; make it visible now or the transition would morph into nothing.
          if (match) card.classList.add('is-visible');
        });
      };
      if (doc.startViewTransition && !reduced.matches) doc.startViewTransition(apply);
      else apply();
    });
  });
}
