"use client";

import { cn } from "@/lib/utils";
import type { Padding, BackgroundSettings } from "../types";
import { PADDING_OPTIONS } from "../constants";

interface PaddingControlProps {
  value: Padding;
  onChange: (padding: Padding) => void;
  borderRadius: number;
  onBorderRadiusChange: (radius: number) => void;
}

export function PaddingControl({
  value,
  onChange,
  borderRadius,
  onBorderRadiusChange
}: PaddingControlProps) {
  // Find the closest valid padding value
  const getClosestPadding = (val: number): Padding => {
    let closest: Padding = PADDING_OPTIONS[0];
    let minDiff = Math.abs(val - closest);

    for (const opt of PADDING_OPTIONS) {
      const diff = Math.abs(val - opt);
      if (diff < minDiff) {
        minDiff = diff;
        closest = opt;
      }
    }
    return closest;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    onChange(getClosestPadding(val));
  };

  return (
    <div className="space-y-4">
      {/* Padding */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">Padding</label>
          <span className="text-sm text-muted-foreground">{value}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="32"
          step="8"
          value={value}
          onChange={handleSliderChange}
          className="w-full h-2 bg-muted dark:bg-muted border border-border rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between">
          {PADDING_OPTIONS.map((padding) => (
            <button
              key={padding}
              type="button"
              onClick={() => onChange(padding)}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors",
                value === padding
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {padding}
            </button>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">Border Radius</label>
          <span className="text-sm text-muted-foreground">{borderRadius}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="24"
          value={borderRadius}
          onChange={(e) => onBorderRadiusChange(parseInt(e.target.value))}
          className="w-full h-2 bg-muted dark:bg-muted border border-border rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>
    </div>
  );
}
