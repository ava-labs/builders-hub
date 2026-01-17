"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CollageMetricConfig, CollageMetricData } from "./types";

interface CollageMetricSelectorProps {
  availableMetrics: CollageMetricConfig[];
  selectedMetrics: string[];
  onSelectionChange: (selected: string[]) => void;
  metricsData: Map<string, CollageMetricData>;
  maxSelections?: number;
}

const MAX_CHARTS = 9;

export function CollageMetricSelector({
  availableMetrics,
  selectedMetrics,
  onSelectionChange,
  metricsData,
  maxSelections = MAX_CHARTS,
}: CollageMetricSelectorProps) {
  const handleToggle = (metricKey: string) => {
    if (selectedMetrics.includes(metricKey)) {
      // Remove from selection
      onSelectionChange(selectedMetrics.filter((k) => k !== metricKey));
    } else if (selectedMetrics.length < maxSelections) {
      // Add to selection (if under limit)
      onSelectionChange([...selectedMetrics, metricKey]);
    }
  };

  const handleSelectAll = () => {
    const toSelect = availableMetrics.slice(0, maxSelections).map((m) => m.metricKey);
    onSelectionChange(toSelect);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const atMaxSelections = selectedMetrics.length >= maxSelections;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="text-sm font-medium">Select Metrics</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedMetrics.length} of {maxSelections} selected
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={selectedMetrics.length === Math.min(availableMetrics.length, maxSelections)}
            className="text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedMetrics.length === 0}
            className="text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Metric List */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {availableMetrics.map((metric) => {
          const isSelected = selectedMetrics.includes(metric.metricKey);
          const isDisabled = !isSelected && atMaxSelections;
          const metricData = metricsData.get(metric.metricKey);
          const isLoading = metricData?.isLoading;
          const hasError = metricData?.error;
          const hasData = metricData && metricData.data.length > 0;

          return (
            <button
              key={metric.metricKey}
              type="button"
              onClick={() => handleToggle(metric.metricKey)}
              disabled={isDisabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted border border-transparent",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Checkbox */}
              <div
                className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50"
                )}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-primary-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              {/* Color indicator */}
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: metric.color }}
              />

              {/* Metric info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{metric.title}</p>
                {metric.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {metric.description}
                  </p>
                )}
              </div>

              {/* Status indicator */}
              {isSelected && (
                <div className="shrink-0">
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : hasError ? (
                    <span className="text-xs text-red-500">Error</span>
                  ) : hasData ? (
                    <span className="text-xs text-green-600">Ready</span>
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      {selectedMetrics.length === 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Select metrics to include in your collage
          </p>
        </div>
      )}
    </div>
  );
}
