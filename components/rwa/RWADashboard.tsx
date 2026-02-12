'use client'

import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMetrics } from '@/lib/rwa/hooks/useMetrics'
import { useHistorical } from '@/lib/rwa/hooks/useHistorical'
import { GeneralMetricsSection } from './GeneralMetricsSection'
import { OatFiSection } from './OatFiSection'
import { CapitalFlowSankey } from './CapitalFlowSankey'
import { TimeSeriesCharts } from './TimeSeriesCharts'
import { DateRangeSelector } from './DateRangeSelector'
import { ExportMenu } from './ExportMenu'
import { PartnerLogos } from './PartnerLogos'
import type { TimeInterval, DateRange } from '@/lib/rwa/types'

const DASHBOARD_ELEMENT_ID = 'rwa-dashboard-content'

export function RWADashboard() {
  const [interval, setInterval] = useState<TimeInterval>('daily')
  const [dateRange, setDateRange] = useState<DateRange | null>(null)

  const { metrics, isLoading: metricsLoading, error: metricsError, refresh: refreshMetrics } = useMetrics()
  const {
    historical,
    isLoading: historicalLoading,
    error: historicalError,
    refresh: refreshHistorical,
  } = useHistorical({ interval, dateRange })

  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshMetrics(), refreshHistorical()])
  }, [refreshMetrics, refreshHistorical])

  const error = metricsError || historicalError

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Valinor / OatFi
            </h1>
            <p className="text-muted-foreground mt-1">
              Real World Assets SPV capital flow dashboard on Avalanche C-Chain
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportMenu
              metrics={metrics}
              historical={historical}
              dashboardElementId={DASHBOARD_ELEMENT_ID}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleRefresh}
              disabled={metricsLoading || historicalLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${metricsLoading || historicalLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {metrics?.lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
          </p>
        )}

        <PartnerLogos />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Failed to load data: {error.message}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleRefresh}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Dashboard content */}
      <div id={DASHBOARD_ELEMENT_ID} className="space-y-8">
        {/* Key Metrics */}
        <GeneralMetricsSection
          metrics={metrics?.general ?? null}
          isLoading={metricsLoading}
        />

        {/* OatFi Breakdown */}
        <OatFiSection
          metrics={metrics?.oatfi ?? null}
          isLoading={metricsLoading}
        />

        {/* Capital Flow */}
        <CapitalFlowSankey
          metrics={metrics?.general ?? null}
          isLoading={metricsLoading}
        />

        {/* Historical Trends Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Historical Trends</h2>
          <DateRangeSelector
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        {/* Historical Charts */}
        <TimeSeriesCharts
          historical={historical}
          interval={interval}
          onIntervalChange={setInterval}
          isLoading={historicalLoading}
          hideHeader
        />
      </div>
    </div>
  )
}
