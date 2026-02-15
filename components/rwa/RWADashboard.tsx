'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, ChevronDown, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { useSectionNavigation } from '@/hooks/use-section-navigation'
import { StickyNavBar } from '@/components/stats/StickyNavBar'
import { useMetrics } from '@/lib/rwa/hooks/useMetrics'
import { useHistorical } from '@/lib/rwa/hooks/useHistorical'
import { GeneralMetricsSection } from './GeneralMetricsSection'
import { OatFiSection } from './OatFiSection'
import { CapitalFlowSankey } from './CapitalFlowSankey'
import { TimeSeriesCharts } from './TimeSeriesCharts'
import { DateRangeSelector } from './DateRangeSelector'
import { ExportMenu } from './ExportMenu'
import { PalettePicker } from './PalettePicker'
import { PartnerLogos } from './PartnerLogos'
import { TransactionTable } from './TransactionTable'
import { PaletteContext, usePaletteProvider } from '@/lib/rwa/hooks/usePalette'
import type { TimeInterval, DateRange } from '@/lib/rwa/types'

const DASHBOARD_ELEMENT_ID = 'rwa-dashboard-content'

const SECTIONS = [
  { id: 'rwa-metrics', label: 'Metrics' },
  { id: 'rwa-oatfi', label: 'OatFi' },
  { id: 'rwa-capital-flow', label: 'Capital Flow' },
  { id: 'rwa-historical', label: 'Historical' },
  { id: 'rwa-transactions', label: 'Transactions' },
] as const

function MobileCollapsible({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors md:hidden [&[data-state=open]>svg]:rotate-180">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent className="md:!block md:!h-auto md:!overflow-visible">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function RWADashboard() {
  const paletteCtx = usePaletteProvider()
  const [interval, setInterval] = useState<TimeInterval>('daily')
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const { activeSection, scrollToSection } = useSectionNavigation({
    categories: [...SECTIONS],
    offset: 135,
    initialSection: 'rwa-metrics',
    updateHash: false,
  })

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
    <PaletteContext.Provider value={paletteCtx}>
    <div className="space-y-8" style={paletteCtx.cssVars}>
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Real World Assets
          </h1>
          <p className="text-muted-foreground mt-1">
            SPV capital flow dashboard on Avalanche C-Chain
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <PartnerLogos />
          {/* Live refresh indicator */}
          {metrics?.lastUpdated && (
            <p className="text-xs text-muted-foreground flex items-center gap-2 shrink-0" aria-live="polite">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
              <span className="text-muted-foreground/60">· 5 min</span>
            </p>
          )}
        </div>
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

      {/* Section navigation */}
      <StickyNavBar
        categories={[...SECTIONS]}
        activeSection={activeSection}
        onNavigate={scrollToSection}
        className="hidden md:block"
      >
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Change trend period"
              >
                <span className="text-[10px] font-semibold">{paletteCtx.trendPeriod}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Trend period
              </p>
              <div className="flex gap-2">
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => paletteCtx.setTrendPeriod(p)}
                    className="relative h-7 w-7 rounded-md text-[10px] font-medium border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={p}
                  >
                    {p}
                    {paletteCtx.trendPeriod === p && (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="absolute inset-0 rounded-md ring-2 ring-primary" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <PalettePicker />
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
      </StickyNavBar>

      {/* Dashboard content */}
      <div
        id={DASHBOARD_ELEMENT_ID}
        className="space-y-8"
        aria-busy={metricsLoading || historicalLoading}
      >
        {/* Key Metrics */}
        <section id="rwa-metrics">
          <MobileCollapsible title="Key Metrics" defaultOpen>
            <GeneralMetricsSection
              metrics={metrics?.general ?? null}
              isLoading={metricsLoading}
              error={metricsError?.message}
              trends={metrics?.trends}
              lenderBreakdown={metrics?.lenderBreakdown}
            />
          </MobileCollapsible>
        </section>

        <Separator />

        {/* OatFi Breakdown */}
        <section id="rwa-oatfi">
          <MobileCollapsible title="OatFi Breakdown" defaultOpen>
            <OatFiSection
              metrics={metrics?.oatfi ?? null}
              isLoading={metricsLoading}
              error={metricsError?.message}
            />
          </MobileCollapsible>
        </section>

        <Separator />

        {/* Capital Flow */}
        <section id="rwa-capital-flow">
          <MobileCollapsible title="Capital Flow" defaultOpen>
            <CapitalFlowSankey
              metrics={metrics?.general ?? null}
              isLoading={metricsLoading}
            />
          </MobileCollapsible>
        </section>

        <Separator />

        {/* Historical Trends - wrapped in muted background */}
        <section id="rwa-historical">
          <MobileCollapsible title="Historical Trends" defaultOpen>
            <div className="bg-muted/30 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-semibold">Historical Trends</h2>
                <div className="flex items-center gap-1.5" data-export-hidden>
                  {/* Interval dropdown */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2">
                        <Clock className="h-3 w-3 opacity-60" />
                        {interval === 'daily' ? 'Daily' : interval === 'weekly' ? 'Weekly' : 'Monthly'}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="end">
                      <div className="flex flex-col">
                        {(['daily', 'weekly', 'monthly'] as const).map((v) => (
                          <button
                            key={v}
                            onClick={() => setInterval(v)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-sm text-left transition-colors ${
                              interval === v
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            {v === 'daily' ? 'Daily' : v === 'weekly' ? 'Weekly' : 'Monthly'}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <DateRangeSelector
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                  />
                </div>
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
          </MobileCollapsible>
        </section>

        <Separator />

        {/* Transactions — last section, compact */}
        <section id="rwa-transactions">
          <MobileCollapsible title="Transactions" defaultOpen>
            <TransactionTable />
          </MobileCollapsible>
        </section>
      </div>
    </div>
    </PaletteContext.Provider>
  )
}
