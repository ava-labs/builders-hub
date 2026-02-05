"use client";

import { Grid3X3, Tag, BarChart3, TrendingUp, Minus, Sigma } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChartDisplaySettings } from "../types";

interface ChartDisplayControlProps {
  value: ChartDisplaySettings;
  onChange: (settings: Partial<ChartDisplaySettings>) => void;
  isCollageMode?: boolean;
}

const DISPLAY_OPTIONS: {
  key: keyof ChartDisplaySettings;
  label: string;
  icon: React.ReactNode;
  tooltip?: string;
}[] = [
  { key: "showGridLines", label: "Grid", icon: <Grid3X3 className="h-3.5 w-3.5" /> },
  { key: "showDataLabels", label: "Labels", icon: <Tag className="h-3.5 w-3.5" /> },
  { key: "showSummaryStats", label: "Stats", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { key: "showTrendIndicator", label: "Trend", icon: <TrendingUp className="h-3.5 w-3.5" />, tooltip: "Show percentage change from first to last value" },
  { key: "showAvgLine", label: "Avg", icon: <Minus className="h-3.5 w-3.5" />, tooltip: "Show average line across the chart" },
  { key: "showTotalLine", label: "Total", icon: <Sigma className="h-3.5 w-3.5" />, tooltip: "Show cumulative total line (purple)" },
];

// Options that don't work in collage mode
const COLLAGE_DISABLED_OPTIONS: (keyof ChartDisplaySettings)[] = ["showDataLabels", "showTrendIndicator", "showTotalLine"];

export function ChartDisplayControl({ value, onChange, isCollageMode = false }: ChartDisplayControlProps) {
  const renderButton = (option: typeof DISPLAY_OPTIONS[number], isDisabled: boolean = false) => (
    <button
      type="button"
      onClick={() => !isDisabled && onChange({ [option.key]: !value[option.key] })}
      disabled={isDisabled}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors border",
        isDisabled
          ? "bg-muted/50 text-muted-foreground/50 border-border/50 cursor-not-allowed"
          : value[option.key]
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-muted/80 hover:border-foreground/30"
      )}
    >
      {option.icon}
      {option.label}
    </button>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap gap-1">
        {DISPLAY_OPTIONS.map((option) => {
          const isDisabled = isCollageMode && COLLAGE_DISABLED_OPTIONS.includes(option.key);
          const tooltipText = isDisabled
            ? "Not available in collage mode"
            : option.tooltip;

          return tooltipText ? (
            <Tooltip key={option.key}>
              <TooltipTrigger asChild>{renderButton(option, isDisabled)}</TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {tooltipText}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span key={option.key}>{renderButton(option, isDisabled)}</span>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
