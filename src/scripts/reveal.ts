/** One-time fade/slide-in for `.reveal` elements when they enter the viewport. */
export function initReveal(): void {
  const items = document.querySelectorAll<HTMLElement>('.reveal');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      // Elements entering in the same tick (first paint, a whole grid row) stagger by
      // --stagger (max 5 steps); anything scrolled into view later arrives alone, delay 0.
      let i = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.style.setProperty('--reveal-i', String(Math.min(i++, 4)));
        el.classList.add('is-visible');
        obs.unobserve(el);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -45px' },
  );
  items.forEach((el) => {
    // Content starts visible; animate only short blocks below the viewport.
    // Long articles must not wait for a percentage of their height to intersect.
    const rect = el.getBoundingClientRect();
    if (rect.top >= window.innerHeight && rect.height < window.innerHeight) {
      el.classList.add('reveal--pending');
      observer.observe(el);
    } else el.classList.add('is-visible');
  });
}
