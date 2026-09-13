/** The official script manages iframe sizing and playback inside Telegram. */
export function initTelegramPosts() {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const root = entry.target as HTMLElement;
      observer.unobserve(root);
      const mount = root.querySelector<HTMLElement>('[data-telegram-widget]')!;
      const status = root.querySelector<HTMLElement>('[data-telegram-status]')!;
      const failed = () => {
        status.hidden = false;
        status.textContent = 'Telegram загружается дольше обычного. Можно открыть сообщение по ссылке ниже.';
      };
      const timeout = window.setTimeout(failed, 12000);
      // Observe before insertion: a cached script can create its iframe immediately.
      const mutations = new MutationObserver(() => {
        const frame = mount.querySelector('iframe');
        if (!frame) return;
        mutations.disconnect();
        frame.title = `Telegram: ${root.dataset.telegramTitle || 'Видео специалиста'}`;
        frame.addEventListener('load', () => { clearTimeout(timeout); status.hidden = true; });
        frame.addEventListener('error', failed);
      });
      mutations.observe(mount, { childList: true, subtree: true });
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.dataset.telegramPost = root.dataset.telegramPost;
      script.dataset.width = '100%';
      script.dataset.userpic = 'false';
      script.dataset.color = '967642';
      script.addEventListener('error', () => { clearTimeout(timeout); mutations.disconnect(); failed(); });
      mount.append(script);
    }
  }, { rootMargin: '300px' });
  document.querySelectorAll<HTMLElement>('div[data-telegram-post]').forEach(root => {
    if (root.dataset.telegramReady) return;
    root.dataset.telegramReady = 'true';
    observer.observe(root);
  });
}
