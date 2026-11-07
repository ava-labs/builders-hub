import { BaseError } from 'viem'

interface CacheEntry<T> {
  data: T
  timestamp: number
  staleAt: number
  expireAt: number
}

interface CacheOptions {
  ttl: number
  staleWhileRevalidate: number
}

const DEFAULT_OPTIONS: CacheOptions = {
  ttl: 5 * 60 * 1000,
  staleWhileRevalidate: 30 * 60 * 1000,
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private revalidating = new Set<string>()

  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    const now = Date.now()
    if (now > entry.expireAt) {
      this.cache.delete(key)
      return null
    }

    return { data: entry.data, isStale: now > entry.staleAt }
  }

  set<T>(key: string, data: T, options: Partial<CacheOptions> = {}): void {
    const { ttl, staleWhileRevalidate } = { ...DEFAULT_OPTIONS, ...options }
    const now = Date.now()

    this.cache.set(key, {
      data,
      timestamp: now,
      staleAt: now + ttl,
      expireAt: now + ttl + staleWhileRevalidate,
    })
  }

  isRevalidating(key: string): boolean {
    return this.revalidating.has(key)
  }

  setRevalidating(key: string, value: boolean): void {
    if (value) {
      this.revalidating.add(key)
    } else {
      this.revalidating.delete(key)
    }
  }

  /** an invalidated key is read again at once: its copy and a failure remembered for it both go */
  invalidate(key: string): void {
    this.cache.delete(key)
    this.cache.delete(failureKey(key))
    this.revalidating.delete(key)
  }
}

// Singleton via globalThis to survive HMR
const globalCache = globalThis as unknown as { __rwaCache?: InMemoryCache }
if (!globalCache.__rwaCache) {
  globalCache.__rwaCache = new InMemoryCache()
}
export const cache: InMemoryCache = globalCache.__rwaCache

export const CacheKeys = {
  transactions: (slug: string, address: string) =>
    `rwa:transactions:${slug}:${address.toLowerCase()}`,
  metrics: (slug: string) => `rwa:metrics:${slug}`,
  historical: (slug: string, metric: string, interval: string) =>
    `rwa:historical:${slug}:${metric}:${interval}`,
  balance: (slug: string, address: string) => `rwa:balance:${slug}:${address.toLowerCase()}`,
  fenceMetrics: (slug: string) => `rwa:fence:metrics:${slug}`,
  fenceHistorical: (slug: string, startDate?: string, endDate?: string) =>
    `rwa:fence:historical:${slug}:${startDate ?? 'all'}:${endDate ?? 'all'}`,
  line: (slug: string, read: 'days' | 'ledger' | 'position') => `rwa:line:${read}:${slug}`,
}

/** the reads still running for keys the cache misses: callers that miss together share one */
const pending = new Map<string, Promise<unknown>>()

// A failed read is remembered for a minute, by readThrough and by Fence (fence/metrics.ts): until then its key is
// not read again, so an outage costs each key one read a minute, not one a request.
export const FAILURE_MEMORY_MS = 60_000

/** the cache entry that remembers a failed read of `key`, readThrough's or Fence's */
export function failureKey(key: string): string {
  return `${key}:failed`
}

const rememberFailure = (key: string, error: unknown) =>
  cache.set(failureKey(key), error, { ttl: FAILURE_MEMORY_MS, staleWhileRevalidate: 0 })
const forgetFailure = (key: string) => cache.invalidate(failureKey(key))

/**
 * The cached value at key, or read's. A fresh copy is served as is. A stale copy is served at once, and one refresh
 * runs behind it; a refresh that fails keeps the stale copy. A miss waits for the read, which every caller that
 * misses meanwhile shares; a read that fails reaches each of them. A failed read or refresh is remembered for a
 * minute: until then a stale copy is served with no refresh, and a miss gets that failure without a read.
 */
export function readThrough<T>(key: string, read: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key)
  const failure = cache.get(failureKey(key))
  if (cached) {
    if (cached.isStale && !failure && !cache.isRevalidating(key)) void refresh(key, read)
    return Promise.resolve(cached.data)
  }

  const running = pending.get(key) as Promise<T> | undefined
  if (running) return running
  if (failure) return Promise.reject(failure.data)

  const reading = read()
    .then(
      (data) => {
        cache.set(key, data)
        forgetFailure(key)
        return data
      },
      (error: unknown) => {
        rememberFailure(key, error)
        throw error
      }
    )
    .finally(() => pending.delete(key))
  pending.set(key, reading)
  return reading
}

async function refresh<T>(key: string, read: () => Promise<T>): Promise<void> {
  cache.setRevalidating(key, true)
  try {
    cache.set(key, await read())
    forgetFailure(key)
  } catch (error) {
    rememberFailure(key, error)
    // viem writes the RPC's URL, for the position our own node's, into its errors' full text: log the short one
    console.error('[rwa] refresh failed:', key, error instanceof BaseError ? error.shortMessage : String(error))
  } finally {
    cache.setRevalidating(key, false)
  }
}
