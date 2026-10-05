import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchFenceHistorical } from '@/lib/rwa/fence/metrics'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'
import { getRWAProject } from '@/lib/rwa/projects'
import { isFenceWindow } from '@/lib/rwa/series'
import type { FenceHistoricalData } from '@/lib/rwa/types'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// an ISO day or timestamp; anything else is a 400, not an Invalid Date downstream
const isoDate = z.union([z.iso.date(), z.iso.datetime()])

const querySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
})

export async function GET(request: Request, { params }: RouteParams) {
  const rateLimit = checkRateLimit(request)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  const { slug } = await params

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.issues },
      { status: 400 }
    )
  }

  // a window is one the view asks for or none at all: any other bounds would
  // mint a cache entry and two Fence reads per request
  const { startDate, endDate } = parsed.data
  const today = new Date().toISOString().slice(0, 10)
  if ((startDate || endDate) && !(startDate && endDate && isFenceWindow(startDate, endDate, today))) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }
  const dateRange = startDate && endDate ? { from: new Date(startDate), to: new Date(endDate) } : undefined
  // the key fetchFenceHistorical stores a window under, so the HIT check
  // and the stale fallback both read the copy it kept
  const cacheKey = CacheKeys.fenceHistorical(slug, dateRange?.from.toISOString(), dateRange?.to.toISOString())

  try {
    const project = getRWAProject(slug)

    if (!project) {
      return NextResponse.json({ error: 'RWA project not found' }, { status: 404 })
    }

    if (!project.features?.fence) {
      return NextResponse.json({ error: 'Fence metrics not available for this project' }, { status: 404 })
    }

    // no caller can skip the cache: a public refresh would let anyone drive the Fence reads
    const cached = cache.get<FenceHistoricalData>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
          'X-Cache': 'HIT',
        },
      })
    }

    const historical = await fetchFenceHistorical(slug, dateRange)

    return NextResponse.json(historical, {
      headers: {
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
        'X-Cache': 'MISS',
      },
    })
  } catch {
    const stale = cache.get<FenceHistoricalData>(cacheKey)
    if (stale) {
      return NextResponse.json(stale.data, {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'STALE',
        },
      })
    }

    return NextResponse.json(
      { error: 'Fence API unavailable' },
      { status: 503 }
    )
  }
}
