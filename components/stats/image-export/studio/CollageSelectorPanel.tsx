"use client";
import { ChevronUp, ChevronDown } from "lucide-react";
import { CollageMetricSelector } from "../CollageMetricSelector";
import { PlaygroundChartSelector } from "../PlaygroundChartSelector";
import type {
  CollageMetricConfig,
  CollageMetricData,
  PlaygroundChartData,
} from "../types";

interface CollageSelectorPanelProps {
  isPlaygroundMode: boolean;
  availableMetrics: CollageMetricConfig[];
  selectedMetrics: string[];
  onMetricSelectionChange: (metrics: string[]) => void;
  metricsData: Map<string, CollageMetricData>;

  playgroundCharts: PlaygroundChartData[];
  selectedPlaygroundChartIds: string[];
  onPlaygroundSelectionChange: (ids: string[]) => void;

  // Mobile collapsible state.
  mobileExpanded: boolean;
  onMobileExpandedChange: (expanded: boolean) => void;
}

// Wraps the metric/chart selector for collage mode with both a desktop
// sidebar layout and a mobile collapsible header. Keeping both layouts here
// so the orchestrator only renders the panel once.
export function CollageSelectorPanel({
  isPlaygroundMode,
  availableMetrics,
  selectedMetrics,
  onMetricSelectionChange,
  metricsData,
  playgroundCharts,
  selectedPlaygroundChartIds,
  onPlaygroundSelectionChange,
  mobileExpanded,
  onMobileExpandedChange,
}: CollageSelectorPanelProps) {
  return (
    <>
      {/* Mobile: collapsible. */}
      <div className="md:hidden border-b">
        <button
          onClick={() => onMobileExpandedChange(!mobileExpanded)}
          className={`w-full px-4 py-3 flex items-center ${mobileExpanded ? "justify-between" : "justify-center"}`}
        >
          <span className="flex items-center gap-2 text-sm font-normal">
            {mobileExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />{" "}
                {isPlaygroundMode
                  ? selectedPlaygroundChartIds.length
                  : selectedMetrics.length}{" "}
                {isPlaygroundMode ? "charts" : "metrics"} selected
              </>
            )}
          </span>
          {mobileExpanded && (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  if (isPlaygroundMode) {
                    const chartsWithData = playgroundCharts.filter(
                      (c) => c.data.length > 0 && c.seriesInfo.length > 0
                    );
                    onPlaygroundSelectionChange(
                      chartsWithData.slice(0, 9).map((c) => c.id)
                    );
                  } else {
                    onMetricSelectionChange(
                      availableMetrics.slice(0, 9).map((m) => m.metricKey)
                    );
                  }
                }}
                className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 transition-colors"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPlaygroundMode) {
                    onPlaygroundSelectionChange([]);
                  } else {
                    onMetricSelectionChange([]);
                  }
                }}
                className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </button>
        {mobileExpanded && (
          <div className="max-h-[300px] overflow-y-auto px-4 pb-4 overscroll-contain touch-pan-y">
            {isPlaygroundMode ? (
              <PlaygroundChartSelector
                availableCharts={playgroundCharts}
                selectedChartIds={selectedPlaygroundChartIds}
                onSelectionChange={onPlaygroundSelectionChange}
                hideHeader={true}
              />
            ) : (
              <CollageMetricSelector
                availableMetrics={availableMetrics}
                selectedMetrics={selectedMetrics}
                onSelectionChange={onMetricSelectionChange}
                metricsData={metricsData}
                hideHeader={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Desktop: persistent sidebar. */}
      <div className="hidden md:block w-[240px] border-r p-4 overflow-y-auto shrink-0 bg-background">
        {isPlaygroundMode ? (
          <PlaygroundChartSelector
            availableCharts={playgroundCharts}
            selectedChartIds={selectedPlaygroundChartIds}
            onSelectionChange={onPlaygroundSelectionChange}
          />
        ) : (
          <CollageMetricSelector
            availableMetrics={availableMetrics}
            selectedMetrics={selectedMetrics}
            onSelectionChange={onMetricSelectionChange}
            metricsData={metricsData}
          />
        )}
      </div>
    </>
  );
}
