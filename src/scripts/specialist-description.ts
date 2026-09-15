export function initSpecialistDescription() {
  const info = document.querySelector<HTMLElement>('.specialist-info');
  const portrait = document.querySelector<HTMLElement>('.specialist-portrait');
  const description = info?.querySelector<HTMLElement>('.specialist-description');
  const content = description?.querySelector<HTMLElement>('[data-description-content]');
  const button = info?.querySelector<HTMLButtonElement>('.specialist-more');
  if (!info || !portrait || !description || !content || !button || info.dataset.descriptionReady) return;
  info.dataset.descriptionReady = 'true';
  let expanded = false;
  let frame = 0;
  const outerHeight = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  };
  const update = () => {
    const style = getComputedStyle(info);
    const lineHeight = parseFloat(getComputedStyle(description).lineHeight);
    const otherHeight = Array.from(info.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== description && child !== button)
      .reduce((height, child) => height + outerHeight(child), 0);
    const available = portrait.getBoundingClientRect().height - otherHeight
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      - parseFloat(getComputedStyle(description).marginBottom);
    // Reserve the toggle's 44px height and margins only when it is needed.
    const mobile = matchMedia('(max-width: 800px)').matches;
    const needsToggle = content.getBoundingClientRect().height > (mobile ? lineHeight * 6 : Math.max(lineHeight * 3, available)) + 1;
    const preview = mobile ? lineHeight * 6 : Math.max(lineHeight * 3, available - 44);
    description.style.setProperty('--description-preview', `${preview}px`);
    description.toggleAttribute('data-collapsed', needsToggle && !expanded);
    button.hidden = !needsToggle;
    button.setAttribute('aria-expanded', String(expanded));
    button.innerHTML = expanded ? 'Свернуть <span aria-hidden="true">↑</span>' : 'Подробнее <span aria-hidden="true">↓</span>';
  };
  button.addEventListener('click', () => {
    expanded = !expanded;
    update();
    if (!expanded) button.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  });
  [info, portrait, content].forEach(element => observer.observe(element));
  update();
  document.addEventListener('astro:before-swap', () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  }, { once: true });
}
