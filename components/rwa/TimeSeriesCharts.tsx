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
import { toCumulative } from '@/lib/rwa/calculations/aggregations'
import { RWA_COLORS } from '@/lib/rwa/constants/colors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { HistoricalData, TimeInterval } from '@/lib/rwa/types'

type ChartType = 'area' | 'bar' | 'line'
type ViewMode = 'periodic' | 'cumulative'

interface TimeSeriesChartsProps {
  historical: HistoricalData | null
  interval: TimeInterval
  onIntervalChange: (interval: TimeInterval) => void
  isLoading?: boolean
  hideHeader?: boolean
}

const COLORS = RWA_COLORS.chart

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

function CustomTooltip({
  active,
  payload,
  label,
  isCurrency = true,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  isCurrency?: boolean
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-background p-2 sm:p-3 shadow-sm max-w-[200px] sm:max-w-none">
      <p className="font-medium mb-1 sm:mb-2 text-xs sm:text-sm truncate">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-xs sm:text-sm truncate"
          style={{ color: entry.color }}
        >
          <span className="hidden sm:inline">{entry.name}: </span>
          {isCurrency ? formatCurrency(entry.value) : formatPercentage(entry.value)}
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
    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 w-7 p-0',
          value === 'line' && 'bg-background shadow-sm'
        )}
        onClick={() => onChange('line')}
        title="Line chart"
      >
        <LineChartIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 w-7 p-0',
          value === 'bar' && 'bg-background shadow-sm'
        )}
        onClick={() => onChange('bar')}
        title="Bar chart"
      >
        <BarChart3 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 w-7 p-0',
          value === 'area' && 'bg-background shadow-sm'
        )}
        onClick={() => onChange('area')}
        title="Area chart"
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
    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 px-2 text-xs',
          value === 'periodic' && 'bg-background shadow-sm'
        )}
        onClick={() => onChange('periodic')}
      >
        Periodic
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 px-2 text-xs',
          value === 'cumulative' && 'bg-background shadow-sm'
        )}
        onClick={() => onChange('cumulative')}
      >
        Cumulative
      </Button>
    </div>
  )
}

function ChartControls({
  isZoomed,
  onResetZoom,
}: {
  isZoomed: boolean
  onResetZoom: () => void
}) {
  if (!isZoomed) return null

  return (
    <div className="absolute top-2 right-2 z-10">
      <Button
        variant="secondary"
        size="sm"
        onClick={onResetZoom}
        className="h-7 px-2 text-xs"
      >
        <ZoomOut className="h-3 w-3 mr-1" />
        Reset Zoom
      </Button>
    </div>
  )
}

interface SingleChartProps {
  title: string
  data: Array<{ date: string; value: number }>
  color: string
  defaultType?: ChartType
  isLoading?: boolean
  formatFn?: (value: number) => string
  showViewModeToggle?: boolean
}

function SingleChart({
  title,
  data,
  color,
  defaultType = 'bar',
  isLoading = false,
  formatFn = formatCurrency,
  showViewModeToggle = false,
}: SingleChartProps) {
  const [chartType, setChartType] = useState<ChartType>(defaultType)
  const [viewMode, setViewMode] = useState<ViewMode>('periodic')

  const displayData = useMemo(() => {
    if (viewMode === 'cumulative' && showViewModeToggle) {
      return toCumulative(data)
    }
    return data
  }, [data, viewMode, showViewModeToggle])

  const {
    zoomState,
    zoomedData,
    isZoomed,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom,
  } = useChartZoom(displayData)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <ChartTypeSelector value={chartType} onChange={setChartType} />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available for this metric
          </div>
        </CardContent>
      </Card>
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
      fill={color}
      fillOpacity={0.3}
    />
  )

  const isCurrency = formatFn === formatCurrency

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showViewModeToggle && (
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          )}
          <ChartTypeSelector value={chartType} onChange={setChartType} />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <ChartControls isZoomed={isZoomed} onResetZoom={resetZoom} />
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'area' ? (
            <AreaChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatFn} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isCurrency={isCurrency} />} />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={color} />}
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.3}
                name={title}
              />
              {referenceArea}
            </AreaChart>
          ) : chartType === 'bar' ? (
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatFn} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isCurrency={isCurrency} />} />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={color} />}
              <Bar dataKey="value" fill={color} name={title} />
              {referenceArea}
            </BarChart>
          ) : (
            <LineChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatFn} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isCurrency={isCurrency} />} />
              {!isZoomed && <Brush dataKey="date" height={30} stroke={color} />}
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                name={title}
              />
              {referenceArea}
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function StackedComparisonChart({
  assetsFinanced,
  lenderRepayments,
  isLoading = false,
}: {
  assetsFinanced: Array<{ date: string; value: number }>
  lenderRepayments: Array<{ date: string; value: number }>
  isLoading?: boolean
}) {
  const [viewMode, setViewMode] = useState<'combined' | 'separated'>('combined')
  const [combinedChartType, setCombinedChartType] = useState<ChartType>('bar')
  const [dataViewMode, setDataViewMode] = useState<ViewMode>('periodic')

  const displayAssetsFinanced = useMemo(
    () => dataViewMode === 'cumulative' ? toCumulative(assetsFinanced) : assetsFinanced,
    [assetsFinanced, dataViewMode]
  )

  const displayLenderRepayments = useMemo(
    () => dataViewMode === 'cumulative' ? toCumulative(lenderRepayments) : lenderRepayments,
    [lenderRepayments, dataViewMode]
  )

  const combinedData = useMemo(() => {
    const dateMap = new Map<string, { assetsFinanced: number; lenderRepayments: number }>()

    displayAssetsFinanced?.forEach((item) => {
      dateMap.set(item.date, {
        assetsFinanced: item.value,
        lenderRepayments: 0,
      })
    })

    displayLenderRepayments?.forEach((item) => {
      const existing = dateMap.get(item.date)
      if (existing) {
        dateMap.set(item.date, { ...existing, lenderRepayments: item.value })
      } else {
        dateMap.set(item.date, {
          assetsFinanced: 0,
          lenderRepayments: item.value,
        })
      }
    })

    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({ date, ...values }))
  }, [displayAssetsFinanced, displayLenderRepayments])

  const toggleButton = (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={() => setViewMode(viewMode === 'combined' ? 'separated' : 'combined')}
      title={viewMode === 'combined' ? 'Split into separate charts' : 'Combine into one chart'}
    >
      {viewMode === 'combined' ? (
        <Columns2 className="h-4 w-4" />
      ) : (
        <Combine className="h-4 w-4" />
      )}
    </Button>
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">Assets Financed vs Repayments</CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Skeleton className="h-8 w-24" />
            {toggleButton}
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (combinedData.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">Assets Financed vs Repayments</CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ViewModeToggle value={dataViewMode} onChange={setDataViewMode} />
            <ChartTypeSelector value={combinedChartType} onChange={setCombinedChartType} />
            {toggleButton}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No financing or repayment data available
          </div>
        </CardContent>
      </Card>
    )
  }

  if (viewMode === 'separated') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Assets Financed vs Repayments</h3>
          <div className="flex items-center gap-2">
            <ViewModeToggle value={dataViewMode} onChange={setDataViewMode} />
            {toggleButton}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SingleChart
            title="Assets Financed"
            data={displayAssetsFinanced}
            color={COLORS.assetsFinanced}
            defaultType="bar"
          />
          <SingleChart
            title="Lender Repayments"
            data={displayLenderRepayments}
            color={COLORS.lenderRepayments}
            defaultType="bar"
          />
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <CardTitle className="text-lg">Assets Financed vs Repayments</CardTitle>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ViewModeToggle value={dataViewMode} onChange={setDataViewMode} />
          <ChartTypeSelector value={combinedChartType} onChange={setCombinedChartType} />
          {toggleButton}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {combinedChartType === 'bar' ? (
            <BarChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isCurrency={true} />} />
              <Legend />
              <Brush dataKey="date" height={30} stroke="#6366f1" />
              <Bar
                dataKey="assetsFinanced"
                fill={COLORS.assetsFinanced}
                name="Assets Financed"
              />
              <Bar
                dataKey="lenderRepayments"
                fill={COLORS.lenderRepayments}
                name="Lender Repayments"
              />
            </BarChart>
          ) : combinedChartType === 'line' ? (
            <LineChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isCurrency={true} />} />
              <Legend />
              <Brush dataKey="date" height={30} stroke="#6366f1" />
              <Line
                type="monotone"
                dataKey="assetsFinanced"
                stroke={COLORS.assetsFinanced}
                strokeWidth={2}
                dot={false}
                name="Assets Financed"
              />
              <Line
                type="monotone"
                dataKey="lenderRepayments"
                stroke={COLORS.lenderRepayments}
                strokeWidth={2}
                dot={false}
                name="Lender Repayments"
              />
            </LineChart>
          ) : (
            <AreaChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isCurrency={true} />} />
              <Legend />
              <Brush dataKey="date" height={30} stroke="#6366f1" />
              <Area
                type="monotone"
                dataKey="assetsFinanced"
                stroke={COLORS.assetsFinanced}
                fill={COLORS.assetsFinanced}
                fillOpacity={0.3}
                strokeWidth={2}
                name="Assets Financed"
              />
              <Area
                type="monotone"
                dataKey="lenderRepayments"
                stroke={COLORS.lenderRepayments}
                fill={COLORS.lenderRepayments}
                fillOpacity={0.3}
                strokeWidth={2}
                name="Lender Repayments"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TimeSeriesCharts({
  historical,
  interval,
  onIntervalChange,
  isLoading = false,
  hideHeader = false,
}: TimeSeriesChartsProps) {
  const handleIntervalChange = (value: string) => {
    onIntervalChange(value as TimeInterval)
  }

  if (isLoading) {
    return (
      <section className="space-y-6">
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-48" />
          </div>
        )}
        {hideHeader && (
          <div className="flex justify-end">
            <Skeleton className="h-9 w-48" />
          </div>
        )}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Historical Trends</h2>
          <Tabs value={interval} onValueChange={handleIntervalChange}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      {hideHeader && (
        <div className="flex justify-end">
          <Tabs value={interval} onValueChange={handleIntervalChange}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <SingleChart
          title="Transaction Volume Over Time"
          data={historical?.transactedVolume ?? []}
          color={COLORS.transactedVolume}
          defaultType="bar"
          isLoading={isLoading}
          showViewModeToggle
        />

        <SingleChart
          title="Capital Utilization"
          data={historical?.capitalUtilization ?? []}
          color={COLORS.capitalUtilization}
          defaultType="line"
          isLoading={isLoading}
          formatFn={formatPercentage}
        />

        <div className="lg:col-span-2">
          <StackedComparisonChart
            assetsFinanced={historical?.assetsFinanced ?? []}
            lenderRepayments={historical?.lenderRepayments ?? []}
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  )
}
