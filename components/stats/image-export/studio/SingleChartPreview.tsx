"use client";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ReferenceLine,
} from "recharts";
import { ChartWatermark } from "@/components/stats/ChartWatermark";
import { ImagePreview } from "../ImagePreview";
import type {
  ChartExportData,
  ExportSettings,
  Period,
} from "../types";
import { formatXAxis, formatYAxis, formatDataLabel } from "./chart-utils";
import type { ChartDataPoint, SeriesInfo } from "./types";

interface ChartStats {
  seriesId: string;
  seriesName: string;
  seriesColor: string;
  min: number;
  max: number;
  avg: number;
  percentChange: number;
  trend: "up" | "down" | "neutral";
  allSeries?: ChartStats[];
  cumulativeTotal?: number;
}

interface SingleChartPreviewProps {
  settings: ExportSettings;
  chartData: ChartExportData;
  dataArray: ChartDataPoint[];
  displayDataWithCumulative: ChartDataPoint[];
  seriesInfo: SeriesInfo[];
  chartStats: ChartStats | null;
  capturedAt: Date;
  period: Period | undefined;
}

// Renders the single-chart preview: ImagePreview wrapper around the recharts
// ComposedChart with axes, total/avg reference lines, and the empty state.
// The orchestrator renders the AnnotationOverlay as a sibling so screenshots
// capture both inside the same export wrapper.
export function SingleChartPreview({
  settings,
  chartData,
  dataArray,
  displayDataWithCumulative,
  seriesInfo,
  chartStats,
  capturedAt,
  period,
}: SingleChartPreviewProps) {
  const dateKey = dataArray[0]?.date !== undefined ? "date" : "day";

  const series =
    seriesInfo.length > 0
      ? seriesInfo
      : [
          {
            id: "value",
            name: chartData.title || "Value",
            color: "#e84142",
            yAxis: "left" as const,
          },
        ];

  // Right Y axis is needed when any series is right-aligned OR when the Total
  // line is enabled.
  const hasRightAxis =
    seriesInfo.some((s) => s.yAxis === "right") ||
    settings.chartDisplay.showTotalLine;

  const showLabels = settings.chartDisplay.showDataLabels;

  const renderChartContent = () =>
    series.map((s) => {
      const commonProps = {
        dataKey: s.id,
        name: s.name,
        yAxisId: s.yAxis === "right" ? "right" : "left",
      };

      switch (settings.chartType) {
        case "bar":
          return (
            <Bar
              key={s.id}
              {...commonProps}
              fill={s.color}
              radius={[2, 2, 0, 0]}
            >
              {showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  formatter={formatDataLabel}
                  className="fill-gray-600 dark:fill-gray-400"
                  style={{ fontSize: 9 }}
                />
              )}
            </Bar>
          );
        case "area":
          return (
            <Area
              key={s.id}
              {...commonProps}
              type="monotone"
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.3}
              strokeWidth={2}
            >
              {showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  formatter={formatDataLabel}
                  className="fill-gray-600 dark:fill-gray-400"
                  style={{ fontSize: 9 }}
                />
              )}
            </Area>
          );
        case "line":
        default:
          return (
            <Line
              key={s.id}
              {...commonProps}
              type="monotone"
              stroke={s.color}
              strokeWidth={2}
              dot={showLabels}
            >
              {showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  formatter={formatDataLabel}
                  className="fill-gray-600 dark:fill-gray-400"
                  style={{ fontSize: 9 }}
                />
              )}
            </Line>
          );
      }
    });

  return (
    <ImagePreview
      settings={settings}
      chartData={chartData}
      stats={chartStats || undefined}
      capturedAt={capturedAt}
    >
      {dataArray.length > 0 ? (
        <ChartWatermark
          className="h-full"
          scale={
            ["portrait", "instagram"].includes(settings.aspectRatio)
              ? "small"
              : settings.aspectRatio === "square"
                ? "medium"
                : "large"
          }
          visible={settings.watermark.visible}
          opacity={settings.watermark.opacity}
          position={settings.watermark.position}
          layer={settings.watermark.layer}
        >
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart
              data={displayDataWithCumulative}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              {settings.chartDisplay.showGridLines && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-gray-200 dark:stroke-gray-700"
                  vertical={false}
                />
              )}
              <XAxis
                dataKey={dateKey}
                tickFormatter={(v: string) => formatXAxis(v, period)}
                tick={{
                  className: "fill-gray-600 dark:fill-gray-400",
                  fontSize: 11,
                }}
                minTickGap={40}
              />
              <YAxis
                yAxisId="left"
                tick={{
                  className: "fill-gray-600 dark:fill-gray-400",
                  fontSize: 11,
                }}
                tickFormatter={formatYAxis}
              />
              {hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{
                    className: "fill-gray-600 dark:fill-gray-400",
                    fontSize: 11,
                  }}
                  tickFormatter={formatYAxis}
                />
              )}
              {renderChartContent()}
              {/* Cumulative total line — purple, on right Y axis. */}
              {settings.chartDisplay.showTotalLine && (
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  dot={false}
                  yAxisId="right"
                  name="Total"
                  strokeOpacity={0.9}
                />
              )}
              {/* Average reference line — rendered last to sit on top. */}
              {settings.chartDisplay.showAvgLine && chartStats && (
                <ReferenceLine
                  y={chartStats.avg}
                  yAxisId="left"
                  stroke="#888"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Avg: ${formatYAxis(chartStats.avg)}`,
                    position: "insideTopLeft",
                    className: "fill-gray-600 dark:fill-gray-400",
                    fontSize: 10,
                    offset: 5,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartWatermark>
      ) : (
        <div className="h-[250px] flex flex-col items-center justify-center gap-3 text-center px-8">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M7 16l4-4 4 4 5-6" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              No chart data available
            </p>
            <p className="text-xs text-muted-foreground/70">
              Select a metric with data to create an export
            </p>
          </div>
        </div>
      )}
    </ImagePreview>
  );
}
