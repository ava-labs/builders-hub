"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WatermarkSettings } from "../types";

interface WatermarkControlProps {
  value: WatermarkSettings;
  onChange: (settings: Partial<WatermarkSettings>) => void;
}

export function WatermarkControl({ value, onChange }: WatermarkControlProps) {
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
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      )}
    </div>
  );
}
