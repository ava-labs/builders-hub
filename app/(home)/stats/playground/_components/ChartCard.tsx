"use client";
import ConfigurableChart, {
  type ChartDataExport,
  type DataSeries,
} from "@/components/stats/ConfigurableChart";
import type { PlaygroundChartData } from "@/components/stats/image-export";
import { cn } from "@/lib/utils";
import type { ChartConfig } from "./types";
import type { ChartCardDragHandlers } from "../_hooks/useChartDragAndDrop";

interface ChartCardProps {
  // Re-keyed by the parent when playgroundId changes — used in the React key.
  playgroundId: string | null;

  chart: ChartConfig;

  // Drag handlers + flags from useChartDragAndDrop's getCardProps().
  drag: ChartCardDragHandlers;

  // Owner-only mutations (undefined disables controls when viewing someone
  // else's playground).
  isOwner: boolean;

  // Global time filter applied as a fallback when the chart has no per-chart
  // override.
  globalStartTime: string | null;
  globalEndTime: string | null;
  reloadTrigger: number;

  // Cross-chart data sharing for image export.
  playgroundCharts: PlaygroundChartData[];

  // Per-chart event callbacks.
  onColSpanChange: (chartId: string, newColSpan: 6 | 12) => void;
  onTitleChange: (chartId: string, newTitle: string) => void;
  onDataSeriesChange: (chartId: string, dataSeries: DataSeries[]) => void;
  onStackSameMetricsChange: (chartId: string, value: boolean) => void;
  onAbbreviateNumbersChange: (chartId: string, value: boolean) => void;
  onTimeFilterChange: (
    chartId: string,
    startTime: string | null,
    endTime: string | null
  ) => void;
  onBrushChange: (
    chartId: string,
    startIndex: number | null,
    endIndex: number | null
  ) => void;
  onChartDataReady: (chartId: string, data: ChartDataExport) => void;
  onRemove: (chartId: string) => void;
}

// Wraps a single ConfigurableChart with the playground's drag-and-drop
// affordances (visual states, draggable flag, and the 6 drag event handlers
// fed in via the `drag` prop).
export function ChartCard({
  playgroundId,
  chart,
  drag,
  isOwner,
  globalStartTime,
  globalEndTime,
  reloadTrigger,
  playgroundCharts,
  onColSpanChange,
  onTitleChange,
  onDataSeriesChange,
  onStackSameMetricsChange,
  onAbbreviateNumbersChange,
  onTimeFilterChange,
  onBrushChange,
  onChartDataReady,
  onRemove,
}: ChartCardProps) {
  return (
    <div
      key={`${playgroundId || "new"}-${chart.id}`}
      className={cn(
        chart.colSpan === 6 ? "lg:col-span-6" : "lg:col-span-12",
        "relative",
        drag.isDragging && "opacity-50 cursor-grabbing",
        drag.isDragOver &&
          "outline outline-2 outline-dashed outline-primary outline-offset-2 rounded-xl",
        drag.canDrag && !drag.isDragging && "cursor-grab"
      )}
      draggable={drag.draggable}
      onMouseDown={drag.onMouseDown}
      onMouseUp={drag.onMouseUp}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragLeave={drag.onDragLeave}
      onDrop={drag.onDrop}
      onDragEnd={drag.onDragEnd}
    >
      <ConfigurableChart
        title={chart.title}
        colSpan={chart.colSpan}
        initialDataSeries={chart.dataSeries || []}
        initialStackSameMetrics={chart.stackSameMetrics || false}
        initialAbbreviateNumbers={
          chart.abbreviateNumbers !== undefined ? chart.abbreviateNumbers : true
        }
        onColSpanChange={
          isOwner
            ? (newColSpan) => onColSpanChange(chart.id, newColSpan)
            : undefined
        }
        onTitleChange={
          isOwner ? (newTitle) => onTitleChange(chart.id, newTitle) : undefined
        }
        onDataSeriesChange={
          isOwner
            ? (dataSeries) => onDataSeriesChange(chart.id, dataSeries)
            : undefined
        }
        onStackSameMetricsChange={
          isOwner
            ? (value) => onStackSameMetricsChange(chart.id, value)
            : undefined
        }
        onAbbreviateNumbersChange={
          isOwner
            ? (value) => onAbbreviateNumbersChange(chart.id, value)
            : undefined
        }
        onRemove={isOwner ? () => onRemove(chart.id) : undefined}
        disableControls={!isOwner}
        startTime={chart.startTime || globalStartTime || null}
        endTime={chart.endTime || globalEndTime || null}
        onTimeFilterChange={
          isOwner
            ? (startTime, endTime) =>
                onTimeFilterChange(chart.id, startTime, endTime)
            : undefined
        }
        reloadTrigger={reloadTrigger}
        initialBrushStartIndex={chart.brushStartIndex}
        initialBrushEndIndex={chart.brushEndIndex}
        onBrushChange={
          isOwner
            ? (startIndex, endIndex) =>
                onBrushChange(chart.id, startIndex, endIndex)
            : undefined
        }
        onChartDataReady={(data) => onChartDataReady(chart.id, data)}
        playgroundCharts={playgroundCharts}
      />
    </div>
  );
}
