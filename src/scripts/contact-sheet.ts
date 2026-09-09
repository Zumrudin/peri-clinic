/**
 * Contact sheet (<dialog id="contact-sheet">): opened by any [data-open-sheet] element.
 * data-context="Volnewmer" on the trigger is appended to the WhatsApp prefilled text.
 */
export function initContactSheet(): void {
  const sheet = document.getElementById('contact-sheet') as HTMLDialogElement | null;
  if (!sheet || typeof sheet.showModal !== 'function') return;

  const wa = sheet.querySelector<HTMLAnchorElement>('[data-whatsapp]');
  const baseText = wa?.dataset.text ?? '';
  const waBase = wa?.dataset.base ?? '';

  const setContext = (context: string | undefined) => {
    if (!wa) return;
    const text = context ? `${baseText}: ${context}` : baseText;
    wa.href = text ? `${waBase}?text=${encodeURIComponent(text)}` : waBase;
  };

  const open = (context?: string) => {
    setContext(context);
    sheet.showModal();
    document.body.classList.add('sheet-open');
  };
  const close = () => sheet.close();

  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-open-sheet]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger.dataset.context);
  });

  sheet.addEventListener('click', (e) => {
    // Backdrop click: the dialog itself is the target only outside its inner panel.
    if (e.target === sheet) close();
  });
  sheet.querySelector('[data-close-sheet]')?.addEventListener('click', close);
  sheet.addEventListener('close', () => document.body.classList.remove('sheet-open'));

  // Analytics hook: Phase 6 wires Metrika goals here.
  sheet.querySelectorAll<HTMLAnchorElement>('a[data-goal]').forEach((a) => {
    a.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('peri:contact', { detail: { goal: a.dataset.goal } }));
    });
  });
}
