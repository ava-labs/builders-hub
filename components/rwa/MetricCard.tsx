'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { bigintToNumber } from '@/lib/rwa/utils'

type MetricFormat = 'currency' | 'days' | 'ratio' | 'percentage'

interface MetricCardProps {
  label: string
  value: number | bigint | null | undefined
  format: MetricFormat
  tooltip?: string
  isLoading?: boolean
  icon?: LucideIcon
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
  }
}

function formatValue(value: number | bigint, format: MetricFormat): string {
  const numValue = typeof value === 'bigint' ? bigintToNumber(value) : value

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numValue)
    case 'days':
      return `${Math.round(numValue)} days`
    case 'ratio':
      return numValue.toFixed(2) + 'x'
    case 'percentage':
      return numValue.toFixed(1) + '%'
  }
}

function TrendIndicator({
  trend,
}: {
  trend: { value: number; direction: 'up' | 'down' | 'neutral' }
}) {
  const Icon =
    trend.direction === 'up'
      ? TrendingUp
      : trend.direction === 'down'
        ? TrendingDown
        : Minus

  const colorClass =
    trend.direction === 'up'
      ? 'text-green-500'
      : trend.direction === 'down'
        ? 'text-red-500'
        : 'text-gray-400'

  return (
    <span className={`flex items-center gap-0.5 sm:gap-1 text-xs sm:text-sm shrink-0 ${colorClass}`}>
      <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
      {trend.value > 0 ? '+' : ''}
      {trend.value.toFixed(1)}%
    </span>
  )
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
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-[120px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-[100px]" />
        </CardContent>
      </Card>
    )
  }

  const displayValue =
    value !== null && value !== undefined ? formatValue(value, format) : '-'

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1 sm:gap-2">
          {Icon && <Icon className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />}
          <span className="truncate">{label}</span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon className="h-3 w-3 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="text-sm">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-lg sm:text-2xl font-bold truncate">{displayValue}</div>
          {trend && <TrendIndicator trend={trend} />}
        </div>
      </CardContent>
    </Card>
  )
}

export function MetricCardLoading() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-[120px]" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-[100px]" />
      </CardContent>
    </Card>
  )
}
