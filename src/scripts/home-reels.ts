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
    const mobileOnly = root.hasAttribute('data-mobile-only');
    const mobile = matchMedia(mobileOnly ? '(max-width: 800px)' : '(min-width: 0px)');
    // Wide screens show several whole cards, so the chosen card, not the scroll position, is active.
    const wide = matchMedia('(min-width: 801px)');
    const row = () => !mobileOnly && wide.matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let reducedSeen = reduced.matches;
    const paused = new Set<number>();
    const captionButtons = cards.map(card => card.querySelector<HTMLButtonElement>('[data-reel-caption-toggle]')!);
    let captionTimer = 0;
    let captionStarted = 0;
    let captionRemaining = 1500;
    const showCaption = (index: number, shown: boolean) => {
      cards[index].toggleAttribute('data-caption-hidden', !shown);
      captionButtons[index].setAttribute('aria-expanded', String(shown));
      captionButtons[index].setAttribute('aria-label', shown ? 'Скрыть подпись' : 'Показать подпись');
    };
    const pauseCaptionTimer = () => {
      if (!captionTimer) return;
      clearTimeout(captionTimer);
      captionTimer = 0;
      captionRemaining = Math.max(0, captionRemaining - (performance.now() - captionStarted));
    };
    const resetCaption = (index: number) => {
      pauseCaptionTimer();
      captionRemaining = 1500;
      showCaption(index, true);
    };
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
      const bounds = rail.getBoundingClientRect();
      const across = Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left);
      return mobile.matches && !document.hidden && !document.querySelector('dialog[open]') && shown >= Math.min(box.height, innerHeight) * .5 && (!row() || across >= box.width * .5);
    };
    const stop = () => {
      pauseCaptionTimer();
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
      // Chrome evaluates a media change a frame late and drops the change event of a query whose
      // .matches already returned the new value — as a scheduled update may — so notice it here too.
      if (reduced.matches !== reducedSeen) { reducedSeen = reduced.matches; stop(); }
      if (!mobile.matches) { stop(); streams?.setWindow(active, false); return; }
      if (!row()) {
        const left = rail.getBoundingClientRect().left;
        let closest = 0;
        cards.forEach((card, index) => {
          if (Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[closest].getBoundingClientRect().left - left)) closest = index;
        });
        if (closest !== active) {
          stop(); active = closest; resetCaption(active);
        }
      }
      cards.forEach((card, index) => {
        card.inert = !row() && index !== active;
        // In a row a click anywhere on a waiting card starts it; keyboards and screen readers use its play button.
        if (row() && index !== active) { captionButtons[index].tabIndex = -1; captionButtons[index].setAttribute('aria-hidden', 'true'); }
        else { captionButtons[index].removeAttribute('tabindex'); captionButtons[index].removeAttribute('aria-hidden'); }
        if (index !== active) videos[index].pause();
        if (dots[index]) {
          if (index === active) dots[index].setAttribute('aria-current', 'true');
          else dots[index].removeAttribute('aria-current');
        }
      });
      const canPrepare = (isNear || visible()) && !document.hidden && !document.querySelector('dialog[open]') && !paused.has(active);
      if (canPrepare) (row() ? videos : videos.slice(Math.max(0, active - 1), active + 3)).forEach(v => { if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster; });
      if (canPrepare && (!reduced.matches || !videos[active].paused)) {
        if (!streams) void initialize();
        streams?.setWindow(active, true, !reduced.matches);
      } else { streams?.setWindow(active, false); initialCache?.cancel(); }
      if (!visible() || paused.has(active)) { stop(); return; }
      if (!reduced.matches) play();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // A row scrolls only to uncover a clipped card, stopping at the nearest card start that shows it whole.
    const reveal = (index: number, behavior: ScrollBehavior) => {
      const bounds = rail.getBoundingClientRect();
      const end = bounds.right - parseFloat(getComputedStyle(rail).paddingRight);
      const card = cards[index].getBoundingClientRect();
      const starts = cards.map(c => c.getBoundingClientRect().left - bounds.left);
      const shift = card.left < bounds.left - 1 ? card.left - bounds.left
        : card.right > end + 1 ? starts.find(start => start >= card.right - end - 1) ?? card.left - bounds.left : 0;
      if (shift) rail.scrollTo({ left: rail.scrollLeft + shift, behavior });
    };
    const go = (index: number, keyboard = false) => {
      const target = Math.max(0, Math.min(cards.length - 1, index));
      const behavior = keyboard || reduced.matches ? 'instant' : 'smooth';
      if (row()) {
        if (target !== active) { stop(); showCaption(active, true); active = target; resetCaption(active); }
        reveal(target, behavior);
        schedule();
        return;
      }
      rail.scrollTo({ left: rail.scrollLeft + cards[target].getBoundingClientRect().left - rail.getBoundingClientRect().left, behavior });
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
      video.addEventListener('playing', () => {
        if (index !== active || captionTimer || captionRemaining <= 0 || !visible()) return;
        captionStarted = performance.now();
        captionTimer = window.setTimeout(() => {
          captionTimer = 0;
          captionRemaining = 0;
          showCaption(index, false);
        }, captionRemaining);
      }, { signal });
      ['pause', 'waiting', 'seeking'].forEach(event => video.addEventListener(event, () => {
        if (index === active) pauseCaptionTimer();
      }, { signal }));
      captionButtons[index].addEventListener('click', () => {
        if (index !== active) { if (row()) toggle.click(); return; }
        pauseCaptionTimer();
        captionRemaining = 0;
        showCaption(index, card.hasAttribute('data-caption-hidden'));
      }, { signal });
      video.addEventListener('ended', () => {
        if (index !== active) return;
        // Keep scroll/visibility updates from restarting the finished clip mid-transition.
        paused.add(index);
        pauseCaptionTimer();
        showCaption(index, true);
        if (visible() && index + 1 < cards.length) {
          paused.delete(index + 1);
          go(index + 1);
        }
      }, { signal });
      ['play', 'pause', 'volumechange'].forEach(event => video.addEventListener(event, reflect, { signal }));
      video.addEventListener('timeupdate', () => {
        const fraction = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;
        card.querySelector<HTMLElement>('[data-reel-progress]')!.style.transform = `scaleX(${fraction})`;
      }, { signal });
      video.addEventListener('error', () => { card.querySelector<HTMLElement>('[data-reel-error]')!.hidden = false; }, { signal });
      video.addEventListener('loadeddata', () => { card.querySelector<HTMLElement>('[data-reel-error]')!.hidden = true; }, { signal });
      toggle.addEventListener('click', () => {
        if (index === active && (!video.paused || pending === index)) { paused.add(index); stop(); streams?.setWindow(active, false); return; }
        if (index !== active && !row()) return;
        // Scrolling a row by hand can clip even the active card, and a mostly hidden card never plays.
        if (row()) go(index);
        paused.delete(index); if (video.ended) { video.currentTime = 0; resetCaption(index); } play();
      }, { signal });
      mute.addEventListener('click', () => {
        sound = !sound; videos.forEach(v => { v.muted = !sound; });
        // In a row the sound button of a waiting card also starts that card instead of changing another one.
        if (index !== active && row()) toggle.click();
      }, { signal });
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
    reduced.addEventListener('change', () => { reducedSeen = reduced.matches; stop(); update(); }, { signal });
    let rowMode = row();
    const layout = () => {
      const leavingRow = rowMode && !row();
      rowMode = row();
      // A row never pads its end: there every card can be chosen without scrolling it to the left edge.
      if (rowMode) rail.style.setProperty('--reels-tail', '0px');
      else if (mobile.matches) {
        const style = getComputedStyle(rail);
        rail.style.setProperty('--reels-tail', `${Math.max(0, rail.clientWidth - cards[0].getBoundingClientRect().width - parseFloat(style.paddingRight) - parseFloat(style.gap))}px`);
        // The carousel reads the active card from the scroll position, so the chosen clip moves to the start.
        if (leavingRow) rail.scrollTo({ left: rail.scrollLeft + cards[active].getBoundingClientRect().left - rail.getBoundingClientRect().left, behavior: 'instant' });
      }
      schedule();
    };
    const near = new IntersectionObserver(entries => {
      isNear = entries.some(entry => entry.isIntersecting);
      schedule();
    }, { rootMargin: '1200px 0px' });
    near.observe(root);
    mobile.addEventListener('change', layout, { signal });
    wide.addEventListener('change', layout, { signal });
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
