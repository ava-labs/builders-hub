'use client'

import { MetricCard, MetricCardLoading } from './MetricCard'
import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  InfoIcon,
} from 'lucide-react'
import type { GeneralMetrics, LenderBreakdown } from '@/lib/rwa/types'
import { bigintToNumber } from '@/lib/rwa/utils'
import { useCountUp } from '@/lib/rwa/hooks/useCountUp'
import { usePalette } from '@/lib/rwa/hooks/usePalette'

interface GeneralMetricsSectionProps {
  metrics: GeneralMetrics | null
  isLoading?: boolean
  error?: string | null
  lenderBreakdown?: LenderBreakdown[] | null
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

function AnimatedCurrencyValue({ value }: { value: number | bigint }) {
  const numValue = typeof value === 'bigint' ? bigintToNumber(value) : value
  const animated = useCountUp(numValue)
  return <>{formatCurrencyDisplay(animated)}</>
}

function useLenderChartColors(): Record<string, string> {
  const { chartColors } = usePalette()
  return {
    Valinor: chartColors.lenderValinor,
    Avalanche: chartColors.lenderAvalanche,
  }
}

interface BreakdownItem {
  label: string
  percentage: number
  color: string
}

function InlineLenderBreakdown({ items }: { items: BreakdownItem[] }) {
  if (items.length === 0) return null
  return (
    <span className="text-xs text-muted-foreground flex flex-wrap items-center justify-center">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && <span className="mx-1">·</span>}
          <span
            className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
            style={{ backgroundColor: item.color }}
          />
          {item.label} {item.percentage.toFixed(0)}%
        </span>
      ))}
    </span>
  )
}

const PRIMARY_METRICS = [
  {
    key: 'transactedVolume' as const,
    label: 'Transacted Volume',
    icon: DollarSign,
    tooltip: 'Total USDC volume across all tracked addresses',
  },
  {
    key: 'committedCapital' as const,
    label: 'Lender Invested Capital',
    icon: Wallet,
    tooltip: 'Total capital deposited by lenders into the tranche pool',
  },
  {
    key: 'assetsFinanced' as const,
    label: 'Assets Financed',
    icon: TrendingUp,
    tooltip: 'Total capital deployed from tranche pool to borrower',
  },
]

function KeyMetricCard({
  label,
  value,
  icon: Icon,
  tooltip,
  isLoading,
  breakdown,
}: {
  label: string
  value: number | bigint | null | undefined
  icon: React.ComponentType<{ className?: string }>
  tooltip: string
  isLoading?: boolean
  breakdown?: BreakdownItem[]
}) {
  if (isLoading) {
    return (
      <Card className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700">
        <Skeleton className="h-4 w-24 mx-auto mb-3" />
        <Skeleton className="h-10 w-32 mx-auto" />
      </Card>
    )
  }

  return (
    <Card
      className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700"
      aria-label={`${label}: ${value !== null && value !== undefined ? formatCurrencyDisplay(value) : '-'}`}
    >
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
        <span style={{ color: 'var(--rwa-accent-600)' }}><Icon className="h-4 w-4 shrink-0" /></span>
        <span>{label}</span>
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
      </div>
      <div className="text-xl sm:text-3xl font-mono font-semibold text-foreground">
        {value !== null && value !== undefined
          ? <AnimatedCurrencyValue value={value} />
          : '-'}
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-2 flex items-center justify-center gap-4">
          <InlineLenderBreakdown items={breakdown} />
        </div>
      )}
    </Card>
  )
}

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
    key: 'averageCapitalUtilization' as const,
    label: 'Avg Capital Utilization',
    format: 'percentage' as const,
    tooltip: 'Average daily capital utilization rate over facility lifetime',
    icon: Gauge,
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
  error,
  lenderBreakdown,
}: GeneralMetricsSectionProps) {
  const lenderColors = useLenderChartColors()

  const breakdownItems: BreakdownItem[] | undefined = lenderBreakdown?.map((entry) => ({
    label: entry.lender,
    percentage: entry.percentage,
    color: lenderColors[entry.lender] ?? '#a5b4fc',
  }))

  if (error && !isLoading) {
    return (
      <section className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3 sm:space-y-6">
      {/* Mobile: vertical stack */}
      <div className="sm:hidden flex flex-col gap-3">
        {PRIMARY_METRICS.map((config) => (
          <KeyMetricCard
            key={config.key}
            label={config.label}
            value={metrics?.[config.key]}
            icon={config.icon}
            tooltip={config.tooltip}
            isLoading={isLoading}
            breakdown={config.key === 'committedCapital' ? breakdownItems : undefined}
          />
        ))}
      </div>

      {/* Desktop: grid */}
      <div className="hidden sm:grid gap-4 grid-cols-3">
        {PRIMARY_METRICS.map((config) => (
          <KeyMetricCard
            key={config.key}
            label={config.label}
            value={metrics?.[config.key]}
            icon={config.icon}
            tooltip={config.tooltip}
            isLoading={isLoading}
            breakdown={config.key === 'committedCapital' ? breakdownItems : undefined}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </section>
  )
}
