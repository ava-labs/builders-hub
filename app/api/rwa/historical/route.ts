import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculateHistoricalData,
  getMetricTimeSeries,
} from '@/lib/rwa/calculations/aggregations'
import type { TimeInterval, HistoricalData } from '@/lib/rwa/types'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const querySchema = z.object({
  metric: z
    .enum([
      'transactedVolume',
      'assetsFinanced',
      'lenderRepayments',
      'capitalUtilization',
      'all',
    ])
    .default('all'),
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  refresh: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
  const forwarded = request.headers.get('x-forwarded-for')
  const clientId = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'

  const now = Date.now()
  const entry = rateLimitStore.get(clientId)

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + 60_000 })
    return { allowed: true }
  }

  if (entry.count >= 60) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true }
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
    const rawParams = {
      metric: searchParams.get('metric') ?? 'all',
      interval: searchParams.get('interval') ?? 'daily',
      refresh: searchParams.get('refresh') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
    }

    const params = querySchema.parse(rawParams)
    const forceRefresh = params.refresh === 'true'
    const dateRange =
      params.startDate && params.endDate
        ? { from: new Date(params.startDate), to: new Date(params.endDate) }
        : undefined

    if (params.metric === 'all') {
      const historical = await calculateHistoricalData(
        params.interval as TimeInterval,
        forceRefresh,
        dateRange
      )

      return NextResponse.json(historical, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        },
      })
    }

    const metricKey = params.metric as keyof HistoricalData
    const timeSeries = await getMetricTimeSeries(
      metricKey,
      params.interval as TimeInterval,
      forceRefresh,
      dateRange
    )

    return NextResponse.json(
      { metric: params.metric, interval: params.interval, data: timeSeries },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    )
  }
}
