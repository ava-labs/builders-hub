/** Normalize local or same-origin destinations; never redirect back into auth. */
export function getAuthCallbackUrl(
  value: unknown,
  trackingParams?: URLSearchParams,
  requestOrigin = "https://build.avax.network",
): string {
  if (
    typeof value !== "string" ||
    (!value.startsWith("/") && !/^https?:\/\//i.test(value)) ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  ) {
    return "/";
  }

  try {
    const origin = new URL(requestOrigin);
    const url = new URL(value, origin);
    if (
      !/^https?:$/.test(origin.protocol) ||
      url.origin !== origin.origin ||
      url.username || url.password ||
      url.pathname.startsWith("//") ||
      /^\/(login|signup)(\/|$)/.test(url.pathname)
    ) return "/";
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
