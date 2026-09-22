export function initGiftCertificate() {
  const root = document.querySelector<HTMLElement>('[data-gift-certificate]');
  if (!root || root.hasAttribute('data-ready')) return;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const video = root.querySelector<HTMLVideoElement>('video')!;
  const button = root.querySelector<HTMLButtonElement>('.gift__play')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  let visible = false;
  let manuallyPaused = false;
  let manuallyStarted = false;
  const prepare = () => {
    video.muted = true;
    video.defaultMuted = true;
    if (video.error) video.load();
    if (!video.getAttribute('src')) video.src = video.dataset.src!;
  };
  const sync = () => {
    if (!visible || document.hidden) { video.pause(); return; }
    if (manuallyPaused || (!manuallyStarted && (reduced.matches || connection?.saveData))) return;
    prepare();
    void video.play().catch(() => {}); // Autoplay may be denied by the browser; the play button remains available.
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0.15 });
  observer.observe(video);
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
  }, { signal });
  const updateButton = () => {
    root.toggleAttribute('data-playing', !video.paused);
    button.setAttribute('aria-label', (video.paused ? button.dataset.playLabel : button.dataset.pauseLabel)!);
  };
  // Keep the independent image visible until the decoder actually produces a frame.
  video.addEventListener('playing', () => root.setAttribute('data-frame', ''), { signal });
  video.addEventListener('error', () => { root.removeAttribute('data-frame'); updateButton(); }, { signal });
  video.addEventListener('emptied', () => root.removeAttribute('data-frame'), { signal });
  video.addEventListener('play', updateButton, { signal });
  video.addEventListener('pause', updateButton, { signal });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { manuallyStarted = false; video.pause(); }
    sync();
  }, { signal });
  document.addEventListener('visibilitychange', sync, { signal });
  // ClientRouter replaces this section without rerunning the module. Release the
  // old DOM and listeners before initializing the next page's video.
  document.addEventListener('astro:before-swap', () => {
    observer.disconnect();
    lifetime.abort();
    video.pause();
  }, { once: true, signal });
  root.setAttribute('data-ready', '');
}
