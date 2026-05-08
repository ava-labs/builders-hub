"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Brush,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Download, TrendingUp } from "lucide-react";
import l1ChainsData from "@/constants/l1-chains.json";
import {
  calculateDateRangeDays,
  formatXAxisLabel,
  generateXAxisTicks,
} from "@/components/stats/chart-axis-utils";
import { formatNumber } from "./helpers";
import {
  aggregateByPeriod,
  formatTooltipDate,
  periodLabel,
} from "./chart-card-utils";
import type { ChartConfig, ChartDataPoint, ChartPeriod } from "./types";

interface ChartCardProps {
  config: ChartConfig;
  rawData: ChartDataPoint[];
  period: ChartPeriod;
  currentValue: number | string;
  onPeriodChange: (period: ChartPeriod) => void;
  formatTooltipValue: (value: number) => string;
  formatYAxisValue: (value: number) => string;
}

const PERIODS: ChartPeriod[] = ["D", "W", "M", "Q", "Y"];

export function ChartCard({
  config,
  rawData,
  period,
  currentValue,
  onPeriodChange,
  formatTooltipValue,
  formatYAxisValue,
}: ChartCardProps) {
  const { resolvedTheme } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const aggregatedData = useMemo(
    () => aggregateByPeriod(rawData, period),
    [rawData, period]
  );

  // Reset brush window whenever the period (or data length) changes. Daily
  // view defaults to the most recent 90 days; coarser periods show everything.
  useEffect(() => {
    if (aggregatedData.length === 0) return;

    if (period === "D") {
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedData.length - daysToShow),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [period, aggregatedData.length]);

  const displayData = brushIndexes
    ? aggregatedData.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1)
    : aggregatedData;

  const dynamicChange = useMemo(() => {
    if (!displayData || displayData.length < 2) {
      return { change: 0, isPositive: true };
    }
    const lastValue = displayData[displayData.length - 1].value;
    const secondLastValue = displayData[displayData.length - 2].value;
    if (secondLastValue === 0) {
      return { change: 0, isPositive: true };
    }
    const changePercentage =
      ((lastValue - secondLastValue) / secondLastValue) * 100;
    return {
      change: Math.abs(changePercentage),
      isPositive: changePercentage >= 0,
    };
  }, [displayData]);

  // chart-axis-utils helpers are typed against a generic record shape; cast
  // ChartDataPoint[] at the boundary since they only read the `day` field.
  const brushRangeDays = useMemo(
    () =>
      calculateDateRangeDays(
        displayData as unknown as Record<string, unknown>[],
        "day"
      ),
    [displayData]
  );
  const totalDataDays = useMemo(
    () =>
      calculateDateRangeDays(
        aggregatedData as unknown as Record<string, unknown>[],
        "day"
      ),
    [aggregatedData]
  );

  const formatXAxis = (value: string) => formatXAxisLabel(value, brushRangeDays);
  const formatBrushXAxis = (value: string) =>
    formatXAxisLabel(value, totalDataDays);

  const xAxisTicks = useMemo(
    () =>
      generateXAxisTicks(
        displayData as unknown as Record<string, unknown>[],
        brushRangeDays,
        "day"
      ),
    [displayData, brushRangeDays]
  );

  const handleScreenshot = async () => {
    const element = chartContainerRef.current;
    if (!element) return;

    try {
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

  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;

    const headers = ["Date", config.title];
    const rows = displayData.map((point) => [point.day, point.value].join(","));
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

  const Icon = config.icon;

  return (
    <Card
      className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm py-0 shadow-none"
      ref={chartContainerRef}
    >
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon
                className="h-5 w-5 sm:h-6 sm:w-6"
                style={{ color: config.color }}
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal text-zinc-900 dark:text-white">
                {config.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 hidden sm:block">
                {config.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) => onPeriodChange(value as ChartPeriod)}
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:ring-0 shadow-none">
                <SelectValue>{periodLabel(period)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {periodLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleScreenshot}
              className="p-1.5 sm:p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 flex-wrap">
            <div className="text-md sm:text-base font-mono break-all">
              {formatTooltipValue(
                typeof currentValue === "string"
                  ? parseFloat(currentValue)
                  : currentValue
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
                {dynamicChange.change >= 1000
                  ? dynamicChange.change >= 1000000
                    ? `${(dynamicChange.change / 1000000).toFixed(1)}M%`
                    : `${(dynamicChange.change / 1000).toFixed(1)}K%`
                  : `${dynamicChange.change.toFixed(1)}%`}
              </div>
            )}
          </div>

          <div className="mb-6">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={displayData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatXAxis}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                  tick={{ className: "fill-zinc-600 dark:fill-zinc-400" }}
                  ticks={xAxisTicks}
                  interval={0}
                />
                <YAxis
                  tickFormatter={formatYAxisValue}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                  tick={{ className: "fill-zinc-600 dark:fill-zinc-400" }}
                />
                <Tooltip
                  cursor={{ fill: `${config.color}20` }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const formattedDate = formatTooltipDate(
                      payload[0].payload.day,
                      period
                    );
                    const chainBreakdown = payload[0].payload.chainBreakdown;

                    const sortedChains = chainBreakdown
                      ? Object.entries(chainBreakdown)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 8)
                      : [];

                    return (
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-card p-3 shadow-lg font-mono max-w-sm">
                        <div className="grid gap-2">
                          <div className="font-medium text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 text-zinc-900 dark:text-white">
                            {formattedDate}
                          </div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                            Total:{" "}
                            {formatTooltipValue(payload[0].value as number)}
                          </div>
                          {sortedChains.length > 0 && (
                            <div className="text-xs mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                              {sortedChains.map(([chainName, count]) => {
                                const chain = l1ChainsData.find(
                                  (c) => c.chainName === chainName
                                );
                                const chainColor = chain?.color || "#E84142";
                                const chainLogo = chain?.chainLogoURI || "";

                                return (
                                  <div
                                    key={chainName}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {chainLogo && (
                                        <Image
                                          src={chainLogo}
                                          alt={chainName}
                                          width={16}
                                          height={16}
                                          className="rounded-full object-cover flex-shrink-0"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                          }}
                                        />
                                      )}
                                      <span
                                        className="truncate font-medium"
                                        style={{ color: chainColor }}
                                      >
                                        {chainName}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-zinc-900 dark:text-white flex-shrink-0 tabular-nums">
                                      {formatNumber(count as number)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="url(#colorGradient)"
                  radius={[0, 0, 0, 0]}
                  shape={(props: unknown) => {
                    const { x, y, width, height, payload } = props as {
                      x: number;
                      y: number;
                      width: number;
                      height: number;
                      payload: ChartDataPoint;
                    };
                    if (!payload.chainBreakdown) {
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={config.color}
                          rx={0}
                        />
                      );
                    }

                    // Stack each chain's contribution as a colored segment.
                    const sortedChains = Object.entries(
                      payload.chainBreakdown
                    ).sort(([, a], [, b]) => (b as number) - (a as number));

                    const totalValue = payload.value;
                    let currentY = y + height;

                    return (
                      <g>
                        {sortedChains.map(([chainName, count]) => {
                          const chain = l1ChainsData.find(
                            (c) => c.chainName === chainName
                          );
                          const chainColor = chain?.color || config.color;
                          const segmentHeight =
                            ((count as number) / totalValue) * height;
                          const segmentY = currentY - segmentHeight;

                          const rect = (
                            <rect
                              key={chainName}
                              x={x}
                              y={segmentY}
                              width={width}
                              height={segmentHeight}
                              fill={chainColor}
                              rx={0}
                            />
                          );

                          currentY = segmentY;
                          return rect;
                        })}
                      </g>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 pl-[60px]">
            <ResponsiveContainer width="100%" height={80}>
              <LineChart
                data={aggregatedData}
                margin={{ top: 0, right: 30, left: 0, bottom: 5 }}
              >
                <Brush
                  dataKey="day"
                  height={80}
                  stroke={config.color}
                  fill={`${config.color}20`}
                  alwaysShowText={false}
                  startIndex={brushIndexes?.startIndex ?? 0}
                  endIndex={brushIndexes?.endIndex ?? aggregatedData.length - 1}
                  onChange={(e) => {
                    if (
                      e.startIndex !== undefined &&
                      e.endIndex !== undefined
                    ) {
                      setBrushIndexes({
                        startIndex: e.startIndex,
                        endIndex: e.endIndex,
                      });
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
