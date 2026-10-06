// The existing reels controller owns selection/playback; this is its scroll-position display.
for (const root of document.querySelectorAll('[data-home-reels]')) {
  const rail = root.querySelector('[data-reels-rail]');
  const navigation = root.querySelector('[data-reels-scroll-navigation]');
  if (!rail || !navigation) continue;
  const cards = [...rail.querySelectorAll('[data-reel]')];
  const dots = [...root.querySelectorAll('[data-reels-dot]')];
  const previous = navigation.querySelector('[data-reels-scroll-prev]');
  const next = navigation.querySelector('[data-reels-scroll-next]');
  const current = navigation.querySelector('[data-reels-scroll-current]');
  const progress = navigation.querySelector('[data-reels-scroll-progress]');
  const mobile = matchMedia('(max-width:800px)');
  let index = 0;
  let frame = 0;
  const update = () => {
    frame = 0;
    navigation.hidden = !mobile.matches || cards.length < 2;
    if (navigation.hidden) return;
    const left = rail.getBoundingClientRect().left;
    index = cards.reduce((nearest, card, i) => Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[nearest].getBoundingClientRect().left - left) ? i : nearest, 0);
    const max = rail.scrollWidth - rail.clientWidth;
    const fraction = max > 0 ? Math.min(1, Math.max(0, rail.scrollLeft / max)) : 1;
    progress.style.transform = `scaleX(${1 / cards.length + (1 - 1 / cards.length) * fraction})`;
    const label = String(index + 1).padStart(2, '0');
    if (current.textContent !== label) current.textContent = label;
    previous.disabled = index === 0;
    next.disabled = index === cards.length - 1;
  };
  previous.addEventListener('click', () => dots[Math.max(0, index - 1)]?.click());
  next.addEventListener('click', () => dots[Math.min(cards.length - 1, index + 1)]?.click());
  rail.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive:true });
  new ResizeObserver(update).observe(rail);
  mobile.addEventListener('change', update);
  update();
}
