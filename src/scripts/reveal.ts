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
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -45px' },
  );
  items.forEach((el) => observer.observe(el));
}
