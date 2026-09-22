export function reviewUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function reviewRating(value?: number | null): number | null {
  return value != null && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}
