"use client";
import { ResponsiveContainer, LineChart, Line, Brush } from "recharts";
import { cn } from "@/lib/utils";
import { DATE_RANGE_PRESETS } from "../constants";
import type { BrushRange, DateRangePreset, Period } from "../types";
import { formatXAxis } from "./chart-utils";
import type { ChartDataPoint, SeriesInfo } from "./types";

interface DateRangeControlsProps {
  brushReferenceData: ChartDataPoint[];
  isCollageMode: boolean;
  seriesInfo: SeriesInfo[];
  primaryColor: string;
  period: Period | undefined;
  activePreset: DateRangePreset;
  safeBrushRange: { startIndex: number; endIndex: number };
  onPresetChange: (preset: DateRangePreset) => void;
  onBrushChange: (range: BrushRange) => void;
  onManualBrushChange: () => void;
}

export function DateRangeControls({
  brushReferenceData,
  isCollageMode,
  seriesInfo,
  primaryColor,
  period,
  activePreset,
  safeBrushRange,
  onPresetChange,
  onBrushChange,
  onManualBrushChange,
}: DateRangeControlsProps) {
  if (brushReferenceData.length === 0) return null;

  const brushDateKey =
    brushReferenceData[0]?.date !== undefined ? "date" : "day";

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-center gap-2">
        {DATE_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onPresetChange(preset.id as DateRangePreset)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors border",
              activePreset === preset.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-muted/80 hover:border-foreground/30"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="bg-muted rounded-lg p-2">
        <ResponsiveContainer width="100%" height={55}>
          <LineChart
            data={brushReferenceData}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <Brush
              dataKey={brushDateKey}
              height={45}
              stroke={primaryColor}
              fill={`${primaryColor}20`}
              startIndex={safeBrushRange.startIndex}
              endIndex={safeBrushRange.endIndex}
              onChange={(e: { startIndex?: number; endIndex?: number }) => {
                if (e.startIndex !== undefined && e.endIndex !== undefined) {
                  onBrushChange({
                    startIndex: e.startIndex,
                    endIndex: e.endIndex,
                  });
                  onManualBrushChange();
                }
              }}
              travellerWidth={8}
              tickFormatter={(value: string) => formatXAxis(value, period)}
            >
              <LineChart data={brushReferenceData}>
                <Line
                  type="monotone"
                  dataKey={
                    isCollageMode ? "value" : seriesInfo[0]?.id || "value"
                  }
                  stroke={primaryColor}
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </Brush>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
