const store = new Map<string, { count: number; resetAt: number }>()

interface RateLimitOptions {
  maxRequests?: number
  windowMs?: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}

export function checkRateLimit(
  request: Request,
  { maxRequests = 60, windowMs = 60_000 }: RateLimitOptions = {}
): RateLimitResult {
  const forwarded = request.headers.get('x-forwarded-for')
  const clientId = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'

  const now = Date.now()

  // Cleanup expired entries when store grows large
  if (store.size > 1000) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }

  const entry = store.get(clientId)

  if (!entry || entry.resetAt <= now) {
    store.set(clientId, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  const updated = { count: entry.count + 1, resetAt: entry.resetAt }
  store.set(clientId, updated)
  return { allowed: true, remaining: maxRequests - updated.count }
}
