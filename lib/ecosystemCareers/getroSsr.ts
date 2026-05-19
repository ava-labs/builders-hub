// Fetches a jobs.avax.network page and extracts its `__NEXT_DATA__` script
// payload (the SSR'd Redux state). Used to harvest job + organization data
// without needing the auth-gated api.getro.com endpoints.

const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

export const GETRO_HOST = 'https://jobs.avax.network';
export const GETRO_COLLECTION_ID = 10223;

export interface FetchOpts {
  signal?: AbortSignal;
  // Inject a fetcher in tests
  fetcher?: typeof fetch;
}

export async function fetchGetroPage<T = unknown>(
  path: string,
  opts: FetchOpts = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${GETRO_HOST}${path}`;
  const f = opts.fetcher ?? fetch;
  const res = await f(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; BuildersHubBot/1.0; +https://build.avax.network)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`Getro fetch failed: ${res.status} ${res.statusText} (${url})`);
  }
  const html = await res.text();
  const match = html.match(NEXT_DATA_RE);
  if (!match) {
    throw new Error(`__NEXT_DATA__ not found in ${url}`);
  }
  try {
    return JSON.parse(match[1]) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse __NEXT_DATA__ from ${url}: ${(err as Error).message}`,
    );
  }
}

export interface GetroPageData {
  props: {
    pageProps: {
      initialState: {
        jobs?: {
          total?: number;
          found?: unknown[];
          currentJob?: unknown;
        };
      };
      network?: { slug?: string; name?: string };
    };
  };
}

// Public Getro API endpoint that lists every organization in the collection
// (id, name, slug only). Auth-free.
export async function fetchGetroOrganizationsAll(
  opts: FetchOpts = {},
): Promise<{ id: number; name: string; slug: string }[]> {
  const url = `https://api.getro.com/api/v1/collections/${GETRO_COLLECTION_ID}/organizations/all`;
  const f = opts.fetcher ?? fetch;
  const res = await f(url, {
    headers: {
      Accept: 'application/json',
      Origin: 'https://jobs.avax.network',
      Referer: 'https://jobs.avax.network/',
    },
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(
      `organizations/all fetch failed: ${res.status} ${res.statusText}`,
    );
  }
  const body = (await res.json()) as { items?: { id: number; name: string; slug: string }[] };
  return body.items ?? [];
}
