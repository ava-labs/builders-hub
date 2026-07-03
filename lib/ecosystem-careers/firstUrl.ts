export function firstUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return null;
}
