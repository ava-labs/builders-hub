"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Loader2 } from "lucide-react";
import type { ChartDataPoint, Period, ChartType } from "./types";
import { cn } from "@/lib/utils";

interface MiniChartProps {
  data: ChartDataPoint[];
  title: string;
  color: string;
  height: number;
  showTitle: boolean;
  isLoading?: boolean;
  error?: string;
  period?: Period;
  theme?: "light" | "dark" | "rich";
  chartType?: ChartType;
  showAverage?: boolean;
  showGrid?: boolean;
  showStats?: boolean;
}

// Format Y axis values for mini chart with smart decimal handling
const formatYAxis = (value: number) => {
  const format = (scaled: number, suffix: string) => {
    // >= 100: no decimal (e.g., 338M, 111K)
    if (scaled >= 100) return `${Math.round(scaled)}${suffix}`;
    // >= 10: 1 decimal, strip trailing .0 (e.g., 31.3M or 20M)
    if (scaled >= 10) return `${scaled.toFixed(1).replace(/\.0$/, '')}${suffix}`;
    // < 10: 1 decimal, strip trailing .0 (e.g., 1.1B or 5M)
    return `${scaled.toFixed(1).replace(/\.0$/, '')}${suffix}`;
  };

  if (value >= 1e12) return format(value / 1e12, 'T');
  if (value >= 1e9) return format(value / 1e9, 'B');
  if (value >= 1e6) return format(value / 1e6, 'M');
  if (value >= 1e3) return format(value / 1e3, 'K');
  return value.toLocaleString();
};

// Format X axis labels based on period
const formatXAxis = (value: string, period?: Period) => {
  if (!value) return "";

  // Handle pre-formatted aggregated date keys (from useCollageMetrics)
  // Format: "YYYY-QX" for quarters, "YYYY-WXX" for weeks, "YYYY-MM" for months
  if (period === "Q" && value.includes("-Q")) {
    // "2021-Q4" -> "'21 Q4" (compact with year)
    const [year, q] = value.split("-");
    return `'${year.slice(-2)} ${q}`;
  }
  if (period === "W" && value.includes("-W")) {
    // "2025-W30" -> Convert to actual date like "Jul 21"
    const [year, weekPart] = value.split("-W");
    const weekNum = parseInt(weekPart);
    // Calculate first day of that ISO week
    const jan4 = new Date(parseInt(year), 0, 4); // Jan 4 is always in week 1
    const dayOfWeek = jan4.getDay() || 7; // Convert Sunday from 0 to 7
    const week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - dayOfWeek + 1); // Monday of week 1
    const weekDate = new Date(week1Start);
    weekDate.setDate(week1Start.getDate() + (weekNum - 1) * 7);
    return weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (period === "M" && /^\d{4}-\d{2}$/.test(value)) {
    // "2021-08" -> "Aug '21"
    const [year, month] = value.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return `${date.toLocaleDateString("en-US", { month: "short" })} '${year.slice(-2)}`;
  }

  // Parse as regular date
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;

  switch (period) {
    case "Y":
      return date.getFullYear().toString();
    case "Q": {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `'${date.getFullYear().toString().slice(-2)} Q${quarter}`;
    }
    case "M":
      return `${date.toLocaleDateString("en-US", { month: "short" })} '${date.getFullYear().toString().slice(-2)}`;
    case "W":
    case "D":
    default:
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

// Get latest value from data
const getLatestValue = (data: ChartDataPoint[]): string => {
  if (data.length === 0) return "—";
  const lastPoint = data[data.length - 1];
  const value = lastPoint.value;
  if (value === undefined) return "—";
  return formatYAxis(value);
};

export function MiniChart({
  data,
  title,
  color,
  height,
  showTitle,
  isLoading = false,
  error,
  period,
  theme = "light",
  chartType = "area",
  showAverage = true,
  showGrid = true,
  showStats = false,
}: MiniChartProps) {
  const getTextColorClass = () => {
    switch (theme) {
      case "light":
        return "text-zinc-950";
      case "dark":
      case "rich":
        return "text-white";
      default:
        return "text-zinc-950";
    }
  };

  const getMutedTextColorClass = () => {
    switch (theme) {
      case "light":
        return "text-zinc-500";
      case "dark":
      case "rich":
        return "text-zinc-400";
      default:
        return "text-zinc-500";
    }
  };

  const getGridColor = () => {
    switch (theme) {
      case "light":
        return "#00000020";
      case "dark":
      case "rich":
        return "#ffffff30";
      default:
        return "#00000020"; // Default to light
    }
  };

  const getAverageLineColor = () => {
    switch (theme) {
      case "light":
        return "#71717a"; // zinc-500
      case "dark":
      case "rich":
        return "#a1a1aa"; // zinc-400
      default:
        return "#71717a";
    }
  };

  // Calculate average value
  const averageValue = data.length > 0
    ? data.reduce((sum, point) => sum + (point.value ?? 0), 0) / data.length
    : 0;

  // Calculate min and max values for stats display
  const values = data.map(point => point.value ?? 0).filter(v => v !== 0);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;

  // Calculate Y-axis domain with 10% padding above max to ensure data fits
  const yAxisDomain: [number, number] = [0, Math.ceil(maxValue * 1.1)];

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <Loader2 className={cn("h-6 w-6 animate-spin", getMutedTextColorClass())} />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: `${height}px` }}
      >
        {showTitle && (
          <p className={cn("text-xs font-medium mb-1", getTextColorClass())}>
            {title}
          </p>
        )}
        <p className={cn("text-xs", getMutedTextColorClass())}>
          {error || "No data"}
        </p>
      </div>
    );
  }

  // Determine the date key
  const dateKey = data[0]?.date !== undefined ? "date" : "day";

  return (
    <div className="relative flex flex-col h-full">
      {/* Title and latest value */}
      {showTitle && (
        <div className="flex items-center justify-between px-1.5 py-0.5 shrink-0">
          <p className={cn("text-[11px] font-medium truncate", getTextColorClass())}>
            {title}
          </p>
          <p className={cn("text-[11px] font-semibold tabular-nums", getTextColorClass())}>
            {getLatestValue(data)}
          </p>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart
              data={data}
              margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
            >
              {showGrid && (
                <CartesianGrid
                  stroke={getGridColor()}
                  vertical={false}
                />
              )}
              <XAxis
                dataKey={dateKey}
                tickFormatter={(v) => formatXAxis(v, period)}
                tick={{ fontSize: 8, className: getMutedTextColorClass() }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
                hide={height < 100}
              />
              <YAxis
                domain={yAxisDomain}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 8, className: getMutedTextColorClass() }}
                axisLine={false}
                tickLine={false}
                width={30}
                hide={height < 100}
              />
              {showAverage && averageValue > 0 && (
                <ReferenceLine
                  y={averageValue}
                  stroke={getAverageLineColor()}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
              )}
              <Bar
                dataKey="value"
                fill={color}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart
              data={data}
              margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
            >
              {showGrid && (
                <CartesianGrid
                  stroke={getGridColor()}
                  vertical={false}
                />
              )}
              <XAxis
                dataKey={dateKey}
                tickFormatter={(v) => formatXAxis(v, period)}
                tick={{ fontSize: 8, className: getMutedTextColorClass() }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
                hide={height < 100}
              />
              <YAxis
                domain={yAxisDomain}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 8, className: getMutedTextColorClass() }}
                axisLine={false}
                tickLine={false}
                width={30}
                hide={height < 100}
              />
              {showAverage && averageValue > 0 && (
                <ReferenceLine
                  y={averageValue}
                  stroke={getAverageLineColor()}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <AreaChart
              data={data}
              margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              {showGrid && (
                <CartesianGrid
                  stroke={getGridColor()}
                  vertical={false}
                />
              )}
              <XAxis
                dataKey={dateKey}
                tickFormatter={(v) => formatXAxis(v, period)}
                tick={{ fontSize: 8, className: getMutedTextColorClass() }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
                hide={height < 100}
              />
              <YAxis
                domain={yAxisDomain}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 8, className: getMutedTextColorClass() }}
                axisLine={false}
                tickLine={false}
                width={30}
                hide={height < 100}
              />
              {showAverage && averageValue > 0 && (
                <ReferenceLine
                  y={averageValue}
                  stroke={getAverageLineColor()}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#gradient-${title.replace(/\s+/g, "-")})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Stats row at bottom - absolute positioned to not affect layout */}
      {showStats && (
        <div className={cn(
          "absolute bottom-0 left-0 right-0 flex items-center justify-between px-1.5 py-0.5",
          theme === "light" ? "bg-zinc-50/90" : "bg-zinc-800/80"
        )}>
          <span className={cn("text-[8px] tabular-nums", getMutedTextColorClass())}>
            Min: <span className={getTextColorClass()}>{formatYAxis(minValue)}</span>
          </span>
          <span className={cn("text-[8px] tabular-nums", getMutedTextColorClass())}>
            Avg: <span className={getTextColorClass()}>{formatYAxis(averageValue)}</span>
          </span>
          <span className={cn("text-[8px] tabular-nums", getMutedTextColorClass())}>
            Max: <span className={getTextColorClass()}>{formatYAxis(maxValue)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
