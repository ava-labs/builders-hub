/** Only allow local destinations; never send auth-page visitors back into auth. */
export function getAuthCallbackUrl(value: unknown, trackingParams?: URLSearchParams): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) {
    return "/";
  }

  try {
    const url = new URL(value, "https://build.avax.network");
    if (url.origin !== "https://build.avax.network" || /^\/(login|signup)(\/|$)/.test(url.pathname)) return "/";
    trackingParams?.forEach((entry, key) => {
      if ((key === "ref" || key.startsWith("utm_")) && !url.searchParams.has(key)) {
        url.searchParams.set(key, entry);
      }
    });
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
