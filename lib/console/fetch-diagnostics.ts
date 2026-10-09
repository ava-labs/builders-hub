/**
 * Wraps window.fetch for the Avalanche public API (api.avax(-test).network).
 *
 * iOS WebKit can refuse the CORS preflight that every JSON-RPC POST to that host needs, while the host itself is
 * reachable. A call the browser refuses is retried once through Builder Hub's same-origin relay
 * (/api/avalanche-api), which needs no CORS. If that fails too, the error the console shows says why: the method,
 * URL, time to failure, online state, page visibility, a CORS-free probe of the host and the relay's answer.
 */

const WATCHED = /^https:\/\/api\.avax(-test)?\.network\//;

let installed = false;

async function probe(origin: string, fetcher: typeof fetch): Promise<string> {
  const started = performance.now();
  try {
    // no-cors needs no preflight and no CORS headers, so it only fails when the host can't be reached at all.
    await fetcher(`${origin}/ext/health`, { mode: 'no-cors', cache: 'no-store' });
    return `reachable without CORS in ${Math.round(performance.now() - started)}ms`;
  } catch (error) {
    return `unreachable too (${error instanceof Error ? error.message : String(error)})`;
  }
}

function relayUrl(url: URL): string {
  const network = url.hostname === 'api.avax-test.network' ? 'fuji' : 'mainnet';
  return `/api/avalanche-api/${network}${url.pathname}`;
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
      const parsed = new URL(url);

      let relay = 'not tried (request body is not a string)';
      if ((init?.method ?? 'GET').toUpperCase() === 'POST' && typeof init?.body === 'string') {
        try {
          const response = await original(relayUrl(parsed), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: init.body,
            signal: init.signal,
          });
          if (response.status !== 404) return response;
          relay = 'refused this endpoint';
        } catch (relayError) {
          if (relayError instanceof DOMException && relayError.name === 'AbortError') throw relayError;
          relay = `failed (${relayError instanceof Error ? relayError.message : String(relayError)})`;
        }
      }

      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const detail = [
        `${init?.method ?? 'GET'} ${url} failed after ${elapsed}ms`,
        `browser said "${reason}"`,
        `online=${navigator.onLine}`,
        `same host ${await probe(parsed.origin, original)}`,
        `relay ${relay}`,
        `page ${document.visibilityState}`,
      ].join('; ');
      console.error('[avalanche api]', detail, error);
      throw new TypeError(detail, { cause: error });
    }
  };
}
