/* Two rules for a route that keeps answers in a Map between requests.
   - The Map has a size. A key that holds a caller's value would else grow it with each new value, until the
     instance stops.
   - A caller cannot empty it. The `clearCache=true` switch is for a developer and for tests; in production it
     would make each request pay the full upstream cost, for every visitor. */

/** Drops the oldest entries of a cache above its size. A Map keeps the order of its first sets. */
export function trimCache(cache: Map<unknown, unknown>, max: number): void {
  while (cache.size > max) cache.delete(cache.keys().next().value);
}

/** True when a request may empty a route's cache: never in production. */
export function mayResetCache(searchParams: URLSearchParams): boolean {
  return process.env.NODE_ENV !== 'production' && searchParams.get('clearCache') === 'true';
}

/** A caller's value when it is one of the keys a route knows, else the route's default. */
export function knownKey<K extends string>(value: string | null, known: readonly K[], fallback: K): K {
  return known.includes(value as K) ? (value as K) : fallback;
}
