const root = document.querySelector<HTMLElement>('[data-gift-certificate]');
if (root) {
  const video = root.querySelector<HTMLVideoElement>('video')!;
  const button = root.querySelector<HTMLButtonElement>('.gift__play')!;
  const mobile = matchMedia('(max-width: 800px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  let visible = false;
  let manuallyPaused = false;
  let manuallyStarted = false;
  const prepare = () => {
    if (!video.poster) video.poster = video.dataset.poster!;
    if (!video.getAttribute('src')) video.src = video.dataset.src!;
  };
  const sync = () => {
    if (!mobile.matches || !visible || document.hidden) { video.pause(); return; }
    if (!video.poster) video.poster = video.dataset.poster!;
    if (manuallyPaused || (!manuallyStarted && (reduced.matches || connection?.saveData))) return;
    prepare();
    void video.play().catch(() => {}); // Autoplay may be denied by the browser; the play button remains available.
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0.15 }).observe(video);
  button.addEventListener('click', () => {
    if (video.paused) {
      manuallyPaused = false;
      manuallyStarted = true;
      prepare();
      void video.play().catch(() => {});
    } else {
      manuallyPaused = true;
      video.pause();
    }
  });
  const updateButton = () => {
    root.toggleAttribute('data-playing', !video.paused);
    button.setAttribute('aria-label', (video.paused ? button.dataset.playLabel : button.dataset.pauseLabel)!);
  };
  video.addEventListener('play', updateButton);
  video.addEventListener('pause', updateButton);
  mobile.addEventListener('change', sync);
  reduced.addEventListener('change', () => {
    if (reduced.matches) { manuallyStarted = false; video.pause(); }
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  root.setAttribute('data-ready', '');
}
