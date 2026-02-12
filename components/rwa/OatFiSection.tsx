'use client'

import { MetricCard, MetricCardLoading } from './MetricCard'
import { MetricGrid } from './MetricGrid'
import { Landmark, ArrowLeftRight, Coins } from 'lucide-react'
import type { OatFiMetrics } from '@/lib/rwa/types'

interface OatFiSectionProps {
  metrics: OatFiMetrics | null
  isLoading?: boolean
  error?: string | null
}

const METRIC_CONFIG = [
  {
    key: 'capitalOutstanding' as const,
    label: 'Capital Outstanding',
    format: 'currency' as const,
    tooltip: 'Lender Invested Capital - Idle Capital',
    icon: Landmark,
  },
  {
    key: 'principalRepayments' as const,
    label: 'Principal Repayments',
    format: 'currency' as const,
    tooltip: 'Borrower to Tranche Pool repayments',
    icon: ArrowLeftRight,
  },
  {
    key: 'convertedUsdc' as const,
    label: 'Converted USDC',
    format: 'currency' as const,
    tooltip: 'Borrower outbound not to Tranche Pool',
    icon: Coins,
  },
]

export function OatFiSection({
  metrics,
  isLoading = false,
  error,
}: OatFiSectionProps) {
  if (error && !isLoading) {
    return (
      <section>
        <h2 className="text-lg font-medium text-muted-foreground mb-4">OatFi Breakdown</h2>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-lg font-medium text-muted-foreground mb-4">OatFi Breakdown</h2>
      <MetricGrid columns={3}>
        {METRIC_CONFIG.map((config) =>
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
