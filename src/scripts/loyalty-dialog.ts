function initLoyaltyDialog() {
  const dialog = document.querySelector<HTMLDialogElement>('#loyalty-messengers');
  if (!dialog || dialog.dataset.initialized) return;
  dialog.dataset.initialized = 'true';
  let trigger: HTMLElement | null = null;
  document.querySelectorAll<HTMLElement>('[data-open-loyalty]').forEach(button => {
    button.addEventListener('click', () => {
      trigger = button;
      dialog.showModal();
      document.body.classList.add('sheet-open');
    });
  });
  dialog.querySelector('[data-close-loyalty]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('sheet-open');
    trigger?.focus({ preventScroll: true });
  });
}
initLoyaltyDialog();
document.addEventListener('astro:page-load', initLoyaltyDialog);
