"use client";

import { cn } from "@/lib/utils";
import type { ExportQualitySettings, ExportResolution, ExportFormat } from "../types";

interface ExportQualityControlProps {
  value: ExportQualitySettings;
  onChange: (settings: Partial<ExportQualitySettings>) => void;
}

const RESOLUTION_OPTIONS: { id: ExportResolution; label: string }[] = [
  { id: "1x", label: "Standard" },
  { id: "2x", label: "High DPI" },
  { id: "3x", label: "Ultra HD" },
];

const FORMAT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: "png", label: "PNG" },
  { id: "jpeg", label: "JPEG" },
  { id: "svg", label: "SVG" },
];

export function ExportQualityControl({ value, onChange }: ExportQualityControlProps) {
  return (
    <div className="space-y-3">
      {/* Resolution */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Resolution</label>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {RESOLUTION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ resolution: option.id })}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                value.resolution === option.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ format: option.id })}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                value.format === option.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* JPEG Quality */}
      {value.format === "jpeg" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">Quality</label>
            <span className="text-xs text-muted-foreground">{value.jpegQuality}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            value={value.jpegQuality}
            onChange={(e) => onChange({ jpegQuality: parseInt(e.target.value) })}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      )}
    </div>
  );
}
