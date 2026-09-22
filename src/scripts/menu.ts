/** Mobile burger menu: toggles nav, locks body scroll, closes on link click / desktop resize. */
export function initMobileMenu(toggle: HTMLButtonElement | null, nav: HTMLElement | null): void {
  if (!toggle || !nav) return;

  const set = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  };

  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1100) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') set(false);
  });
}
