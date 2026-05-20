// Shared module-level cache for the raw global ICTT transfers feed. Both
// `/api/ictt-stats` (which enriches + paginates) and the L1 dashboard's
// `/api/l1-tokens/discover` (which only needs the address pairs) read
// through here so a single idx6 fetch per 36-hour window backs both.
//
// The third-party feed at idx6.solokhin.com has been observed returning
// Cloudflare 521s, so the fetcher exposes both a strict path (`getIcttTransfers`,
// throws on failure) and a soft path (`tryGetIcttTransfers`, returns `null`).
// Use the soft path in routes that should still return a useful response
// when the upstream is down.

export interface IcttTransfer {
  homeChainBlockchainId: string;
  homeChainName: string;
  remoteChainBlockchainId: string;
  remoteChainName: string;
  direction: string;
  contractAddress: string;
  coinAddress: string;
  transferCount: number;
  transferCoinsTotal: number;
}

const ICTT_TRANSFERS_URL = 'https://idx6.solokhin.com/api/global/ictt/transfers';
const CACHE_DURATION_MS = 36 * 60 * 60 * 1000;

interface CacheEntry {
  transfers: IcttTransfer[];
  timestamp: number;
}

let cache: CacheEntry | null = null;
// Single-flight: collapse concurrent fetches into one upstream request so a
// burst of requests after cache expiry doesn't fan out to the third-party.
let inflight: Promise<IcttTransfer[]> | null = null;

async function fetchTransfers(): Promise<IcttTransfer[]> {
  const endTs = Math.floor(Date.now() / 1000);
  const response = await fetch(`${ICTT_TRANSFERS_URL}?startTs=0&endTs=${endTs}`);
  if (!response.ok) {
    throw new Error(`ICTT API error: ${response.status}`);
  }
  return (await response.json()) as IcttTransfer[];
}

export interface GetTransfersOptions {
  /** Skip the cache and force a fresh fetch. */
  clearCache?: boolean;
}

/**
 * Get the cached global ICTT transfers feed. Throws if the upstream is
 * unreachable AND no cache entry exists. Returns a stale cache entry if
 * one exists but is past the TTL — staleness is preferable to a hard
 * failure for dashboards that always want *something* to render.
 */
export async function getIcttTransfers(options: GetTransfersOptions = {}): Promise<IcttTransfer[]> {
  const { clearCache = false } = options;

  if (!clearCache && cache && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
    return cache.transfers;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const transfers = await fetchTransfers();
      cache = { transfers, timestamp: Date.now() };
      return transfers;
    } catch (error) {
      // Upstream failed. If we have a stale cache, return it rather than
      // hard-failing the request. Otherwise propagate.
      if (cache) {
        console.warn('ICTT transfers fetch failed, serving stale cache:', error);
        return cache.transfers;
      }
      throw error;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Soft variant: returns `null` instead of throwing when the upstream
 * fails AND no cache exists. Use in routes that should still return a
 * useful response when idx6 is down.
 */
export async function tryGetIcttTransfers(options: GetTransfersOptions = {}): Promise<IcttTransfer[] | null> {
  try {
    return await getIcttTransfers(options);
  } catch (error) {
    console.warn('ICTT transfers unavailable:', error);
    return null;
  }
}

/** Test-only: reset the module-level cache. Not exported via index. */
export function __resetCacheForTests(): void {
  cache = null;
  inflight = null;
}
