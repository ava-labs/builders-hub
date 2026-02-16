import { NextResponse } from 'next/server'
import { calculateAllMetrics } from '@/lib/rwa/calculations/metrics'
import { cache, CacheKeys } from '@/lib/rwa/glacier/cache'
import { serializeBigints } from '@/lib/rwa/utils'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface SerializedLenderBreakdown {
  lender: string
  address: string
  amount: string
  percentage: number
}

interface SerializedAllMetrics {
  general: {
    transactedVolume: string
    assetsFinanced: string
    lenderRepayments: string
    idleCapital: string
    committedCapital: string
    capitalTurnover: number
    lifeSinceInception: number
    avgCapitalRecycling: number
    averageCapitalUtilization: number
    capitalRecoveryRatio: number
    impliedAnnualizedReturn: number
  }
  oatfi: {
    capitalOutstanding: string
    principalRepayments: string
    convertedUsdc: string
  }
  lenderBreakdown: SerializedLenderBreakdown[]
  lastUpdated: string
}

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!forceRefresh) {
      const cached = cache.get<SerializedAllMetrics>(CacheKeys.metrics())
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
    const serializedMetrics = serializeBigints(metrics) as unknown as SerializedAllMetrics

    cache.set(CacheKeys.metrics(), serializedMetrics)

    return NextResponse.json(serializedMetrics, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    const stale = cache.get<SerializedAllMetrics>(CacheKeys.metrics())
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
