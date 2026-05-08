"use client";
import { useCallback, useMemo, useState } from "react";
import type {
  ChartDataExport,
  DataSeries,
} from "@/components/stats/ConfigurableChart";
import type { PlaygroundChartData } from "@/components/stats/image-export";
import type { ChartConfig } from "../_components/types";

const INITIAL_CHARTS: ChartConfig[] = [
  {
    id: "1",
    title: "Chart 1",
    colSpan: 12,
    dataSeries: [],
    stackSameMetrics: false,
    abbreviateNumbers: true,
  },
];

export interface PlaygroundChartsState {
  charts: ChartConfig[];
  savedCharts: ChartConfig[];
  chartDataMap: Map<string, ChartDataExport>;
  playgroundCharts: PlaygroundChartData[];
  filteredCharts: (searchTerm: string) => ChartConfig[];

  setCharts: React.Dispatch<React.SetStateAction<ChartConfig[]>>;
  setSavedCharts: React.Dispatch<React.SetStateAction<ChartConfig[]>>;

  // Per-chart updates.
  handleChartDataReady: (chartId: string, data: ChartDataExport) => void;
  handleColSpanChange: (chartId: string, newColSpan: 6 | 12) => void;
  handleTitleChange: (chartId: string, newTitle: string) => void;
  handleDataSeriesChange: (chartId: string, dataSeries: DataSeries[]) => void;
  handleStackSameMetricsChange: (
    chartId: string,
    stackSameMetrics: boolean
  ) => void;
  handleAbbreviateNumbersChange: (
    chartId: string,
    abbreviateNumbers: boolean
  ) => void;
  handleChartTimeFilterChange: (
    chartId: string,
    startTime: string | null,
    endTime: string | null
  ) => void;
  handleBrushChange: (
    chartId: string,
    startIndex: number | null,
    endIndex: number | null
  ) => void;
  handleChartReorder: (draggedId: string, targetId: string) => void;

  // Add / remove.
  addChart: () => void;
  removeChart: (chartId: string) => void;

  // Bulk ops used by load/save/reset orchestration in page.tsx.
  resetToBlank: () => void;
}

// Owns the playground's chart-collection state machine: the current chart
// list, the last-saved snapshot, the per-chart data map (used by image
// export), and every per-chart mutation handler. The page-level component
// stitches these into ChartCard / ImageExportStudio.
export function usePlaygroundCharts(): PlaygroundChartsState {
  const [charts, setCharts] = useState<ChartConfig[]>(INITIAL_CHARTS);
  const [savedCharts, setSavedCharts] = useState<ChartConfig[]>(INITIAL_CHARTS);
  const [chartDataMap, setChartDataMap] = useState<
    Map<string, ChartDataExport>
  >(new Map());

  const handleChartDataReady = useCallback(
    (chartId: string, data: ChartDataExport) => {
      setChartDataMap((prev) => {
        const next = new Map(prev);
        next.set(chartId, data);
        return next;
      });
    },
    []
  );

  // Convert chart data into the shape expected by ImageExportStudio. Drops
  // charts that don't yet have data so the export panel doesn't render
  // empty placeholders.
  const playgroundCharts = useMemo<PlaygroundChartData[]>(() => {
    const result: PlaygroundChartData[] = [];
    for (const chart of charts) {
      const chartData = chartDataMap.get(chart.id);
      if (
        !chartData ||
        chartData.data.length === 0 ||
        chartData.seriesInfo.length === 0
      ) {
        continue;
      }
      result.push({
        id: chart.id,
        title: chart.title,
        data: chartData.data.map((point) => ({ ...point, date: point.date })),
        seriesInfo: chartData.seriesInfo,
        color: chartData.seriesInfo[0]?.color,
      });
    }
    return result;
  }, [charts, chartDataMap]);

  const handleColSpanChange = useCallback(
    (chartId: string, newColSpan: 6 | 12) => {
      setCharts((prev) =>
        prev.map((chart) =>
          chart.id === chartId ? { ...chart, colSpan: newColSpan } : chart
        )
      );
    },
    []
  );

  const handleTitleChange = useCallback((chartId: string, newTitle: string) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === chartId ? { ...c, title: newTitle } : c))
    );
  }, []);

  const handleDataSeriesChange = useCallback(
    (chartId: string, dataSeries: DataSeries[]) => {
      setCharts((prev) => {
        const currentChart = prev.find((c) => c.id === chartId);
        // Bail out if dataSeries is structurally identical — avoids no-op
        // re-renders triggered by ConfigurableChart firing onChange with the
        // same shape on every render.
        if (
          currentChart &&
          JSON.stringify(currentChart.dataSeries) === JSON.stringify(dataSeries)
        ) {
          return prev;
        }
        return prev.map((c) =>
          c.id === chartId ? { ...c, dataSeries } : c
        );
      });
    },
    []
  );

  const handleStackSameMetricsChange = useCallback(
    (chartId: string, stackSameMetrics: boolean) => {
      setCharts((prev) =>
        prev.map((c) =>
          c.id === chartId ? { ...c, stackSameMetrics } : c
        )
      );
    },
    []
  );

  const handleAbbreviateNumbersChange = useCallback(
    (chartId: string, abbreviateNumbers: boolean) => {
      setCharts((prev) =>
        prev.map((c) =>
          c.id === chartId ? { ...c, abbreviateNumbers } : c
        )
      );
    },
    []
  );

  const handleChartTimeFilterChange = useCallback(
    (chartId: string, startTime: string | null, endTime: string | null) => {
      setCharts((prev) =>
        prev.map((c) =>
          c.id === chartId ? { ...c, startTime, endTime } : c
        )
      );
    },
    []
  );

  const handleBrushChange = useCallback(
    (
      chartId: string,
      startIndex: number | null,
      endIndex: number | null
    ) => {
      setCharts((prev) =>
        prev.map((c) =>
          c.id === chartId
            ? { ...c, brushStartIndex: startIndex, brushEndIndex: endIndex }
            : c
        )
      );
    },
    []
  );

  const addChart = useCallback(() => {
    setCharts((prev) => {
      const newId = String(prev.length + 1);
      return [
        ...prev,
        {
          id: newId,
          title: `Chart ${newId}`,
          colSpan: 12,
          dataSeries: [],
          stackSameMetrics: false,
          abbreviateNumbers: true,
        },
      ];
    });
  }, []);

  const removeChart = useCallback((chartId: string) => {
    setCharts((prev) => {
      // Removing the last chart leaves the user with a blank one rather than
      // an empty grid — matches the original UX.
      if (prev.length === 1) {
        const newId = String(prev.length + 1);
        return [
          {
            id: newId,
            title: "Blank Chart",
            colSpan: 12,
            dataSeries: [],
            stackSameMetrics: false,
            abbreviateNumbers: true,
          },
        ];
      }
      return prev.filter((chart) => chart.id !== chartId);
    });
  }, []);

  const handleChartReorder = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;
      setCharts((prev) => {
        const draggedIndex = prev.findIndex((c) => c.id === draggedId);
        const targetIndex = prev.findIndex((c) => c.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return prev;
        if (draggedIndex === targetIndex) return prev;

        const next = [...prev];
        const [draggedChart] = next.splice(draggedIndex, 1);
        next.splice(targetIndex, 0, draggedChart);
        return next;
      });
    },
    []
  );

  const filteredCharts = useCallback(
    (searchTerm: string) =>
      charts.filter((chart) =>
        chart.title.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [charts]
  );

  const resetToBlank = useCallback(() => {
    // Use a Date-stamped id so React remounts ConfigurableChart on a fresh
    // playground (the underlying chart components key off this id).
    const blank: ChartConfig[] = [
      {
        id: `chart-${Date.now()}`,
        title: "Chart 1",
        colSpan: 12,
        dataSeries: [],
        stackSameMetrics: false,
        abbreviateNumbers: true,
      },
    ];
    setCharts(blank);
    setSavedCharts(blank.map((chart) => ({ ...chart })));
  }, []);

  return {
    charts,
    savedCharts,
    chartDataMap,
    playgroundCharts,
    filteredCharts,
    setCharts,
    setSavedCharts,
    handleChartDataReady,
    handleColSpanChange,
    handleTitleChange,
    handleDataSeriesChange,
    handleStackSameMetricsChange,
    handleAbbreviateNumbersChange,
    handleChartTimeFilterChange,
    handleBrushChange,
    handleChartReorder,
    addChart,
    removeChart,
    resetToBlank,
  };
}
