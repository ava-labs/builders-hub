'use client'

import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { bigintToNumber } from '@/lib/rwa/utils'
import { useCountUp } from '@/lib/rwa/hooks/useCountUp'
type MetricFormat = 'currency' | 'days' | 'ratio' | 'percentage'

interface MetricCardProps {
  label: string
  value: number | bigint | null | undefined
  format: MetricFormat
  tooltip?: string
  isLoading?: boolean
  icon?: LucideIcon
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
