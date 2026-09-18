/** Two independent galleries; rotation reuses real cards, never duplicate links/IDs. */
import { project, rubberband } from '../lib/motion';
import { horizontalDrag } from './horizontal-drag';
import { initLoopCarousel } from './loop-carousel';
import { animateSpring, reducedMotion, type SpringHandle } from './spring';

// Same curve as --ease-out in tokens.css; JS animations can't read the CSS variable.
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
/** Transform that makes `img` occupy `thumb`'s box — the open/close morph keyframe. */
const fitTransform = (thumb: DOMRect, img: DOMRect) =>
  `translate(${thumb.left + thumb.width / 2 - (img.left + img.width / 2)}px, ${
    thumb.top + thumb.height / 2 - (img.top + img.height / 2)
  }px) scale(${thumb.width / img.width}, ${thumb.height / img.height})`;

export function initPhotoGalleries() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
  if (!dialog || dialog.dataset.ready) return;
  dialog.dataset.ready = 'true';
  const image = dialog.querySelector<HTMLImageElement>('[data-lightbox-image]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]')!;
  const count = dialog.querySelector<HTMLElement>('[data-lightbox-count]')!;
  const error = dialog.querySelector<HTMLElement>('[data-lightbox-error]')!;
  const prev = dialog.querySelector<HTMLButtonElement>('[data-lightbox-prev]')!;
  const next = dialog.querySelector<HTMLButtonElement>('[data-lightbox-next]')!;
  let active: HTMLAnchorElement[] = [];
  let index = 0;
  let restore: (() => void) | undefined;
  let opener: HTMLElement | undefined;
  let oldOverflow = '';
  let closing = false;
  let morphing = false;
  let sliding = false;
  let imageX = 0;
  let imageBase = 0;
  let imageSpring: SpringHandle | null = null;

  const setImageX = (x: number) => {
    imageX = x;
    image.style.transform = x ? `translateX(${x}px)` : '';
  };
  const show = (target: number) => {
    index = (target + active.length) % active.length;
    const photo = active[index];
    dialog.classList.toggle('is-portrait', photo.dataset.portrait === 'true' || !!photo.closest('.portraits'));
    error.hidden = true;
    image.src = photo.href;
    image.alt = photo.querySelector('img')?.alt || photo.dataset.caption || '';
    caption.textContent = photo.dataset.caption || '';
    count.textContent = `${index + 1} / ${active.length}`;
    prev.hidden = next.hidden = active.length < 2;
    if (active.length > 1)
      for (const n of [-1, 1]) {
        const preload = new Image();
        preload.src = active[(index + n + active.length) % active.length].href;
      }
  };
  image.addEventListener('error', () => {
    error.hidden = false;
    morphing = false;
  });
  // Browsers keep the previous photo painted until the next one decodes, so a full crossfade
  // needs no second layer: a short lift out of a blur on `load` is enough to soften the swap.
  // Skipped while the open morph is pending — that one animates the same properties.
  image.addEventListener('load', () => {
    if (morphing || reducedMotion()) return;
    image.animate(
      [
        { opacity: 0.6, filter: 'blur(4px)' },
        { opacity: 1, filter: 'blur(0)' },
      ],
      { duration: 200, easing: EASE_OUT },
    );
  });

  /** The on-screen thumbnail of the current photo (or the element that opened the lightbox):
   *  the photo grows out of it and flies back into it, so the spatial link is obvious. */
  const originRect = (): DOMRect | null => {
    const el = active[index]?.isConnected ? active[index] : opener;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight ? rect : null;
  };
  const morphIn = () => {
    const thumb = originRect();
    if (!thumb || reducedMotion()) return;
    morphing = true;
    const run = () => {
      morphing = false;
      const img = image.getBoundingClientRect();
      if (!img.width) return;
      image.animate(
        [
          { transform: fitTransform(thumb, img), opacity: 0.5 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 400, easing: EASE_OUT },
      );
    };
    if (image.complete && image.naturalWidth) run();
    else image.addEventListener('load', run, { once: true });
  };
  const requestClose = () => {
    if (closing) return;
    const thumb = originRect();
    const img = image.getBoundingClientRect();
    if (!thumb || !img.width || reducedMotion()) {
      dialog.close();
      return;
    }
    closing = true;
    dialog.classList.add('is-closing');
    const animation = image.animate(
      [
        { transform: image.style.transform || 'none', opacity: 1 },
        { transform: fitTransform(thumb, img), opacity: 0.4 },
      ],
      { duration: 260, easing: EASE_OUT, fill: 'forwards' },
    );
    const finish = () => {
      animation.cancel();
      closing = false;
      dialog.close();
    };
    animation.finished.then(finish, finish);
  };

  const open = (photos: HTMLAnchorElement[], selected: HTMLAnchorElement, onClose: () => void, origin?: HTMLElement) => {
    active = photos;
    restore = onClose;
    opener = origin;
    imageSpring?.cancel();
    imageSpring = null;
    sliding = false;
    setImageX(0);
    show(photos.indexOf(selected));
    oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    morphIn();
    dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus();
  };
  dialog.querySelector('[data-close]')!.addEventListener('click', requestClose);
  // Escape arrives as `cancel`; intercept it so the photo flies back instead of vanishing.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    requestClose();
  });
  prev.addEventListener('click', () => {
    if (!sliding) show(index - 1);
  });
  next.addEventListener('click', () => {
    if (!sliding) show(index + 1);
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).filter(
        (button) => !button.hidden && !button.disabled,
      );
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !sliding) {
      e.preventDefault();
      show(index + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || (e.target as HTMLElement).classList.contains('lightbox-inner')) requestClose();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = oldOverflow;
    dialog.classList.remove('is-closing');
    closing = false;
    imageSpring?.cancel();
    imageSpring = null;
    sliding = false;
    setImageX(0);
    restore?.();
    image.removeAttribute('src');
  });

  // Swiping the photo: it tracks the finger 1:1, the projected landing point decides whether
  // to turn the page, and the next photo enters from the side the finger was heading to.
  const settleImage = (to: number, velocity: number, response: number, onDone?: () => void) => {
    imageSpring?.cancel();
    if (reducedMotion()) {
      imageSpring = null;
      setImageX(to);
      onDone?.();
      return;
    }
    imageSpring = animateSpring({ from: imageX, to, velocity, response, damping: 1 }, setImageX, () => {
      imageSpring = null;
      onDone?.();
    });
  };
  const slide = (direction: 1 | -1, velocity: number, width: number) => {
    const out = -direction * (width + 40);
    sliding = true;
    settleImage(out, velocity, 0.25, () => {
      show(index + direction);
      setImageX(-out);
      settleImage(0, velocity, 0.4, () => {
        sliding = false;
      });
    });
  };
  horizontalDrag(image, {
    grab: () => {
      const moving = !!imageSpring;
      imageSpring?.cancel();
      imageSpring = null;
      sliding = false;
      imageBase = imageX;
      return moving;
    },
    move: (dx) => {
      const raw = imageBase + dx;
      setImageX(active.length > 1 ? raw : rubberband(raw, image.clientWidth || 300));
    },
    release: (velocity) => {
      const width = image.getBoundingClientRect().width || 300;
      const projected = imageX + project(velocity);
      if (active.length > 1 && Math.abs(projected) > width * 0.35) slide(projected < 0 ? 1 : -1, velocity, width);
      else settleImage(0, velocity, 0.35);
    },
  });

  document.querySelectorAll<HTMLElement>('[data-gallery]').forEach((root) => {
    root.dataset.interactive = 'true';
    const rail = root.querySelector<HTMLElement>('[data-rail]')!;
    // The rail clips and receives the pointer; the track inside it is what moves. Moving the
    // clipping element itself would drag its clip box along and leave a blank strip.
    const track = rail.querySelector<HTMLElement>('[data-track]') ?? rail;
    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-card]'));
    const photos = cards.map((card) => card.querySelector<HTMLAnchorElement>('[data-photo]')!);
    const nav = root.querySelector<HTMLElement>('.gallery-nav')!;
    const status = root.querySelector<HTMLElement>('[data-gallery-status]')!;
    initLoopCarousel({
      rail, track, cards,
      previous: root.querySelector<HTMLButtonElement>('[data-prev]')!,
      next: root.querySelector<HTMLButtonElement>('[data-next]')!,
      announce: () => {
        const first = track.querySelector<HTMLAnchorElement>('[data-photo]')!;
        status.textContent = `Фотография ${photos.indexOf(first) + 1} из ${photos.length}`;
      },
    });
    photos.forEach((photo) =>
      photo.addEventListener('click', (e) => {
        e.preventDefault();
        open(
          photos,
          photo,
          () => {
            // Return to the opener without changing the rail's order or position.
            photo.focus({ preventScroll: true });
          },
          photo,
        );
      }),
    );
    new ResizeObserver(() => {
      nav.hidden = track.scrollWidth <= rail.clientWidth + 2 || cards.length < 2;
    }).observe(rail);
  });
  // Standalone portrait opens the same team gallery, starting with this specialist.
  document.querySelectorAll<HTMLAnchorElement>('[data-standalone-photo]').forEach((link) =>
    link.addEventListener('click', (e) => {
      const source = document.querySelector<HTMLScriptElement>('[data-team-photos]');
      if (!source) return;
      e.preventDefault();
      const photos = (JSON.parse(source.textContent || '[]') as { full: string; title: string; alt: string; id: string }[]).map(
        (item) => {
          const a = document.createElement('a');
          a.href = item.full;
          a.dataset.caption = item.title;
          a.dataset.id = item.id;
          a.dataset.portrait = 'true';
          const img = document.createElement('img');
          img.alt = item.alt;
          a.append(img);
          return a;
        },
      );
      const selected = photos.find((p) => p.dataset.id === link.dataset.id);
      if (selected) open(photos, selected, () => link.focus({ preventScroll: true }), link);
    }),
  );
}
