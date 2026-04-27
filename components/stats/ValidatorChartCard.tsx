"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Camera, Download } from "lucide-react";
import { ChartWatermark } from "@/components/stats/ChartWatermark";
import {
  calculateDateRangeDays,
  formatXAxisLabel,
  generateXAxisTicks,
} from "@/components/stats/chart-axis-utils";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import { TimeSeriesMetric, TimeSeriesDataPoint, ChartDataPoint } from "@/types/stats";

export function timeSeriesToChartData(
  metric: TimeSeriesMetric | null | undefined,
): ChartDataPoint[] {
  if (!metric?.data) return [];
  const today = new Date().toISOString().split("T")[0];
  return metric.data
    .filter((point) => point.date !== today)
    .map((point: TimeSeriesDataPoint) => ({
      day: point.date,
      value:
        typeof point.value === "string"
          ? parseFloat(point.value)
          : point.value,
    }))
    .reverse();
}

export interface ValidatorChartCardProps {
  config: {
    title: string;
    description: string;
    metricKey: string;
    color: string;
    chartType: "bar" | "area";
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  };
  rawData: ChartDataPoint[];
  period: "D" | "W" | "M" | "Q" | "Y";
  currentValue: number | string;
  onPeriodChange: (period: "D" | "W" | "M" | "Q" | "Y") => void;
  formatTooltipValue: (value: number) => string;
  formatYAxisValue: (value: number) => string;
  overlayData?: ChartDataPoint[];
  overlayLabel?: string;
  overlayColor?: string;
  /** ISO date — overlay points before this date are dropped, so the line only
   * starts drawing from the given day onward (e.g. an upgrade marker). */
  overlayStartDate?: string;
  referenceLineDate?: string;
  referenceLineLabel?: string;
  descriptionNote?: string;
  /** When true, the bar series is rendered as a line instead. Used by the
   * ecosystem view where the headline metric is the overlay line, not the
   * bars. */
  primaryAsLine?: boolean;
  /** Label used for the bar/line series in tooltip + legend. Defaults to
   * "Primary Network". */
  primarySeriesLabel?: string;
}

export function ValidatorChartCard({
  config,
  rawData,
  period,
  currentValue,
  onPeriodChange,
  formatTooltipValue,
  formatYAxisValue,
  overlayData,
  overlayLabel,
  overlayColor,
  overlayStartDate,
  referenceLineDate,
  referenceLineLabel,
  descriptionNote,
  primaryAsLine = false,
  primarySeriesLabel = "Primary Network",
}: ValidatorChartCardProps) {
  const filteredOverlayData = useMemo(() => {
    if (!overlayData) return undefined;
    if (!overlayStartDate) return overlayData;
    return overlayData.filter((p) => p.day >= overlayStartDate);
  }, [overlayData, overlayStartDate]);
  const hasOverlay = Array.isArray(filteredOverlayData) && filteredOverlayData.length > 0;
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;
    try {
      const element = chartContainerRef.current;
      const bgColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${config.title.replace(/\s+/g, "_")}_${period}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  const aggregatedData = useMemo(() => {
    if (period === "D") return rawData;
    const grouped = new Map<string, { sum: number; count: number; date: string }>();
    rawData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;
      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }
      if (!grouped.has(key)) grouped.set(key, { sum: 0, count: 0, date: key });
      const group = grouped.get(key)!;
      group.sum += point.value;
      group.count += 1;
    });
    return Array.from(grouped.values())
      .map((group) => ({ day: group.date, value: group.sum / group.count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [rawData, period]);

  const aggregatedOverlay = useMemo(() => {
    if (!hasOverlay) return null;
    if (period === "D") return filteredOverlayData!;
    const grouped = new Map<string, { sum: number; count: number; date: string }>();
    filteredOverlayData!.forEach((point) => {
      const date = new Date(point.day);
      let key: string;
      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }
      if (!grouped.has(key)) grouped.set(key, { sum: 0, count: 0, date: key });
      const group = grouped.get(key)!;
      group.sum += point.value;
      group.count += 1;
    });
    return Array.from(grouped.values())
      .map((group) => ({ day: group.date, value: group.sum / group.count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [filteredOverlayData, period, hasOverlay]);

  const mergedAggregated = useMemo(() => {
    if (!hasOverlay || !aggregatedOverlay) return aggregatedData;
    const overlayMap = new Map(aggregatedOverlay.map((p) => [p.day, p.value]));
    return aggregatedData.map((point) => ({
      ...point,
      overlayValue: overlayMap.get(point.day) ?? null,
    }));
  }, [aggregatedData, aggregatedOverlay, hasOverlay]);

  const referenceLineBucket = useMemo(() => {
    if (!referenceLineDate) return null;
    const date = new Date(referenceLineDate);
    if (period === "D") return referenceLineDate;
    if (period === "W") {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split("T")[0];
    }
    if (period === "M") {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    if (period === "Q") {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${q}`;
    }
    return String(date.getFullYear());
  }, [referenceLineDate, period]);

  useEffect(() => {
    if (aggregatedData.length === 0) return;
    if (period === "D") {
      const daysToShow = 90;
      let startIndex = Math.max(0, aggregatedData.length - daysToShow);
      // When a reference date (e.g. ACP-77) is outside the default 90-day
      // window, widen the initial view so the annotation is visible without
      // the user having to zoom out manually.
      if (referenceLineBucket) {
        const refIdx = aggregatedData.findIndex((p) => p.day === referenceLineBucket);
        if (refIdx >= 0 && refIdx < startIndex) {
          startIndex = Math.max(0, refIdx - 30);
        }
      }
      setBrushIndexes({ startIndex, endIndex: aggregatedData.length - 1 });
    } else {
      setBrushIndexes({ startIndex: 0, endIndex: aggregatedData.length - 1 });
    }
  }, [period, aggregatedData.length, referenceLineBucket]);

  const displayData = brushIndexes
    ? mergedAggregated.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1)
    : mergedAggregated;

  const isReferenceInRange = useMemo(() => {
    if (!referenceLineBucket || displayData.length === 0) return false;
    const first = displayData[0].day;
    const last = displayData[displayData.length - 1].day;
    return referenceLineBucket >= first && referenceLineBucket <= last;
  }, [referenceLineBucket, displayData]);

  const brushRangeDays = useMemo(
    () => calculateDateRangeDays(displayData as any, "day"),
    [displayData],
  );
  const totalDataDays = useMemo(
    () => calculateDateRangeDays(aggregatedData as any, "day"),
    [aggregatedData],
  );

  const formatXAxis = (value: string) => formatXAxisLabel(value, brushRangeDays);
  const formatBrushXAxis = (value: string) => formatXAxisLabel(value, totalDataDays);

  const xAxisTicks = useMemo(
    () => generateXAxisTicks(displayData as any, brushRangeDays, "day"),
    [displayData, brushRangeDays],
  );

  const dynamicChange = useMemo(() => {
    if (!displayData || displayData.length < 2) return { change: 0, isPositive: true };
    const firstValue = displayData[0].value;
    const lastValue = displayData[displayData.length - 1].value;
    if (lastValue === 0) return { change: 0, isPositive: true };
    const changePercentage = ((lastValue - firstValue) / firstValue) * 100;
    return {
      change: Math.abs(changePercentage),
      isPositive: changePercentage >= 0,
    };
  }, [displayData]);

  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;
    const headers = ["Date", config.title];
    const rows = displayData.map((point: any) => [point.day, point.value].join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.title.replace(/\s+/g, "_")}_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTooltipDate = (value: string) => {
    if (period === "Y") return value;
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
      return value;
    }
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (period === "W") {
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);
      const startMonth = date.toLocaleDateString("en-US", { month: "long" });
      const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
      const startDay = date.getDate();
      const endDay = endDate.getDate();
      const year = endDate.getFullYear();
      if (startMonth === endMonth) return `${startMonth} ${startDay}-${endDay}, ${year}`;
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const Icon = config.icon;

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700" ref={chartContainerRef}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">{config.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                {config.description}
              </p>
              {descriptionNote && isReferenceInRange && (
                <p className="mt-1 text-xs text-muted-foreground/80 italic hidden sm:block max-w-2xl">
                  {descriptionNote}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) => onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")}
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "D" ? "Daily" : p === "W" ? "Weekly" : p === "M" ? "Monthly" : p === "Q" ? "Quarterly" : "Yearly"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleScreenshot}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4">
            <div className="text-md sm:text-xl font-mono break-all">
              {formatTooltipValue(
                typeof currentValue === "string" ? parseFloat(currentValue) : currentValue,
              )}
            </div>
            {dynamicChange.change > 0 && (
              <div
                className={`flex items-center gap-1 text-xs sm:text-sm ${
                  dynamicChange.isPositive ? "text-green-600" : "text-red-600"
                }`}
                title="Change over selected time range"
              >
                <TrendingUp
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    dynamicChange.isPositive ? "" : "rotate-180"
                  }`}
                />
                {dynamicChange.change.toFixed(1)}%
              </div>
            )}
          </div>

          {hasOverlay && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 pl-2 sm:pl-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    primaryAsLine ? "inline-block h-0.5 w-3" : "inline-block h-2.5 w-2.5 rounded-sm"
                  }
                  style={{ backgroundColor: config.color }}
                />
                <span>{primarySeriesLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-3"
                  style={{ backgroundColor: overlayColor ?? "#3B82F6" }}
                />
                <span>{overlayLabel ?? "Total Validator Seats"}</span>
              </div>
            </div>
          )}

          <ChartWatermark className="mb-6">
            <ResponsiveContainer width="100%" height={350}>
              {config.chartType === "bar" ? (
                <ComposedChart data={displayData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatXAxis}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    ticks={xAxisTicks}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${config.color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const barPoint =
                        payload.find((p: any) => p.dataKey === "value") ?? payload[0];
                      const overlayPoint = payload.find(
                        (p: any) => p.dataKey === "overlayValue",
                      );
                      const formattedDate = formatTooltipDate(barPoint.payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-1.5">
                            <div className="font-medium text-sm">{formattedDate}</div>
                            {hasOverlay ? (
                              <div className="text-sm flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 rounded-sm"
                                  style={{ backgroundColor: config.color }}
                                />
                                <span>
                                  {primarySeriesLabel}:{" "}
                                  {formatTooltipValue(barPoint.value as number)}
                                </span>
                              </div>
                            ) : (
                              <div className="text-sm">
                                {formatTooltipValue(barPoint.value as number)}
                              </div>
                            )}
                            {hasOverlay && overlayPoint && overlayPoint.value != null && (
                              <div className="text-sm flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 rounded-sm"
                                  style={{ backgroundColor: overlayColor }}
                                />
                                <span>
                                  {overlayLabel ?? "Total Validator Seats"}:{" "}
                                  {formatTooltipValue(overlayPoint.value as number)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {primaryAsLine ? (
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={config.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Bar dataKey="value" fill={config.color} radius={[4, 4, 0, 0]} />
                  )}
                  {hasOverlay && (
                    <Line
                      type="monotone"
                      dataKey="overlayValue"
                      stroke={overlayColor ?? "#3B82F6"}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
                  {referenceLineBucket && isReferenceInRange && (
                    <ReferenceLine
                      x={referenceLineBucket}
                      stroke="#E84142"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                    >
                      <Label
                        value={referenceLineLabel ?? "ACP-77"}
                        position="insideTopRight"
                        fill="#E84142"
                        fontSize={11}
                        offset={8}
                      />
                    </ReferenceLine>
                  )}
                </ComposedChart>
              ) : (
                <AreaChart data={displayData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient
                      id={`gradient-${config.metricKey}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatXAxis}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    ticks={xAxisTicks}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${config.color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const formattedDate = formatTooltipDate(payload[0].payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-sm">{formattedDate}</div>
                            <div className="text-sm">
                              {formatTooltipValue(payload[0].value as number)}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    fill={`url(#gradient-${config.metricKey})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </ChartWatermark>

          <div className="mt-4 bg-white dark:bg-black pl-[60px]">
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={aggregatedData} margin={{ top: 0, right: 30, left: 0, bottom: 5 }}>
                <Brush
                  dataKey="day"
                  height={80}
                  stroke={config.color}
                  fill={`${config.color}20`}
                  alwaysShowText={false}
                  startIndex={brushIndexes?.startIndex ?? 0}
                  endIndex={brushIndexes?.endIndex ?? aggregatedData.length - 1}
                  onChange={(e: any) => {
                    if (e.startIndex !== undefined && e.endIndex !== undefined) {
                      setBrushIndexes({ startIndex: e.startIndex, endIndex: e.endIndex });
                    }
                  }}
                  travellerWidth={8}
                  tickFormatter={formatBrushXAxis}
                >
                  <LineChart>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={config.color}
                      strokeWidth={1}
                      dot={false}
                    />
                  </LineChart>
                </Brush>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
