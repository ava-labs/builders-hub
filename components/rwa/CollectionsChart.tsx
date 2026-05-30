'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend,
  ReferenceArea,
} from 'recharts'
import {
  BarChart3,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  ZoomOut,
  Columns2,
  Combine,
} from 'lucide-react'
import { useChartZoom } from '@/lib/rwa/hooks/useChartZoom'
import { usePalette } from '@/lib/rwa/hooks/usePalette'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TimeSeriesDataPoint, TimeInterval } from '@/lib/rwa/types'

type ChartType = 'area' | 'bar' | 'line'
type ViewMode = 'periodic' | 'cumulative'

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-background p-2 sm:p-3 shadow-sm max-w-[220px] sm:max-w-none">
      <p className="font-medium mb-1 sm:mb-2 text-xs sm:text-sm truncate">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-xs sm:text-sm truncate"
          style={{ color: entry.color }}
        >
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

function ChartTypeSelector({
  value,
  onChange,
}: {
  value: ChartType
  onChange: (type: ChartType) => void
}) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5" data-export-hidden>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 w-7 p-0', value === 'line' && 'bg-background shadow-sm')}
        onClick={() => onChange('line')}
        title="Line chart"
        aria-label="Line chart"
      >
        <LineChartIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 w-7 p-0', value === 'bar' && 'bg-background shadow-sm')}
        onClick={() => onChange('bar')}
        title="Bar chart"
        aria-label="Bar chart"
      >
        <BarChart3 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 w-7 p-0', value === 'area' && 'bg-background shadow-sm')}
        onClick={() => onChange('area')}
        title="Area chart"
        aria-label="Area chart"
      >
        <AreaChartIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5" data-export-hidden>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2 text-xs', value === 'periodic' && 'bg-background shadow-sm')}
        onClick={() => onChange('periodic')}
        aria-label="Show periodic data"
      >
        Periodic
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2 text-xs', value === 'cumulative' && 'bg-background shadow-sm')}
        onClick={() => onChange('cumulative')}
        aria-label="Show cumulative data"
      >
        Cumulative
      </Button>
    </div>
  )
}

function toPeriodic(series: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
  if (series.length <= 1) return []
  return series.slice(1).map((point, i) => ({
    date: point.date,
    value: Math.max(0, point.value - series[i].value),
  }))
}

function groupByInterval(series: TimeSeriesDataPoint[], interval: TimeInterval): TimeSeriesDataPoint[] {
  if (interval === 'daily' || series.length === 0) return series

  const grouped = new Map<string, TimeSeriesDataPoint>()

  for (const point of series) {
    let key: string
    if (interval === 'weekly') {
      const d = new Date(point.date)
      const day = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((day + 6) % 7))
      key = monday.toISOString().slice(0, 10)
    } else {
      key = point.date.slice(0, 7)
    }
    grouped.set(key, { date: key, value: point.value })
  }

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function SingleCollectionChart({
  title,
  data,
  color,
  isLoading = false,
}: {
  title: string
  data: TimeSeriesDataPoint[]
  color: string
  isLoading?: boolean
}) {
  const [chartType, setChartType] = useState<ChartType>('bar')
  const { zoomState, zoomedData, isZoomed, handleMouseDown, handleMouseMove, handleMouseUp, resetZoom } = useChartZoom(data)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-6"><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0"><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <ChartTypeSelector value={chartType} onChange={setChartType} />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
        </CardContent>
      </Card>
    )
  }

  const chartProps = { data: zoomedData, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp }
  const refArea = zoomState.refAreaLeft && zoomState.refAreaRight && (
    <ReferenceArea x1={zoomState.refAreaLeft} x2={zoomState.refAreaRight} strokeOpacity={0.3} fill={color} fillOpacity={0.3} />
  )

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <ChartTypeSelector value={chartType} onChange={setChartType} />
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 relative">
        {isZoomed && (
          <div className="absolute top-2 right-2 z-10">
            <Button variant="secondary" size="sm" onClick={resetZoom} className="h-7 px-2 text-xs" aria-label="Reset zoom">
              <ZoomOut className="h-3 w-3 mr-1" />Reset Zoom
            </Button>
          </div>
        )}
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'bar' ? (
            <BarChart {...chartProps} syncId="fence-split">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<CustomTooltip />} />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={color} />}
              <Bar dataKey="value" fill={color} name={title} />
              {refArea}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart {...chartProps} syncId="fence-split">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<CustomTooltip />} />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={color} />}
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} name={title} />
              {refArea}
            </LineChart>
          ) : (
            <AreaChart {...chartProps} syncId="fence-split">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<CustomTooltip />} />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={color} />}
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.3} strokeWidth={2} name={title} />
              {refArea}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface CollectionsChartProps {
  paidCollections: TimeSeriesDataPoint[]
  expectedCollections: TimeSeriesDataPoint[]
  interval?: TimeInterval
  isLoading?: boolean
}

export function CollectionsChart({
  paidCollections,
  expectedCollections,
  interval = 'daily',
  isLoading = false,
}: CollectionsChartProps) {
  const [viewMode, setViewMode] = useState<'combined' | 'separated'>('combined')
  const [chartType, setChartType] = useState<ChartType>('line')
  const [dataViewMode, setDataViewMode] = useState<ViewMode>('cumulative')
  const { chartColors } = usePalette()

  const paidColor = chartColors.paidCollections
  const expectedColor = chartColors.expectedCollections

  // Fence data is cumulative daily snapshots.
  // 1. Group by interval (weekly/monthly takes last value per period)
  // 2. For periodic view, compute deltas between periods
  const displayPaid = useMemo(() => {
    const grouped = groupByInterval(paidCollections, interval)
    return dataViewMode === 'periodic' ? toPeriodic(grouped) : grouped
  }, [paidCollections, interval, dataViewMode])

  const displayExpected = useMemo(() => {
    const grouped = groupByInterval(expectedCollections, interval)
    return dataViewMode === 'periodic' ? toPeriodic(grouped) : grouped
  }, [expectedCollections, interval, dataViewMode])

  const combinedData = useMemo(() => {
    const dateMap = new Map<string, { paid: number; expected: number }>()

    for (const item of displayPaid) {
      dateMap.set(item.date, { paid: item.value, expected: 0 })
    }

    for (const item of displayExpected) {
      const existing = dateMap.get(item.date)
      if (existing) {
        dateMap.set(item.date, { ...existing, expected: item.value })
      } else {
        dateMap.set(item.date, { paid: 0, expected: item.value })
      }
    }

    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({ date, ...values }))
  }, [displayPaid, displayExpected])

  const {
    zoomState,
    zoomedData,
    isZoomed,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom,
  } = useChartZoom(combinedData)

  // For split view, align both series to the same dates so syncId works
  const alignedPaid = useMemo(
    () => combinedData.map(d => ({ date: d.date, value: d.paid })),
    [combinedData]
  )
  const alignedExpected = useMemo(
    () => combinedData.map(d => ({ date: d.date, value: d.expected })),
    [combinedData]
  )

  const toggleButton = (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      data-export-hidden
      onClick={() => setViewMode(viewMode === 'combined' ? 'separated' : 'combined')}
      title={viewMode === 'combined' ? 'Split into separate charts' : 'Combine into one chart'}
      aria-label="Toggle combined/separated view"
    >
      {viewMode === 'combined' ? <Columns2 className="h-4 w-4" /> : <Combine className="h-4 w-4" />}
    </Button>
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">Paid vs Expected Collections</CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Skeleton className="h-8 w-24" />
            {toggleButton}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (combinedData.length === 0) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">Paid vs Expected Collections</CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ViewModeToggle value={dataViewMode} onChange={setDataViewMode} />
            <ChartTypeSelector value={chartType} onChange={setChartType} />
            {toggleButton}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <BarChart3 className="h-10 w-10 opacity-40" />
            <div className="text-center">
              <p className="text-sm font-medium">No collections data available yet</p>
              <p className="text-xs mt-1 opacity-70">Data will appear once collection activity is recorded</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (viewMode === 'separated') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Paid vs Expected Collections</h3>
          <div className="flex items-center gap-2">
            <ViewModeToggle value={dataViewMode} onChange={setDataViewMode} />
            {toggleButton}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SingleCollectionChart title="Paid Collections" data={alignedPaid} color={paidColor} />
          <SingleCollectionChart title="Expected Collections" data={alignedExpected} color={expectedColor} />
        </div>
      </div>
    )
  }

  const chartProps = {
    data: zoomedData,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
  }

  const referenceArea = zoomState.refAreaLeft && zoomState.refAreaRight && (
    <ReferenceArea
      x1={zoomState.refAreaLeft}
      x2={zoomState.refAreaRight}
      strokeOpacity={0.3}
      fill={paidColor}
      fillOpacity={0.3}
    />
  )

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle className="text-lg">Paid vs Expected Collections</CardTitle>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ViewModeToggle value={dataViewMode} onChange={setDataViewMode} />
          <ChartTypeSelector value={chartType} onChange={setChartType} />
          {toggleButton}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 relative">
        {isZoomed && (
          <div className="absolute top-2 right-2 z-10">
            <Button variant="secondary" size="sm" onClick={resetZoom} className="h-7 px-2 text-xs" aria-label="Reset zoom">
              <ZoomOut className="h-3 w-3 mr-1" />Reset Zoom
            </Button>
          </div>
        )}
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'bar' ? (
            <BarChart {...chartProps} syncId="fence-collections">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={paidColor} />}
              <Bar dataKey="paid" fill={paidColor} name="Paid Collections" />
              <Bar dataKey="expected" fill={expectedColor} name="Expected Collections" />
              {referenceArea}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart {...chartProps} syncId="fence-collections">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={paidColor} />}
              <Line type="monotone" dataKey="paid" stroke={paidColor} strokeWidth={2} dot={false} name="Paid Collections" />
              <Line type="monotone" dataKey="expected" stroke={expectedColor} strokeWidth={2} dot={false} name="Expected Collections" />
              {referenceArea}
            </LineChart>
          ) : (
            <AreaChart {...chartProps} syncId="fence-collections">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={paidColor} />}
              <Area type="monotone" dataKey="paid" stroke={paidColor} fill={paidColor} fillOpacity={0.3} strokeWidth={2} name="Paid Collections" />
              <Area type="monotone" dataKey="expected" stroke={expectedColor} fill={expectedColor} fillOpacity={0.3} strokeWidth={2} name="Expected Collections" />
              {referenceArea}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
