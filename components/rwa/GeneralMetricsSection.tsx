'use client'

import { MetricCard, MetricCardLoading } from './MetricCard'
import { MetricGrid } from './MetricGrid'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DollarSign,
  TrendingUp,
  RefreshCcw,
  PiggyBank,
  Wallet,
  RotateCcw,
  Calendar,
  Timer,
  Gauge,
} from 'lucide-react'
import type { GeneralMetrics } from '@/lib/rwa/types'
import { bigintToNumber } from '@/lib/rwa/utils'

interface GeneralMetricsSectionProps {
  metrics: GeneralMetrics | null
  isLoading?: boolean
}

function formatCurrencyDisplay(value: number | bigint): string {
  const numValue = typeof value === 'bigint' ? bigintToNumber(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue)
}

function KeyMetricCard({
  label,
  value,
  icon: Icon,
  isLoading,
  accentColor,
}: {
  label: string
  value: number | bigint | null | undefined
  icon: React.ComponentType<{ className?: string }>
  isLoading?: boolean
  accentColor: 'indigo-600' | 'indigo-500' | 'indigo-400'
}) {
  const colorClasses = {
    'indigo-600': {
      border: 'border-l-indigo-600',
      icon: 'text-indigo-600 dark:text-indigo-400',
    },
    'indigo-500': {
      border: 'border-l-indigo-500',
      icon: 'text-indigo-500 dark:text-indigo-300',
    },
    'indigo-400': {
      border: 'border-l-indigo-400',
      icon: 'text-indigo-400 dark:text-indigo-300',
    },
  }

  const colors = colorClasses[accentColor]

  if (isLoading) {
    return (
      <Card className={`border-l-4 ${colors.border}`}>
        <CardContent className="p-4 sm:p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`border-l-4 ${colors.border} min-w-0 overflow-hidden`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Icon className={`h-4 w-4 shrink-0 ${colors.icon}`} />
          <span className="truncate">{label}</span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-foreground truncate">
          {value !== null && value !== undefined ? formatCurrencyDisplay(value) : '-'}
        </div>
      </CardContent>
    </Card>
  )
}

const PRIMARY_METRICS = [
  {
    key: 'transactedVolume' as const,
    label: 'Transacted Volume',
    icon: DollarSign,
    accentColor: 'indigo-600' as const,
  },
  {
    key: 'committedCapital' as const,
    label: 'Lender Invested Capital',
    icon: Wallet,
    accentColor: 'indigo-500' as const,
  },
  {
    key: 'assetsFinanced' as const,
    label: 'Assets Financed',
    icon: TrendingUp,
    accentColor: 'indigo-400' as const,
  },
]

const SECONDARY_METRICS = [
  {
    key: 'lenderRepayments' as const,
    label: 'Lender Repayments',
    format: 'currency' as const,
    tooltip: 'Sum of Borrower to Tranche Pool transfers',
    icon: RefreshCcw,
  },
  {
    key: 'idleCapital' as const,
    label: 'Idle Capital',
    format: 'currency' as const,
    tooltip: 'Current USDC balance of Tranche Pool',
    icon: PiggyBank,
  },
  {
    key: 'capitalTurnover' as const,
    label: 'Capital Turnover',
    format: 'ratio' as const,
    tooltip: 'Assets Financed / Lender Invested Capital',
    icon: RotateCcw,
  },
  {
    key: 'lifeSinceInception' as const,
    label: 'Days Active',
    format: 'days' as const,
    tooltip: 'Days since first Tranche to Borrower transaction',
    icon: Calendar,
  },
  {
    key: 'avgCapitalRecycling' as const,
    label: 'Avg Recycling Time',
    format: 'days' as const,
    tooltip: 'Life Since Inception / Capital Turnover',
    icon: Timer,
  },
  {
    key: 'averageCapitalUtilization' as const,
    label: 'Avg Capital Utilization',
    format: 'percentage' as const,
    tooltip: 'Average daily capital utilization rate over facility lifetime',
    icon: Gauge,
  },
]

export function GeneralMetricsSection({
  metrics,
  isLoading = false,
}: GeneralMetricsSectionProps) {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Key Metrics</h2>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {PRIMARY_METRICS.map((config) => (
          <KeyMetricCard
            key={config.key}
            label={config.label}
            value={metrics?.[config.key]}
            icon={config.icon}
            isLoading={isLoading}
            accentColor={config.accentColor}
          />
        ))}
      </div>

      <MetricGrid columns={3}>
        {SECONDARY_METRICS.map((config) =>
          isLoading ? (
            <MetricCardLoading key={config.key} />
          ) : (
            <MetricCard
              key={config.key}
              label={config.label}
              value={metrics?.[config.key]}
              format={config.format}
              tooltip={config.tooltip}
              icon={config.icon}
            />
          )
        )}
      </MetricGrid>
    </section>
  )
}
