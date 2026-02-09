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
  accentColor: 'emerald' | 'cyan' | 'orange'
}) {
  const colorClasses = {
    emerald: {
      border: 'border-l-emerald-500',
      icon: 'text-emerald-600 dark:text-emerald-400',
    },
    cyan: {
      border: 'border-l-cyan-500',
      icon: 'text-cyan-600 dark:text-cyan-400',
    },
    orange: {
      border: 'border-l-orange-500',
      icon: 'text-orange-600 dark:text-orange-400',
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
    accentColor: 'cyan' as const,
  },
  {
    key: 'committedCapital' as const,
    label: 'Committed Capital',
    icon: Wallet,
    accentColor: 'emerald' as const,
  },
  {
    key: 'assetsFinanced' as const,
    label: 'Assets Financed',
    icon: TrendingUp,
    accentColor: 'orange' as const,
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
    tooltip: 'Assets Financed / Committed Capital',
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

      <MetricGrid columns={4}>
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
