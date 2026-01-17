"use client";

import { Grid3X3, Tag, BarChart3, TrendingUp, Minus } from "lucide-react";
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
];

export function ChartDisplayControl({ value, onChange }: ChartDisplayControlProps) {
  const renderButton = (option: typeof DISPLAY_OPTIONS[number]) => (
    <button
      type="button"
      onClick={() => onChange({ [option.key]: !value[option.key] })}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors border",
        value[option.key]
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
        {DISPLAY_OPTIONS.map((option) =>
          option.tooltip ? (
            <Tooltip key={option.key}>
              <TooltipTrigger asChild>{renderButton(option)}</TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {option.tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span key={option.key}>{renderButton(option)}</span>
          )
        )}
      </div>
    </TooltipProvider>
  );
}
