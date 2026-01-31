"use client";

import { GripVertical, BarChart3 } from "lucide-react";
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
import type { PlaygroundChartData } from "./types";

interface PlaygroundChartSelectorProps {
  availableCharts: PlaygroundChartData[];
  selectedChartIds: string[];
  onSelectionChange: (selected: string[]) => void;
  maxSelections?: number;
  hideHeader?: boolean;
}

interface SortableChartItemProps {
  chart: PlaygroundChartData;
  isSelected: boolean;
  onToggle: () => void;
}

function SortableChartItem({
  chart,
  isSelected,
  onToggle,
}: SortableChartItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chart.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.8 : 1,
  };

  const primaryColor = chart.color || chart.seriesInfo[0]?.color || "#e84142";
  const hasData = chart.data.length > 0 && chart.seriesInfo.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors",
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted border border-transparent",
        !hasData && "opacity-50"
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
        disabled={!hasData}
        className="flex-1 flex items-center gap-3 min-w-0"
      >
        {/* Color indicator */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: primaryColor }}
        />

        {/* Chart info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{chart.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {hasData
              ? `${chart.seriesInfo.length} series, ${chart.data.length} points`
              : "No data configured"}
          </p>
        </div>
      </button>

      {/* Chart icon indicator */}
      <div className="shrink-0">
        <BarChart3 className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
}

const MAX_CHARTS = 9;

export function PlaygroundChartSelector({
  availableCharts,
  selectedChartIds,
  onSelectionChange,
  maxSelections = MAX_CHARTS,
  hideHeader = false,
}: PlaygroundChartSelectorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter charts that have data (can be selected)
  const chartsWithData = availableCharts.filter(
    (chart) => chart.data.length > 0 && chart.seriesInfo.length > 0
  );

  const handleToggle = (chartId: string) => {
    const chart = availableCharts.find((c) => c.id === chartId);
    if (!chart || chart.data.length === 0 || chart.seriesInfo.length === 0) {
      return; // Don't allow selecting charts without data
    }

    if (selectedChartIds.includes(chartId)) {
      onSelectionChange(selectedChartIds.filter((id) => id !== chartId));
    } else if (selectedChartIds.length < maxSelections) {
      onSelectionChange([...selectedChartIds, chartId]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedChartIds.indexOf(active.id as string);
      const newIndex = selectedChartIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        onSelectionChange(arrayMove(selectedChartIds, oldIndex, newIndex));
      }
    }
  };

  const handleSelectAll = () => {
    const toSelect = chartsWithData.slice(0, maxSelections).map((c) => c.id);
    onSelectionChange(toSelect);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const atMaxSelections = selectedChartIds.length >= maxSelections;

  // Separate selected and unselected charts for display
  const selectedCharts = selectedChartIds
    .map((id) => availableCharts.find((c) => c.id === id))
    .filter((c): c is PlaygroundChartData => c !== undefined);

  const unselectedCharts = availableCharts.filter(
    (c) => !selectedChartIds.includes(c.id)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-medium">Select Charts</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedChartIds.length} of {maxSelections} selected
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={
                selectedChartIds.length ===
                Math.min(chartsWithData.length, maxSelections)
              }
              className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={selectedChartIds.length === 0}
              className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Chart List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Selected charts - sortable */}
        {selectedChartIds.length > 0 && (
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
                items={selectedChartIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {selectedCharts.map((chart) => (
                    <SortableChartItem
                      key={chart.id}
                      chart={chart}
                      isSelected={true}
                      onToggle={() => handleToggle(chart.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Unselected charts */}
        {unselectedCharts.length > 0 && (
          <div>
            {selectedChartIds.length > 0 && (
              <p className="text-xs text-muted-foreground px-3 mb-1.5">
                Available
              </p>
            )}
            <div className="space-y-1">
              {unselectedCharts.map((chart) => {
                const hasData =
                  chart.data.length > 0 && chart.seriesInfo.length > 0;
                const isDisabled = atMaxSelections || !hasData;
                const primaryColor =
                  chart.color || chart.seriesInfo[0]?.color || "#e84142";

                return (
                  <button
                    key={chart.id}
                    type="button"
                    onClick={() => handleToggle(chart.id)}
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
                      style={{ backgroundColor: primaryColor }}
                    />

                    {/* Chart info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {chart.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {hasData
                          ? `${chart.seriesInfo.length} series, ${chart.data.length} points`
                          : "No data configured"}
                      </p>
                    </div>

                    {/* Chart icon indicator */}
                    <BarChart3 className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {selectedChartIds.length === 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Select charts to include in your collage
          </p>
        </div>
      )}
    </div>
  );
}
