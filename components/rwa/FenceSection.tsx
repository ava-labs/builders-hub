'use client'

import { useMemo } from 'react'
import { MetricCard, MetricCardLoading } from './MetricCard'
import { MetricGrid } from './MetricGrid'
import { SectionHeader } from './SectionHeader'
import { ConcentrationGauge } from './ConcentrationGauge'
import { CollectionsChart } from './CollectionsChart'
import { DateRangeSelector } from './DateRangeSelector'
import { Banknote, CalendarCheck, Percent, Clock, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { FenceMetrics, FenceHistoricalData, TimeInterval, DateRange, TimeSeriesDataPoint } from '@/lib/rwa/types'

function filterByDateRange(data: TimeSeriesDataPoint[], dateRange: DateRange | null): TimeSeriesDataPoint[] {
  if (!dateRange) return data
  const from = dateRange.from.toISOString().slice(0, 10)
  const to = dateRange.to.toISOString().slice(0, 10)
  return data.filter((p) => p.date >= from && p.date <= to)
}

interface FenceSectionProps {
  metrics: FenceMetrics | null
  historical: FenceHistoricalData | null
  isLoading?: boolean
  error?: string | null
  interval: TimeInterval
  onIntervalChange: (interval: TimeInterval) => void
  dateRange: DateRange | null
  onDateRangeChange: (dateRange: DateRange | null) => void
}

export function FenceSection({
  metrics,
  historical,
  isLoading = false,
  error,
  interval,
  onIntervalChange,
  dateRange,
  onDateRangeChange,
}: FenceSectionProps) {
  const filteredPaid = useMemo(
    () => filterByDateRange(historical?.paidCollections ?? [], dateRange),
    [historical?.paidCollections, dateRange]
  )
  const filteredExpected = useMemo(
    () => filterByDateRange(historical?.expectedCollections ?? [], dateRange),
    [historical?.expectedCollections, dateRange]
  )

  const allNull =
    !isLoading &&
    !metrics?.paidTotalCollections &&
    !metrics?.expectedTotalCollections &&
    !metrics?.cl01Concentration

  if (error && allNull) {
    return (
      <section>
        <SectionHeader title="Facility Performance" badge="Fence" className="mb-4" />
        <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
          Facility metrics temporarily unavailable. Other dashboard sections are unaffected.
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeader title="Facility Performance" badge="Fence" className="mb-4" />

      <MetricGrid columns={4}>
        {isLoading ? (
          <>
            <MetricCardLoading />
            <MetricCardLoading />
            <MetricCardLoading />
            <MetricCardLoading />
          </>
        ) : (
          <>
            <MetricCard
              label="Paid Collections"
              value={metrics?.paidTotalCollections?.value ?? null}
              format="currency"
              tooltip="Cumulative actual payments collected to date"
              icon={Banknote}
            />
            <MetricCard
              label="Expected Collections"
              value={metrics?.expectedTotalCollections?.value ?? null}
              format="currency"
              tooltip="Cumulative expected payments due up to today"
              icon={CalendarCheck}
            />
            <MetricCard
              label="Repayment Ratio"
              value={metrics?.repaymentRatio !== null && metrics?.repaymentRatio !== undefined
                ? metrics.repaymentRatio * 100
                : null}
              format="percentage"
              tooltip="Paid collections / Expected collections"
              icon={Percent}
            />
            <ConcentrationGauge
              cl01={metrics?.cl01Concentration ?? null}
              isLoading={isLoading}
            />
          </>
        )}
      </MetricGrid>

      <div className="bg-muted/30 rounded-xl p-3 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
          <h3 className="text-lg font-semibold">Collections Over Time</h3>
          <div className="flex items-center gap-1.5" data-export-hidden>
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
                      onClick={() => onIntervalChange(v)}
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
              onDateRangeChange={onDateRangeChange}
            />
          </div>
        </div>

        <CollectionsChart
          paidCollections={filteredPaid}
          expectedCollections={filteredExpected}
          interval={interval}
          isLoading={isLoading}
        />
      </div>

      <p className="text-xs text-muted-foreground/60 text-center">
        Data sourced from Fence Finance. Expected Collections available from March 2026.
      </p>
    </section>
  )
}
