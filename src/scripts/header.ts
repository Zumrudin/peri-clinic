/** Header becomes fixed + compact after scrolling past 120px and stays so until the
 *  user is back within 40px of the top (hysteresis: no flicker while hovering around
 *  the threshold, and the slide-in keyframe plays once per descent, not per pixel). */
export function initStickyHeader(header: HTMLElement | null): void {
  if (!header) return;
  const ON = 120;
  const OFF = 40;
  let sticky = false;
  const sync = () => {
    const y = window.scrollY;
    const next = sticky ? y > OFF : y > ON;
    if (next !== sticky) {
      sticky = next;
      header.classList.toggle('is-sticky', sticky);
    }
  };
  window.addEventListener('scroll', sync, { passive: true });
  sync();
}
