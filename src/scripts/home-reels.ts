export function initHomeReels() {
  document.querySelectorAll<HTMLElement>('[data-home-reels]').forEach(root => {
    if (root.dataset.ready) return;
    root.dataset.ready = 'true';
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const rail = root.querySelector<HTMLElement>('[data-reels-rail]')!;
    const cards = [...root.querySelectorAll<HTMLElement>('[data-reel]')];
    const videos = cards.map(card => card.querySelector<HTMLVideoElement>('video')!);
    const dots = [...root.querySelectorAll<HTMLButtonElement>('[data-reels-dot]')];
    const mobile = matchMedia('(max-width: 800px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const paused = new Set<number>();
    let active = 0;
    let sound = false;
    let frame = 0;
    let playGeneration = 0;
    let pending = -1;
    let disposed = false;
    let isNear = false;
    let streams: import('./reel-streams').ReelStreams | undefined;
    let loading: Promise<void> | undefined;
    let initialCache: import('./reel-streams').SegmentCache | undefined;
    const initialize = () => {
      if (!loading) {
        const library = import('hls.js/light');
        void library.catch(() => {});
        loading = import('./reel-streams').then(async ({ ReelStreams, SegmentCache, warmReelStart }) => {
          if (disposed) return;
          initialCache = new SegmentCache();
          // Fetch startup bytes while the library loads, rather than in a second network waterfall.
          videos.slice(active, active + (reduced.matches ? 1 : 3)).forEach((video, offset) => {
            void warmReelStart(initialCache!, video, 2, offset === 0 ? 'high' : 'low').catch(() => {});
          });
          const { default: Hls } = await library;
          if (disposed) return;
          streams = new ReelStreams(videos, Hls, initialCache);
          schedule();
        }).catch(() => {
          initialCache?.clear(); loading = undefined;
          cards[active].querySelector<HTMLElement>('[data-reel-error]')!.hidden = false;
        });
      }
      return loading;
    };
    const visible = () => {
      const box = cards[active].getBoundingClientRect();
      const shown = Math.min(box.bottom, innerHeight) - Math.max(box.top, 0);
      return mobile.matches && !document.hidden && !document.querySelector('dialog[open]') && shown >= Math.min(box.height, innerHeight) * .5;
    };
    const stop = () => {
      playGeneration++;
      pending = -1;
      videos.forEach(video => video.pause());
    };
    const play = () => {
      const index = active;
      const video = videos[index];
      if (pending === index || !video.paused) return;
      if (!streams) { void initialize().then(() => { if (streams && !disposed && index === active && visible() && !paused.has(index)) play(); }); return; }
      streams.setWindow(active, true, !reduced.matches);
      video.muted = !sound;
      pending = index;
      const generation = ++playGeneration;
      void video.play().then(() => {
        // A late play() resolution must not revive a card after a swipe or tab change.
        if (disposed || index !== active || !visible() || paused.has(index)) video.pause();
      }).catch(() => {
        // Blocked autoplay leaves a real play button, including in low-power mode.
      }).finally(() => { if (generation === playGeneration) pending = -1; });
    };
    const update = () => {
      frame = 0;
      if (!mobile.matches) { stop(); streams?.setWindow(active, false); return; }
      const left = rail.getBoundingClientRect().left;
      let closest = 0;
      cards.forEach((card, index) => {
        if (Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[closest].getBoundingClientRect().left - left)) closest = index;
      });
      if (closest !== active) {
        stop(); active = closest;
      }
      cards.forEach((card, index) => {
        card.inert = index !== active;
        if (index !== active) videos[index].pause();
        if (dots[index]) {
          if (index === active) dots[index].setAttribute('aria-current', 'true');
          else dots[index].removeAttribute('aria-current');
        }
      });
      const canPrepare = (isNear || visible()) && !document.hidden && !document.querySelector('dialog[open]') && !paused.has(active);
      if (canPrepare) videos.slice(Math.max(0, active - 1), active + 3).forEach(v => { if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster; });
      if (canPrepare && (!reduced.matches || !videos[active].paused)) {
        if (!streams) void initialize();
        streams?.setWindow(active, true, !reduced.matches);
      } else { streams?.setWindow(active, false); initialCache?.cancel(); }
      if (!visible() || paused.has(active)) { stop(); return; }
      if (!reduced.matches) play();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const go = (index: number, keyboard = false) => {
      const target = Math.max(0, Math.min(cards.length - 1, index));
      rail.scrollTo({ left: rail.scrollLeft + cards[target].getBoundingClientRect().left - rail.getBoundingClientRect().left, behavior: keyboard || reduced.matches ? 'instant' : 'smooth' });
    };
    videos.forEach((video, index) => {
      const card = cards[index];
      const toggle = card.querySelector<HTMLButtonElement>('[data-reel-toggle]')!;
      const mute = card.querySelector<HTMLButtonElement>('[data-reel-mute]')!;
      card.querySelector<HTMLElement>('[data-reel-controls]')!.hidden = false;
      const reflect = () => {
        card.toggleAttribute('data-playing', !video.paused);
        card.toggleAttribute('data-sound', !video.muted);
        toggle.setAttribute('aria-label', video.paused ? 'Воспроизвести видео' : 'Приостановить видео');
        mute.setAttribute('aria-label', video.muted ? 'Включить звук' : 'Выключить звук');
        mute.setAttribute('aria-pressed', String(!video.muted));
      };
      video.addEventListener('reel-source-ready', () => {
        if (index === active && visible() && !paused.has(index)) { pending = -1; play(); }
      }, { signal });
      ['play', 'pause', 'volumechange'].forEach(event => video.addEventListener(event, reflect, { signal }));
      video.addEventListener('timeupdate', () => {
        const fraction = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;
        card.querySelector<HTMLElement>('[data-reel-progress]')!.style.transform = `scaleX(${fraction})`;
      }, { signal });
      video.addEventListener('error', () => { card.querySelector<HTMLElement>('[data-reel-error]')!.hidden = false; }, { signal });
      video.addEventListener('loadeddata', () => { card.querySelector<HTMLElement>('[data-reel-error]')!.hidden = true; }, { signal });
      toggle.addEventListener('click', () => {
        if (index !== active) return;
        if (!video.paused || pending === index) { paused.add(index); stop(); streams?.setWindow(active, false); }
        else { paused.delete(index); play(); }
      }, { signal });
      mute.addEventListener('click', () => { sound = !sound; videos.forEach(v => { v.muted = !sound; }); }, { signal });
      reflect();
    });
    dots.forEach((dot, index) => dot.addEventListener('click', event => go(index, event.detail === 0), { signal }));
    rail.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      rail.focus({ preventScroll: true });
      go(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : active + (event.key === 'ArrowRight' ? 1 : -1), true);
    }, { signal });
    rail.addEventListener('scroll', schedule, { passive: true, signal });
    window.addEventListener('scroll', schedule, { passive: true, signal });
    document.addEventListener('visibilitychange', update, { signal });
    window.addEventListener('pagehide', () => { stop(); streams?.setWindow(active, false); }, { signal });
    window.addEventListener('pageshow', schedule, { signal });
    reduced.addEventListener('change', () => { stop(); update(); }, { signal });
    const layout = () => {
      if (mobile.matches) {

        const style = getComputedStyle(rail);
        rail.style.setProperty('--reels-tail', `${Math.max(0, rail.clientWidth - cards[0].getBoundingClientRect().width - parseFloat(style.paddingRight) - parseFloat(style.gap))}px`);
      }
      schedule();
    };
    const near = new IntersectionObserver(entries => {
      isNear = entries.some(entry => entry.isIntersecting);
      schedule();
    }, { rootMargin: '1200px 0px' });
    near.observe(root);
    mobile.addEventListener('change', layout, { signal });
    const resize = new ResizeObserver(layout);
    resize.observe(rail);
    // Contact sheets and photo dialogs should silence the page behind them.
    const dialogs = new MutationObserver(update);
    document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
    const nav = root.querySelector<HTMLElement>('[data-reels-navigation]');
    if (nav) nav.hidden = false;
    layout();
    document.addEventListener('astro:before-swap', () => {
      disposed = true;
      stop(); streams?.destroy(); initialCache?.clear(); lifetime.abort(); near.disconnect(); resize.disconnect(); dialogs.disconnect(); cancelAnimationFrame(frame);
    }, { once: true });
  });
}
