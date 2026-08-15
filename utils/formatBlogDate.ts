/**
 * Formats a blog post date as "Mon Jul 28 2026".
 * Parses the value in UTC to avoid timezone day-shift (e.g. YAML dates are
 * UTC midnight, which would display as the previous day in negative-offset zones).
 */
export function formatBlogDate(raw: string | Date | undefined): string {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return '';
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)).toDateString();
}
