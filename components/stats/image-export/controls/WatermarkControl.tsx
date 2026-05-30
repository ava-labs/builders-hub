"use client";

import { Eye, EyeOff, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WatermarkSettings, WatermarkPosition, WatermarkLayer } from "../types";

interface WatermarkControlProps {
  value: WatermarkSettings;
  onChange: (settings: Partial<WatermarkSettings>) => void;
}

// 3x3 grid positions in order
const POSITION_GRID: WatermarkPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["center-left", "center", "center-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

export function WatermarkControl({ value, onChange }: WatermarkControlProps) {
  const currentPosition = value.position || "center";
  const currentLayer = value.layer || "back";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Watermark</label>
        <button
          type="button"
          onClick={() => onChange({ visible: !value.visible })}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            value.visible
              ? "text-foreground bg-muted"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={value.visible ? "Hide watermark" : "Show watermark"}
        >
          {value.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>

      {value.visible && (
        <>
          {/* Position selector - 3x3 grid */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Position</label>
            <div className="grid grid-cols-3 gap-1 w-fit">
              {POSITION_GRID.map((row, rowIndex) => (
                row.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => onChange({ position: pos })}
                    className={cn(
                      "w-6 h-6 rounded border transition-colors",
                      currentPosition === pos
                        ? "bg-primary border-primary"
                        : "bg-muted border-border hover:bg-muted/80 hover:border-foreground/30"
                    )}
                    title={pos.replace("-", " ")}
                  >
                    <span className="sr-only">{pos}</span>
                  </button>
                ))
              ))}
            </div>
          </div>

          {/* Layer selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Layer</label>
            <div className="flex items-center gap-1 bg-muted border border-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => onChange({ layer: "back" })}
                className={cn(
                  "flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors",
                  currentLayer === "back"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => onChange({ layer: "front" })}
                className={cn(
                  "flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors",
                  currentLayer === "front"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Front
              </button>
            </div>
          </div>

          {/* Opacity slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Opacity</label>
              <span className="text-xs text-muted-foreground">{Math.round(value.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={value.opacity * 100}
              onChange={(e) => onChange({ opacity: parseInt(e.target.value) / 100 })}
              className="w-full h-2 bg-muted border border-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </>
      )}
    </div>
  );
}
