"use client";
import type { ChartDataExport, DataSeries } from "@/components/stats/ConfigurableChart";
import type { PlaygroundChartData } from "@/components/stats/image-export";
import { ChartCard } from "./ChartCard";
import type { ChartConfig } from "./types";
import type { useChartDragAndDrop } from "../_hooks/useChartDragAndDrop";

interface ChartsGridProps {
  charts: ChartConfig[];
  playgroundId: string | null;
  isOwner: boolean;
  globalStartTime: string | null;
  globalEndTime: string | null;
  reloadTrigger: number;
  playgroundCharts: PlaygroundChartData[];
  searchTerm: string;

  drag: ReturnType<typeof useChartDragAndDrop>;

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

export function ChartsGrid({
  charts,
  playgroundId,
  isOwner,
  globalStartTime,
  globalEndTime,
  reloadTrigger,
  playgroundCharts,
  searchTerm,
  drag,
  onColSpanChange,
  onTitleChange,
  onDataSeriesChange,
  onStackSameMetricsChange,
  onAbbreviateNumbersChange,
  onTimeFilterChange,
  onBrushChange,
  onChartDataReady,
  onRemove,
}: ChartsGridProps) {
  if (charts.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12">
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
          No charts found matching &quot;{searchTerm}&quot;
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6">
      {charts.map((chart) => (
        <ChartCard
          key={`${playgroundId || "new"}-${chart.id}`}
          playgroundId={playgroundId}
          chart={chart}
          drag={drag.getCardProps(chart.id)}
          isOwner={isOwner}
          globalStartTime={globalStartTime}
          globalEndTime={globalEndTime}
          reloadTrigger={reloadTrigger}
          playgroundCharts={playgroundCharts}
          onColSpanChange={onColSpanChange}
          onTitleChange={onTitleChange}
          onDataSeriesChange={onDataSeriesChange}
          onStackSameMetricsChange={onStackSameMetricsChange}
          onAbbreviateNumbersChange={onAbbreviateNumbersChange}
          onTimeFilterChange={onTimeFilterChange}
          onBrushChange={onBrushChange}
          onChartDataReady={onChartDataReady}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
