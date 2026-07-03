// Strip Getro-injected tracking params from apply URLs so users land on the
// canonical company / ATS link. Keep any other UTM the host placed there.
const GETRO_PARAMS = new Set([
  'gh_src',
  'utm_source',
  'utm_medium',
  'utm_campaign',
]);
const GETRO_VALUES = new Set([
  'Avalanche+job+board',
  'Avalanche job board',
  'getro.com',
  'getro',
]);

export function cleanApplyUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;
    const remove: string[] = [];
    params.forEach((value, key) => {
      if (GETRO_PARAMS.has(key) && GETRO_VALUES.has(value)) {
        remove.push(key);
      }
    });
    remove.forEach((k) => params.delete(k));
    url.search = params.toString();
    return url.toString();
  } catch {
    return rawUrl;
  }
}
