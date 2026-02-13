'use client'

import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoIcon, TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { bigintToNumber } from '@/lib/rwa/utils'
import { useCountUp } from '@/lib/rwa/hooks/useCountUp'
import type { MetricTrend, MultiPeriodTrend } from '@/lib/rwa/types'
import { usePalette } from '@/lib/rwa/hooks/usePalette'

type MetricFormat = 'currency' | 'days' | 'ratio' | 'percentage'

interface MetricCardProps {
  label: string
  value: number | bigint | null | undefined
  format: MetricFormat
  tooltip?: string
  isLoading?: boolean
  icon?: LucideIcon
  trend?: MultiPeriodTrend | null
}

function formatValue(value: number, format: MetricFormat): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'days':
      return `${Math.round(value)} days`
    case 'ratio':
      return value.toFixed(2) + 'x'
    case 'percentage':
      return value.toFixed(1) + '%'
  }
}

function formatTrendValue(t: { value: number; direction: string }): string {
  return `${t.value > 0 ? '+' : ''}${t.value.toFixed(1)}%`
}

function isMultiPeriodTrend(t: unknown): t is MultiPeriodTrend {
  return t !== null && typeof t === 'object' && '30d' in (t as Record<string, unknown>)
}

export function TrendPillBadge({ trend }: { trend: MultiPeriodTrend }) {
  const { trendPeriod } = usePalette()
  // Guard against stale cached data in old MetricTrend format
  const normalized: MultiPeriodTrend = isMultiPeriodTrend(trend)
    ? trend
    : { '7d': trend as unknown as MetricTrend, '30d': trend as unknown as MetricTrend, '90d': trend as unknown as MetricTrend }
  const active = normalized[trendPeriod]
  const bgClass =
    active.direction === 'up' ? 'bg-green-500/10' :
    active.direction === 'down' ? 'bg-red-500/10' : 'bg-gray-500/10'
  const textClass =
    active.direction === 'up' ? 'text-green-600 dark:text-green-400' :
    active.direction === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-500'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium cursor-default ${bgClass} ${textClass}`}>
            {active.direction === 'up' && <TrendingUp className="h-3 w-3" />}
            {active.direction === 'down' && <TrendingDown className="h-3 w-3" />}
            {formatTrendValue(active)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">7d:</span>
              <span className="font-medium">{formatTrendValue(normalized['7d'])}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">30d:</span>
              <span className="font-medium">{formatTrendValue(normalized['30d'])}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">90d:</span>
              <span className="font-medium">{formatTrendValue(normalized['90d'])}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function AnimatedValue({ value, format }: { value: number | bigint; format: MetricFormat }) {
  const numValue = typeof value === 'bigint' ? bigintToNumber(value) : value
  const animated = useCountUp(numValue)
  return <>{formatValue(animated, format)}</>
}

export function MetricCard({
  label,
  value,
  format,
  tooltip,
  isLoading = false,
  icon: Icon,
  trend,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700">
        <Skeleton className="h-4 w-24 mx-auto mb-3" />
        <Skeleton className="h-8 w-20 mx-auto" />
      </Card>
    )
  }

  const displayValue =
    value !== null && value !== undefined
      ? formatValue(typeof value === 'bigint' ? bigintToNumber(value) : value, format)
      : '-'

  return (
    <Card
      className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700"
      aria-label={`${label}: ${displayValue}`}
    >
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
        {Icon && (
          <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--rwa-accent-600)' }} />
        )}
        <span>{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 cursor-help shrink-0 text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-mono font-semibold text-foreground">
        {value !== null && value !== undefined ? (
          <AnimatedValue value={value} format={format} />
        ) : (
          '-'
        )}
      </div>
      {trend && (
        <div className="mt-2">
          <TrendPillBadge trend={trend} />
        </div>
      )}
    </Card>
  )
}

export function MetricCardLoading() {
  return (
    <Card className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700">
      <Skeleton className="h-4 w-24 mx-auto mb-3" />
      <Skeleton className="h-8 w-20 mx-auto" />
    </Card>
  )
}
