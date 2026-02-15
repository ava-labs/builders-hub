'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import type { GeneralMetrics } from '@/lib/rwa/types'
import { bigintToNumber, formatCurrency } from '@/lib/rwa/utils'
import { usePalette } from '@/lib/rwa/hooks/usePalette'

const FLOW_LABELS = {
  lenders: { name: 'Lenders', subtitle: 'Capital source' },
  tranchePool: { name: 'Tranche Pool', subtitle: 'SPV vehicle' },
  borrower: { name: 'Borrower', subtitle: 'Asset originator' },
  pool: { name: 'Pool', subtitle: 'Redistribution' },
  borrowerReturn: { name: 'Borrower', subtitle: 'Repayments' },
  invested: 'Invested',
  deployed: 'Deployed',
  repaid: 'Repaid',
} as const

interface CapitalFlowSankeyProps {
  metrics: GeneralMetrics | null
  isLoading?: boolean
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function AmountWithTooltip({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{formatCurrency(value)}</span>
      </TooltipTrigger>
      <TooltipContent>{formatFullCurrency(value)}</TooltipContent>
    </Tooltip>
  )
}

function EntityNode({
  name,
  subtitle,
  accentColor,
}: {
  name: string
  subtitle: string
  accentColor: string
}) {
  return (
    <div
      className="rounded-lg border px-4 py-3 text-center min-w-[100px] transition-all duration-200 hover:scale-[1.03] hover:shadow-sm"
      style={{
        backgroundColor: `${accentColor}1a`,
        borderColor: `${accentColor}33`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = `${accentColor}30`
        e.currentTarget.style.borderColor = `${accentColor}55`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = `${accentColor}1a`
        e.currentTarget.style.borderColor = `${accentColor}33`
      }}
    >
      <div className="text-sm font-semibold">{name}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </div>
  )
}

function FlowConnector({
  value,
  label,
}: {
  value: number
  label: string
}) {
  return (
    <div
      className="group/flow flex-1 flex flex-col items-center gap-1 min-w-[80px]"
    >
      <AmountWithTooltip
        value={value}
        className="text-sm font-semibold cursor-default"
      />
      <div className="w-full flex items-center">
        <div
          className="flex-1 h-[2px] motion-safe:animate-[flow_1.5s_linear_infinite] transition-opacity duration-200 opacity-30 group-hover/flow:opacity-70"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, currentColor 0px, currentColor 6px, transparent 6px, transparent 12px)',
            backgroundSize: '24px 2px',
            color: 'var(--muted-foreground)',
          }}
        />
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className="text-muted-foreground/50 flex-shrink-0 transition-opacity duration-200 group-hover/flow:text-muted-foreground"
        >
          <path d="M0 6 L8 6 M5 3 L8 6 L5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function VerticalFlowConnector({
  value,
  label,
}: {
  value: number
  label: string
}) {
  return (
    <div className="group/vflow flex flex-col items-center gap-1 py-2">
      <AmountWithTooltip
        value={value}
        className="text-sm font-semibold cursor-default"
      />
      <div className="h-6 flex flex-col items-center">
        <div
          className="flex-1 w-[2px] motion-safe:animate-[flowVertical_1.5s_linear_infinite] transition-opacity duration-200 opacity-30 group-hover/vflow:opacity-70"
          style={{
            backgroundImage: 'repeating-linear-gradient(180deg, currentColor 0px, currentColor 6px, transparent 6px, transparent 12px)',
            backgroundSize: '2px 24px',
            color: 'var(--muted-foreground)',
          }}
        />
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className="text-muted-foreground/50 flex-shrink-0 transition-opacity duration-200 group-hover/vflow:text-muted-foreground"
        >
          <path d="M6 0 L6 8 M3 5 L6 8 L9 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

export function CapitalFlowSankey({ metrics, isLoading = false }: CapitalFlowSankeyProps) {
  const { palette } = usePalette()
  const flowData = useMemo(() => {
    if (!metrics) return null

    const committed = bigintToNumber(metrics.committedCapital)
    const idle = bigintToNumber(metrics.idleCapital)
    const financed = bigintToNumber(metrics.assetsFinanced)
    const repayments = bigintToNumber(metrics.lenderRepayments)
    const utilization =
      committed > 0 ? ((1 - idle / committed) * 100) : 0

    return { committed, idle, financed, repayments, utilization }
  }, [metrics])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!flowData) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Capital Flow Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Forward Flow — Desktop (horizontal) */}
        <div className="hidden md:block space-y-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Forward Flow
          </div>

          {/* Lenders → Tranche Pool → Borrower */}
          <div className="flex items-center gap-3">
            <EntityNode
              name={FLOW_LABELS.lenders.name}
              subtitle={FLOW_LABELS.lenders.subtitle}
              accentColor={palette.shades[500]}
            />
            <FlowConnector value={flowData.committed} label={FLOW_LABELS.invested} />
            <EntityNode
              name={FLOW_LABELS.tranchePool.name}
              subtitle={FLOW_LABELS.tranchePool.subtitle}
              accentColor={palette.shades[400]}
            />
            <FlowConnector value={flowData.financed} label={FLOW_LABELS.deployed} />
            <EntityNode
              name={FLOW_LABELS.borrower.name}
              subtitle={FLOW_LABELS.borrower.subtitle}
              accentColor={palette.shades[600]}
            />
          </div>

          {/* Return Flow */}
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">
            Return Flow
          </div>

          <div className="flex items-center gap-3">
            <EntityNode
              name={FLOW_LABELS.borrowerReturn.name}
              subtitle={FLOW_LABELS.borrowerReturn.subtitle}
              accentColor={palette.shades[600]}
            />
            <FlowConnector value={flowData.repayments} label={FLOW_LABELS.repaid} />
            <EntityNode
              name={FLOW_LABELS.pool.name}
              subtitle={FLOW_LABELS.pool.subtitle}
              accentColor={palette.shades[400]}
            />
          </div>
        </div>

        {/* Forward Flow — Mobile (vertical) */}
        <div className="md:hidden space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Forward Flow
          </div>

          <div className="flex flex-col items-center">
            <EntityNode
              name={FLOW_LABELS.lenders.name}
              subtitle={FLOW_LABELS.lenders.subtitle}
              accentColor={palette.shades[500]}
            />
            <VerticalFlowConnector value={flowData.committed} label={FLOW_LABELS.invested} />
            <EntityNode
              name={FLOW_LABELS.tranchePool.name}
              subtitle={FLOW_LABELS.tranchePool.subtitle}
              accentColor={palette.shades[400]}
            />
            <VerticalFlowConnector value={flowData.financed} label={FLOW_LABELS.deployed} />
            <EntityNode
              name={FLOW_LABELS.borrower.name}
              subtitle={FLOW_LABELS.borrower.subtitle}
              accentColor={palette.shades[600]}
            />
          </div>

          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">
            Return Flow
          </div>

          <div className="flex flex-col items-center">
            <EntityNode
              name={FLOW_LABELS.borrowerReturn.name}
              subtitle={FLOW_LABELS.borrowerReturn.subtitle}
              accentColor={palette.shades[600]}
            />
            <VerticalFlowConnector value={flowData.repayments} label={FLOW_LABELS.repaid} />
            <EntityNode
              name={FLOW_LABELS.pool.name}
              subtitle={FLOW_LABELS.pool.subtitle}
              accentColor={palette.shades[400]}
            />
          </div>
        </div>

        {/* Pool Status */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pool Status</span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">
                Idle:{' '}
                <AmountWithTooltip
                  value={flowData.idle}
                  className="font-medium text-foreground cursor-default"
                />
              </span>
              <span className="text-xs text-muted-foreground">
                Utilization:{' '}
                <span className="font-medium text-foreground">
                  {flowData.utilization.toFixed(1)}%
                </span>
              </span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(flowData.utilization, 100)}%`,
                background: `linear-gradient(to right, ${palette.shades[400]}, ${palette.shades[600]})`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
