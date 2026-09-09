/** Header becomes fixed + compact after scrolling past 120px. */
export function initStickyHeader(header: HTMLElement | null): void {
  if (!header) return;
  let sticky = false;
  const sync = () => {
    const next = window.scrollY > 120;
    if (next !== sticky) {
      sticky = next;
      header.classList.toggle('is-sticky', sticky);
    }
  };
  window.addEventListener('scroll', sync, { passive: true });
  sync();
}
