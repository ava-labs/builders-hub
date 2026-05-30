import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  calculateHistoricalData,
  getMetricTimeSeries,
} from '@/lib/rwa/calculations/aggregations'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'
import { getRWAProject } from '@/lib/rwa/projects'
import type { TimeInterval, HistoricalData } from '@/lib/rwa/types'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface RouteParams {
  params: Promise<{ slug: string }>
}

const querySchema = z.object({
  metric: z
    .enum([
      'transactedVolume',
      'assetsFinanced',
      'lenderRepayments',
      'capitalUtilization',
      'committedCapital',
      'netCapitalPosition',
      'all',
    ])
    .default('all'),
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  refresh: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

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
    const rawParams = {
      metric: searchParams.get('metric') ?? 'all',
      interval: searchParams.get('interval') ?? 'daily',
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

    if (validatedParams.metric === 'all') {
      const historical = await calculateHistoricalData(
        validatedParams.interval as TimeInterval,
        forceRefresh,
        dateRange
      )

      return NextResponse.json(historical, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        },
      })
    }

    const metricKey = validatedParams.metric as keyof HistoricalData
    const timeSeries = await getMetricTimeSeries(
      metricKey,
      validatedParams.interval as TimeInterval,
      forceRefresh,
      dateRange
    )

    return NextResponse.json(
      { metric: validatedParams.metric, interval: validatedParams.interval, data: timeSeries },
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
