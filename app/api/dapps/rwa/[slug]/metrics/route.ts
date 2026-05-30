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

  try {
    const { slug } = await params
    const project = getRWAProject(slug)

    if (!project) {
      return NextResponse.json(
        { error: 'RWA project not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const cacheKey = `${CacheKeys.metrics()}:${slug}`

    if (!forceRefresh) {
      const cached = cache.get(cacheKey)
      if (cached && !cached.isStale) {
        return NextResponse.json(cached.data, {
          headers: {
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
            'X-Cache': 'HIT',
          },
        })
      }
    }

    const metrics = await calculateAllMetrics(forceRefresh)
    const serializedMetrics = serializeBigints(metrics)

    cache.set(cacheKey, serializedMetrics)

    return NextResponse.json(serializedMetrics, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    const stale = cache.get(CacheKeys.metrics())
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
