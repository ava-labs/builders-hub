"use client";

import { ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
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

// Helper to parse date strings in various formats
const parseDateString = (dateStr: string): Date => {
  if (!dateStr) return new Date();

  // Handle quarterly format: YYYY-Q#
  if (dateStr.includes("-Q")) {
    const [year, quarter] = dateStr.split("-Q");
    const month = (parseInt(quarter, 10) - 1) * 3;
    return new Date(parseInt(year, 10), month, 1);
  }

  // Handle weekly format: YYYY-W##
  if (dateStr.includes("-W")) {
    const [year, weekPart] = dateStr.split("-W");
    const weekNum = parseInt(weekPart);
    const jan4 = new Date(parseInt(year), 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - dayOfWeek + 1);
    const weekDate = new Date(week1Start);
    weekDate.setDate(week1Start.getDate() + (weekNum - 1) * 7);
    return weekDate;
  }

  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parts[1] ? parseInt(parts[1], 10) - 1 : 0;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  return new Date(year, month, day);
};

// Calculate range in days from data array
const getDataRangeDays = (data: ChartDataPoint[]): number => {
  if (data.length < 2) return 0;

  const dateKey = data[0]?.date !== undefined ? "date" : "day";
  const startDate = data[0]?.[dateKey] as string;
  const endDate = data[data.length - 1]?.[dateKey] as string;

  if (!startDate || !endDate) return data.length;

  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Dynamic X axis formatter based on data range, for uniform readable labels
const formatXAxis = (value: string, dataRangeDays: number) => {
  if (!value) return "";

  if (value.includes("-Q")) {
    const [year, q] = value.split("-");
    return `${q} ${year}`;
  }

  if (/^\d{4}$/.test(value)) return value;

  const date = parseDateString(value);
  if (isNaN(date.getTime())) return value;

  if (dataRangeDays > 730) {
    return date.getFullYear().toString();
  } else if (dataRangeDays > 120) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } else {
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

  const dataRangeDays = getDataRangeDays(data);

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
                tickFormatter={(v) => formatXAxis(v, dataRangeDays)}
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
                tickFormatter={(v) => formatXAxis(v, dataRangeDays)}
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
                tickFormatter={(v) => formatXAxis(v, dataRangeDays)}
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
