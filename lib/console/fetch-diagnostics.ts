/**
 * Wraps window.fetch so a failed request to the Avalanche public API says why, in the error the console shows.
 * Mobile browsers report a blocked or dropped request only as "Load failed" / "Failed to fetch"; this adds the
 * method, URL, how long it took, whether the browser thinks it is online, and a CORS-free reachability probe of the
 * same host. The probe separates a CORS or preflight rejection (host reachable) from a network block (host not).
 */

const WATCHED = /^https:\/\/api\.avax(-test)?\.network\//;

let installed = false;

async function probe(origin: string): Promise<string> {
  const started = performance.now();
  try {
    // no-cors needs no preflight and no CORS headers, so it only fails when the host can't be reached at all.
    await fetch(`${origin}/ext/health`, { mode: 'no-cors', cache: 'no-store' });
    return `reachable without CORS in ${Math.round(performance.now() - started)}ms`;
  } catch (error) {
    return `unreachable too (${error instanceof Error ? error.message : String(error)})`;
  }
}

export function installFetchDiagnostics() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!WATCHED.test(url)) return original(input, init);

    const started = performance.now();
    try {
      return await original(input, init);
    } catch (error) {
      // A cancelled request is not a failure: callers check for AbortError to ignore it.
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      const elapsed = Math.round(performance.now() - started);
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const host = await probe(new URL(url).origin);
      const detail = [
        `${init?.method ?? 'GET'} ${url} failed after ${elapsed}ms`,
        `browser said "${reason}"`,
        `online=${navigator.onLine}`,
        `same host ${host}`,
        `page ${document.visibilityState}`,
      ].join('; ');
      console.error('[avalanche api]', detail, error);
      throw new TypeError(detail, { cause: error });
    }
  };
}
