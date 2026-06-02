// Apply URLs are rendered as anchor hrefs, so only http(s) is safe. z.string().url()
// and `new URL(...)` both accept javascript:, data: and mailto: schemes, which would
// execute on click — guard every write path (community submit + ingest) with this.
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
