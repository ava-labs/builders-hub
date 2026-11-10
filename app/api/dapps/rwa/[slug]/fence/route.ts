import { NextResponse } from 'next/server'
import { fetchFenceMetrics } from '@/lib/rwa/fence/metrics'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'
import { getRWAProject } from '@/lib/rwa/projects'
import type { FenceMetrics } from '@/lib/rwa/types'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const rateLimit = checkRateLimit(request)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  const { slug } = await params

  try {
    const project = getRWAProject(slug)

    if (!project) {
      return NextResponse.json({ error: 'RWA project not found' }, { status: 404 })
    }

    if (!project.features?.fence) {
      return NextResponse.json({ error: 'Fence metrics not available for this project' }, { status: 404 })
    }

    // no caller can skip the cache: a public refresh would let anyone drive the Fence reads
    const cached = cache.get<FenceMetrics>(CacheKeys.fenceMetrics(slug))
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
          'X-Cache': 'HIT',
        },
      })
    }

    const metrics = await fetchFenceMetrics(slug)

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('[Fence API] Route error:', error)
    const stale = cache.get<FenceMetrics>(CacheKeys.fenceMetrics(slug))
    if (stale) {
      return NextResponse.json(stale.data, {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'STALE',
        },
      })
    }

    // the upstream error stays in the server log; the browser gets a fixed line
    return NextResponse.json(
      { error: 'Fence API unavailable' },
      { status: 503 }
    )
  }
}
