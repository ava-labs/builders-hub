import { NextResponse } from 'next/server'
import { calculateAllMetrics } from '@/lib/rwa/calculations/metrics'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { serializeBigints } from '@/lib/rwa/utils'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'
import { getRWAProject } from '@/lib/rwa/projects'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const rateLimit = checkRateLimit(request)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter) },
      }
    )
  }

  // the stale fallback below reads the same key a success writes
  const { slug } = await params
  const cacheKey = `${CacheKeys.metrics()}:${slug}`

  try {
    const project = getRWAProject(slug)

    if (!project) {
      return NextResponse.json(
        { error: 'RWA project not found' },
        { status: 404 }
      )
    }

    // no caller can skip the cache: a public refresh would let anyone drive the Stats API reads
    const cached = cache.get(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
          'X-Cache': 'HIT',
        },
      })
    }

    const metrics = await calculateAllMetrics()
    const serializedMetrics = serializeBigints(metrics)

    cache.set(cacheKey, serializedMetrics)

    return NextResponse.json(serializedMetrics, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    const stale = cache.get(cacheKey)
    if (stale) {
      return NextResponse.json(stale.data, {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'STALE',
        },
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
