"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AspectRatio } from "../types";
import { ASPECT_RATIO_DIMENSIONS } from "../types";

interface AspectRatioControlProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
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
];

export function AspectRatioControl({ value, onChange }: AspectRatioControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Aspect ratio</label>
      <div className="flex gap-1">
        {RATIO_OPTIONS.map((option) => {
          const dimensions = ASPECT_RATIO_DIMENSIONS[option.id];
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
                      width: dimensions.width / 40,
                      height: dimensions.height / 40,
                    }}
                  />
                  <div className="text-left">
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{dimensions.width}×{dimensions.height}</p>
                    <p className="text-xs text-primary mt-0.5">{option.bestFor}</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
