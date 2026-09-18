/** Header becomes fixed + compact after scrolling past 120px and stays so until the
 *  user is back within 40px of the top (hysteresis: no flicker while hovering around
 *  the threshold, and the slide-in keyframe plays once per descent, not per pixel).
 *  It leaves the way it came: `is-leaving` plays the mirrored slide-out before the
 *  classes drop, so the fixed bar never just vanishes. */
export function initStickyHeader(header: HTMLElement | null): void {
  if (!header) return;
  const ON = 120;
  const OFF = 40;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let sticky = false;
  let leaving = false;
  let fallback = 0;
  const unstick = () => {
    leaving = false;
    clearTimeout(fallback);
    header.classList.remove('is-sticky', 'is-leaving');
  };
  const onLeft = () => {
    if (leaving) unstick();
  };
  const sync = () => {
    const y = window.scrollY;
    if (!sticky) {
      if (y <= ON) return;
      sticky = true;
      if (leaving) {
        // Turned back down mid-exit: stay fixed, drop the exit animation.
        leaving = false;
        clearTimeout(fallback);
        header.classList.remove('is-leaving');
      }
      header.classList.add('is-sticky');
      return;
    }
    if (y > OFF) return;
    sticky = false;
    if (reduced.matches || leaving) {
      unstick();
      return;
    }
    leaving = true;
    header.classList.add('is-leaving');
    // The global reduced-motion rule and a missing keyframe both mean animationend never
    // comes; the timer guarantees the header is released either way.
    fallback = window.setTimeout(onLeft, 400);
  };
  header.addEventListener('animationend', onLeft);
  window.addEventListener('scroll', sync, { passive: true });
  sync();
}
