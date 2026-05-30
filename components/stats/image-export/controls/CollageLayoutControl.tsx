"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getGridLayoutOptions } from "../constants";

interface CollageLayoutControlProps {
  metricCount: number;
  value: { cols: number; rows: number } | null; // null = auto
  onChange: (layout: { cols: number; rows: number } | null) => void;
}

export function CollageLayoutControl({
  metricCount,
  value,
  onChange,
}: CollageLayoutControlProps) {
  const layoutOptions = getGridLayoutOptions(metricCount);

  // Don't show if only 1 metric (no layout choice needed)
  if (metricCount <= 1) {
    return null;
  }

  // Check if current value matches an option
  const isAutoSelected = value === null;
  const isLayoutSelected = (cols: number, rows: number) => {
    if (cols === 0 && rows === 0) return isAutoSelected;
    return value?.cols === cols && value?.rows === rows;
  };

  // Generate grid preview SVG
  const renderGridPreview = (cols: number, rows: number, filled: number) => {
    const cellWidth = 24 / cols;
    const cellHeight = 16 / rows;
    const gap = 1;

    const cells = [];
    let cellIndex = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isFilled = cellIndex < filled;
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={c * cellWidth + gap / 2}
            y={r * cellHeight + gap / 2}
            width={cellWidth - gap}
            height={cellHeight - gap}
            rx={0.5}
            fill={isFilled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={isFilled ? 0 : 0.5}
            opacity={isFilled ? 1 : 0.3}
          />
        );
        cellIndex++;
      }
    }

    return (
      <svg
        className="w-6 h-4"
        viewBox="0 0 24 16"
        fill="none"
      >
        {cells}
      </svg>
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Grid layout</label>
      <div className="flex gap-1 flex-wrap">
        {layoutOptions.map((option) => {
          const isAuto = option.cols === 0 && option.rows === 0;
          const selected = isLayoutSelected(option.cols, option.rows);

          return (
            <Tooltip key={option.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(isAuto ? null : { cols: option.cols, rows: option.rows })}
                  className={cn(
                    "flex items-center justify-center h-10 rounded-md transition-colors border",
                    isAuto ? "w-14 text-xs font-medium" : "w-10",
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {isAuto ? (
                    "Auto"
                  ) : (
                    renderGridPreview(option.cols, option.rows, metricCount)
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-2">
                <div className="text-center">
                  <p className="font-medium text-sm">{option.label}</p>
                  {!isAuto && (
                    <p className="text-xs text-muted-foreground">
                      {option.cols * option.rows === metricCount
                        ? "Perfect fit"
                        : `${option.cols * option.rows - metricCount} empty cell${option.cols * option.rows - metricCount > 1 ? "s" : ""}`}
                    </p>
                  )}
                  {isAuto && (
                    <p className="text-xs text-muted-foreground">
                      Automatically determine layout
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
