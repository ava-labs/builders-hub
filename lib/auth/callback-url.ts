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

/** A path of this site to return to after an account link, as a URL on `base`; null when the value could name another
 *  site. A backslash or a control character is refused: a URL parser reads "/\\host" and "/<tab>/host" as "//host". */
export function localReturnTarget(value: string | undefined, base: string): URL | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const target = new URL(value, base);
    return target.origin === new URL(base).origin ? target : null;
  } catch {
    return null;
  }
}
