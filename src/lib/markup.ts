/**
 * Small text → HTML helpers shared by components.
 * Editors write `_слово_` for gold italic emphasis and use line breaks for manual wrapping.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `Красота,\n_основанная_` → `Красота,<br><em>основанная</em>` (HTML-escaped first). */
export function em(text: string | null | undefined): string {
  if (!text) return '';
  return escapeHtml(text)
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/** `+7 925 017-77-78` → `79250177778`. A leading `8` is normalised to `7` for Russian numbers. */
export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('8') ? '7' + digits.slice(1) : digits;
}

export function telHref(phone: string): string {
  return `tel:+${phoneDigits(phone)}`;
}

export function whatsappHref(phone: string, text?: string): string {
  const base = `https://wa.me/${phoneDigits(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
