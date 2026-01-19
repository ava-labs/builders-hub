"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AspectRatio, CustomAspectRatio } from "../types";
import { ASPECT_RATIO_DIMENSIONS } from "../types";

interface AspectRatioControlProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
  customDimensions?: CustomAspectRatio;
  onCustomDimensionsChange?: (dimensions: CustomAspectRatio) => void;
}

// Helper to calculate GCD for ratio simplification
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// Helper to format ratio string
function formatRatio(width: number, height: number): string {
  const divisor = gcd(width, height);
  const simplifiedW = width / divisor;
  const simplifiedH = height / divisor;

  // If simplified numbers are too large, show decimal ratio
  if (simplifiedW > 100 || simplifiedH > 100) {
    return `${(width / height).toFixed(2)}:1`;
  }
  return `${simplifiedW}:${simplifiedH}`;
}

const RATIO_OPTIONS: {
  id: AspectRatio;
  icon: React.ReactNode;
  label: string;
  description: string;
  bestFor: string;
}[] = [
  {
    id: "social-card",
    label: "Social Card",
    description: "1.91:1 ratio",
    bestFor: "Twitter/X, LinkedIn posts",
    icon: (
      <svg className="w-6 h-3" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="22" height="10" rx="1" />
      </svg>
    ),
  },
  {
    id: "landscape",
    label: "Landscape",
    description: "16:9 ratio",
    bestFor: "Presentations, YouTube",
    icon: (
      <svg className="w-5 h-4" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="18" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: "square",
    label: "Square",
    description: "1:1 ratio",
    bestFor: "Instagram feed, Facebook",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="14" height="14" rx="1" />
      </svg>
    ),
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "4:5 ratio",
    bestFor: "Instagram posts (tall)",
    icon: (
      <svg className="w-4 h-5" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="14" height="18" rx="1" />
      </svg>
    ),
  },
  {
    id: "portrait",
    label: "Stories",
    description: "9:16 ratio",
    bestFor: "Instagram/TikTok Stories",
    icon: (
      <svg className="w-3 h-5" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="10" height="18" rx="1" />
      </svg>
    ),
  },
  {
    id: "collage",
    label: "Collage",
    description: "3:2 ratio",
    bestFor: "Multi-chart dashboards",
    icon: (
      <svg className="w-6 h-4" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="10" height="6" rx="1" />
        <rect x="13" y="1" width="10" height="6" rx="1" />
        <rect x="1" y="9" width="10" height="6" rx="1" />
        <rect x="13" y="9" width="10" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: "custom",
    label: "Custom",
    description: "Custom size",
    bestFor: "Any custom dimensions",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="14" height="14" rx="1" strokeDasharray="3 2" />
        <path d="M8 4v8M4 8h8" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export function AspectRatioControl({
  value,
  onChange,
  customDimensions,
  onCustomDimensionsChange,
}: AspectRatioControlProps) {
  // Local state for custom dimension inputs
  const [localWidth, setLocalWidth] = useState(customDimensions?.width?.toString() || "1200");
  const [localHeight, setLocalHeight] = useState(customDimensions?.height?.toString() || "800");

  // Sync local state when customDimensions prop changes
  useEffect(() => {
    if (customDimensions) {
      setLocalWidth(customDimensions.width.toString());
      setLocalHeight(customDimensions.height.toString());
    }
  }, [customDimensions]);

  // Clamp value between min and max
  const clampValue = useCallback((val: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, val));
  }, []);

  // Handle width change
  const handleWidthChange = useCallback((inputValue: string) => {
    setLocalWidth(inputValue);
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 4000 && onCustomDimensionsChange) {
      onCustomDimensionsChange({
        width: clampValue(parsed, 100, 4000),
        height: customDimensions?.height || 800,
      });
    }
  }, [onCustomDimensionsChange, customDimensions?.height, clampValue]);

  // Handle height change
  const handleHeightChange = useCallback((inputValue: string) => {
    setLocalHeight(inputValue);
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 4000 && onCustomDimensionsChange) {
      onCustomDimensionsChange({
        width: customDimensions?.width || 1200,
        height: clampValue(parsed, 100, 4000),
      });
    }
  }, [onCustomDimensionsChange, customDimensions?.width, clampValue]);

  // Handle blur - ensure valid value
  const handleWidthBlur = useCallback(() => {
    const parsed = parseInt(localWidth, 10);
    if (isNaN(parsed) || parsed < 100) {
      setLocalWidth("100");
      onCustomDimensionsChange?.({ width: 100, height: customDimensions?.height || 800 });
    } else if (parsed > 4000) {
      setLocalWidth("4000");
      onCustomDimensionsChange?.({ width: 4000, height: customDimensions?.height || 800 });
    }
  }, [localWidth, onCustomDimensionsChange, customDimensions?.height]);

  const handleHeightBlur = useCallback(() => {
    const parsed = parseInt(localHeight, 10);
    if (isNaN(parsed) || parsed < 100) {
      setLocalHeight("100");
      onCustomDimensionsChange?.({ width: customDimensions?.width || 1200, height: 100 });
    } else if (parsed > 4000) {
      setLocalHeight("4000");
      onCustomDimensionsChange?.({ width: customDimensions?.width || 1200, height: 4000 });
    }
  }, [localHeight, onCustomDimensionsChange, customDimensions?.width]);

  // Calculate current ratio string for custom dimensions
  const customRatioString = customDimensions
    ? formatRatio(customDimensions.width, customDimensions.height)
    : "3:2";

  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Aspect ratio</label>
      <div className="flex gap-1 flex-wrap">
        {RATIO_OPTIONS.map((option) => {
          // For custom, use actual custom dimensions if available
          const dimensions = option.id === "custom" && customDimensions
            ? customDimensions
            : ASPECT_RATIO_DIMENSIONS[option.id] || { width: 1200, height: 800 };

          return (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(option.id)}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-md transition-colors border",
                    value === option.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {option.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-3">
                <div className="flex gap-3 items-center">
                  {/* Mini preview */}
                  <div
                    className="border border-current rounded opacity-60"
                    style={{
                      width: Math.min(dimensions.width / 40, 40),
                      height: Math.min(dimensions.height / 40, 40),
                    }}
                  />
                  <div className="text-left">
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.id === "custom" && customDimensions
                        ? `${customDimensions.width}×${customDimensions.height}`
                        : `${dimensions.width}×${dimensions.height}`
                      }
                    </p>
                    <p className="text-xs text-primary mt-0.5">{option.bestFor}</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Custom dimensions inputs - shown when custom is selected */}
      {value === "custom" && onCustomDimensionsChange && (
        <div className="pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Width (px)</label>
              <input
                type="number"
                min={100}
                max={4000}
                value={localWidth}
                onChange={(e) => handleWidthChange(e.target.value)}
                onBlur={handleWidthBlur}
                className="w-full h-9 px-2 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <span className="text-muted-foreground mt-5">×</span>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Height (px)</label>
              <input
                type="number"
                min={100}
                max={4000}
                value={localHeight}
                onChange={(e) => handleHeightChange(e.target.value)}
                onBlur={handleHeightBlur}
                className="w-full h-9 px-2 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          {/* Live ratio display */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ratio: {customRatioString}</span>
            <span className="text-muted-foreground/60">100-4000px</span>
          </div>
        </div>
      )}
    </div>
  );
}
