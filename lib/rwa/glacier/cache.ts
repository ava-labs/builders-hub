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

  invalidate(key: string): void {
    this.cache.delete(key)
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
  transactions: (address: string) => `rwa:transactions:${address.toLowerCase()}`,
  metrics: () => 'rwa:metrics:all',
  historical: (metric: string, interval: string) =>
    `rwa:historical:${metric}:${interval}`,
  balance: (address: string) => `rwa:balance:${address.toLowerCase()}`,
  fenceMetrics: (slug: string) => `rwa:fence:metrics:${slug}`,
  fenceHistorical: (slug: string, startDate?: string, endDate?: string) =>
    `rwa:fence:historical:${slug}:${startDate ?? 'all'}:${endDate ?? 'all'}`,
}
