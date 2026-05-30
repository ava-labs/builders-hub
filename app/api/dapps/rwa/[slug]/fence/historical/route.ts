import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchFenceHistorical } from '@/lib/rwa/fence/metrics'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'
import { getRWAProject } from '@/lib/rwa/projects'
import type { FenceHistoricalData } from '@/lib/rwa/types'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ slug: string }>
}

const querySchema = z.object({
  refresh: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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

  try {
    const project = getRWAProject(slug)

    if (!project) {
      return NextResponse.json({ error: 'RWA project not found' }, { status: 404 })
    }

    if (!project.features?.fence) {
      return NextResponse.json({ error: 'Fence metrics not available for this project' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const rawParams = {
      refresh: searchParams.get('refresh') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
    }

    const validatedParams = querySchema.parse(rawParams)
    const forceRefresh = validatedParams.refresh === 'true'

    const dateRange =
      validatedParams.startDate && validatedParams.endDate
        ? { from: new Date(validatedParams.startDate), to: new Date(validatedParams.endDate) }
        : undefined

    const cacheKey = CacheKeys.fenceHistorical(slug, validatedParams.startDate, validatedParams.endDate)

    if (!forceRefresh) {
      const cached = cache.get<FenceHistoricalData>(cacheKey)
      if (cached && !cached.isStale) {
        return NextResponse.json(cached.data, {
          headers: {
            'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
            'X-Cache': 'HIT',
          },
        })
      }
    }

    const historical = await fetchFenceHistorical(slug, dateRange, forceRefresh)

    return NextResponse.json(historical, {
      headers: {
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }

    const stale = cache.get<FenceHistoricalData>(CacheKeys.fenceHistorical(slug))
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
