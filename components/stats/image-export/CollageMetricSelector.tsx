"use client";

import { Loader2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { CollageMetricConfig, CollageMetricData } from "./types";

interface CollageMetricSelectorProps {
  availableMetrics: CollageMetricConfig[];
  selectedMetrics: string[];
  onSelectionChange: (selected: string[]) => void;
  metricsData: Map<string, CollageMetricData>;
  maxSelections?: number;
}

interface SortableMetricItemProps {
  metric: CollageMetricConfig;
  isSelected: boolean;
  isLoading: boolean;
  hasError: boolean;
  onToggle: () => void;
}

function SortableMetricItem({
  metric,
  isSelected,
  isLoading,
  hasError,
  onToggle,
}: SortableMetricItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: metric.metricKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors",
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted border border-transparent"
      )}
    >
      {/* Drag handle - only visible for selected items */}
      {isSelected && (
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity -ml-1"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Clickable area */}
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center gap-3 min-w-0"
      >
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
      </button>

      {/* Status indicator - only show loading/error states for selected items */}
      {isSelected && (isLoading || hasError) && (
        <div className="shrink-0">
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : hasError ? (
            <span className="text-xs text-red-500">Error</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

const MAX_CHARTS = 9;

export function CollageMetricSelector({
  availableMetrics,
  selectedMetrics,
  onSelectionChange,
  metricsData,
  maxSelections = MAX_CHARTS,
}: CollageMetricSelectorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleToggle = (metricKey: string) => {
    if (selectedMetrics.includes(metricKey)) {
      // Remove from selection
      onSelectionChange(selectedMetrics.filter((k) => k !== metricKey));
    } else if (selectedMetrics.length < maxSelections) {
      // Add to selection (if under limit)
      onSelectionChange([...selectedMetrics, metricKey]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedMetrics.indexOf(active.id as string);
      const newIndex = selectedMetrics.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        onSelectionChange(arrayMove(selectedMetrics, oldIndex, newIndex));
      }
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

  // Separate selected and unselected metrics for display
  const selectedMetricsConfigs = selectedMetrics
    .map((key) => availableMetrics.find((m) => m.metricKey === key))
    .filter((m): m is CollageMetricConfig => m !== undefined);

  const unselectedMetrics = availableMetrics.filter(
    (m) => !selectedMetrics.includes(m.metricKey)
  );

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
            className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedMetrics.length === 0}
            className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Metric List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Selected metrics - sortable */}
        {selectedMetrics.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground px-3 mb-1.5">
              Selected (drag to reorder)
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedMetrics}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {selectedMetricsConfigs.map((metric) => {
                    const metricData = metricsData.get(metric.metricKey);
                    return (
                      <SortableMetricItem
                        key={metric.metricKey}
                        metric={metric}
                        isSelected={true}
                        isLoading={metricData?.isLoading ?? false}
                        hasError={!!metricData?.error}
                        onToggle={() => handleToggle(metric.metricKey)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Unselected metrics */}
        {unselectedMetrics.length > 0 && (
          <div>
            {selectedMetrics.length > 0 && (
              <p className="text-xs text-muted-foreground px-3 mb-1.5">
                Available
              </p>
            )}
            <div className="space-y-1">
              {unselectedMetrics.map((metric) => {
                const isDisabled = atMaxSelections;
                return (
                  <button
                    key={metric.metricKey}
                    type="button"
                    onClick={() => handleToggle(metric.metricKey)}
                    disabled={isDisabled}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                      "hover:bg-muted border border-transparent",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
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
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
