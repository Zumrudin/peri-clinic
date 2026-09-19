/**
 * Pricing page: category navigation, anchors and the mobile category switcher.
 * Runs on every astro:page-load (ClientRouter keeps the module alive across navigations),
 * so window/matchMedia listeners from the previous visit are torn down before rebinding —
 * element listeners die with the swapped DOM on their own.
 */
let teardown: (() => void) | null = null;

export function initPricing(): void {
  teardown?.();
  teardown = null;
  const pricing = document.querySelector<HTMLElement>('.pricing');
  const navigation = pricing?.querySelector<HTMLDetailsElement>('.pricing__navigation');
  if (!pricing || !navigation) return;
  const desktop = window.matchMedia('(min-width: 1001px)');
  const toggle = navigation.querySelector<HTMLElement>('.pricing__nav-toggle')!;
  const mobileNavigation = pricing.querySelector<HTMLElement>('.pricing__mobile-categories')!;
  const mobileLinks = Array.from(mobileNavigation.querySelectorAll<HTMLAnchorElement>('a'));
  const categories = Array.from(pricing.querySelectorAll<HTMLElement>('.pricing__category'));
  const links = Array.from(navigation.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));

  const activateCategory = (id: string) => {
    categories.forEach((category) => category.toggleAttribute('data-active', category.id === id));
    mobileLinks.forEach((link) => {
      if (link.hash === `#${id}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    const activeLink = mobileLinks.find((link) => link.hash === `#${id}`);
    if (activeLink && !desktop.matches) {
      // Keep the selected tab in the horizontal viewport without scrolling the page.
      const navRect = mobileNavigation.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      mobileNavigation.scrollLeft += linkRect.left - navRect.left - (navRect.width - linkRect.width) / 2;
    }
  };
  activateCategory(categories[0].id);
  pricing.setAttribute('data-mobile-navigation', '');

  const adapt = () => {
    navigation.open = desktop.matches;
    toggle.tabIndex = desktop.matches ? -1 : 0;
  };
  adapt();
  desktop.addEventListener('change', adapt);
  navigation.addEventListener('toggle', () => {
    if (desktop.matches && !navigation.open) navigation.open = true;
  });

  const revealTarget = (moveFocus = true) => {
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target?.matches('.pricing__item, .pricing__category')) {
      if (!window.location.hash) activateCategory(categories[0].id);
      return;
    }
    const category = target.closest<HTMLElement>('.pricing__category');
    if (category) activateCategory(category.id);
    if (target instanceof HTMLDetailsElement) target.open = true;
    const group = links.find((item) => item.hash === `#${target.id}`)?.closest('details');
    if (group) group.open = true;
    links.forEach((link) => {
      if (link.hash === `#${target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      // The header becomes fixed on the first scroll and changes the page layout.
      // Align again after that frame so a direct link stays below the sticky tabs.
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
      if (!moveFocus) return;
      const focusTarget = target instanceof HTMLDetailsElement ? target.querySelector('summary') : target.querySelector('h2');
      if (focusTarget instanceof HTMLElement) {
        if (focusTarget.tagName !== 'SUMMARY') focusTarget.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
      }
    });
  };
  mobileNavigation.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a');
    if (!link || event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    event.preventDefault();
    const alreadyScrolled = pricing.querySelector('.pricing__content')!.getBoundingClientRect().top < 180;
    if (window.location.hash !== link.hash) history.pushState(null, '', link.hash);
    activateCategory(link.hash.slice(1));
    // Keep the introductory screen in place; only return to the list when switching further down.
    if (alreadyScrolled) revealTarget(false);
  });
  navigation.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link || event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    // Handle the anchor here: ClientRouter may consume the native hashchange.
    event.preventDefault();
    if (link.hash !== window.location.hash) history.pushState(null, '', link.hash);
    revealTarget();
  });
  const onHashChange = () => revealTarget();
  window.addEventListener('hashchange', onHashChange);
  teardown = () => {
    window.removeEventListener('hashchange', onHashChange);
    desktop.removeEventListener('change', adapt);
  };
  if (window.location.hash) revealTarget();
}
