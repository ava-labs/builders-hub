/**
 * Generic in-memory cache with TTL presets for the MCP server.
 */

// ---------------------------------------------------------------------------
// Named TTL presets (milliseconds)
// ---------------------------------------------------------------------------

export const CACHE_TTL = {
  IMMUTABLE: Infinity,          // Finalized blocks, committed txs
  VALIDATORS: 24 * 60 * 60 * 1000,  // 24h
  SUPPLY: 4 * 60 * 60 * 1000,       // 4h
  METRICS: 4 * 60 * 60 * 1000,      // 4h
  CHAINS: 60 * 60 * 1000,           // 1h
  NODE_INFO: 10 * 60 * 1000,        // 10m
  FEES: 5 * 60 * 1000,              // 5m
  BALANCE: 30 * 1000,               // 30s
  HEIGHT: 3 * 1000,                 // 3s
  DOCS: 60 * 60 * 1000,             // 1h
} as const;

// ---------------------------------------------------------------------------
// Cache store
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Retrieve a cached value, or undefined if missing / expired.
 */
export function getCached<T>(key: string, ttlMs: number): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (ttlMs !== Infinity && Date.now() - entry.timestamp > ttlMs) {
    store.delete(key);
    return undefined;
  }
  return entry.data;
}

/**
 * Store a value in the cache.
 */
export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

/**
 * Helper that wraps a getter with cache logic.
 * @param key   Cache key
 * @param ttlMs TTL in milliseconds (use CACHE_TTL presets)
 * @param fetch Function that produces the fresh value
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetch: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(key, ttlMs);
  if (cached !== undefined) return cached;
  const data = await fetch();
  setCache(key, data);
  return data;
}

/**
 * Clear all cache entries (useful in tests).
 */
export function clearCache(): void {
  store.clear();
}
