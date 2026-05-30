"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TitleSettings, TitleStyle, TitleSize } from "../types";
import { TITLE_SIZE_OPTIONS, TITLE_COLORS } from "../constants";

interface TitleControlProps {
  value: TitleSettings;
  onChange: (settings: Partial<TitleSettings>) => void;
}

const STYLE_OPTIONS: { id: TitleStyle; fontWeight: string }[] = [
  { id: "bold", fontWeight: "font-bold" },
  { id: "normal", fontWeight: "font-normal" },
];

export function TitleControl({ value, onChange }: TitleControlProps) {
  // Get current color - null means "default" (theme-based)
  const currentColor = value.color || null;
  // Check if current color is a preset or custom
  const isCustomColor = currentColor && !TITLE_COLORS.find(c => c.color === currentColor);

  return (
    <div className="space-y-3">
      <label className="text-sm text-muted-foreground">Title</label>

      {/* Style and Size row */}
      <div className="flex gap-2">
        <div className="flex gap-1">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ style: option.id })}
              className={cn(
                "flex items-center justify-center px-3 h-10 rounded-md text-sm transition-colors border",
                option.fontWeight,
                value.style === option.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground hover:border-foreground/30"
              )}
            >
              Aa
            </button>
          ))}
        </div>

        <Select
          value={value.size}
          onValueChange={(v) => onChange({ size: v as TitleSize })}
        >
          <SelectTrigger className="flex-1">
            <SelectValue>
              {TITLE_SIZE_OPTIONS.find((o) => o.id === value.size)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TITLE_SIZE_OPTIONS.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Color picker row */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Color</label>
        <div className="flex gap-1.5 items-center flex-wrap">
          {TITLE_COLORS.map((colorOption) => (
            <button
              key={colorOption.id}
              type="button"
              onClick={() => onChange({ color: colorOption.color || undefined })}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center text-[10px]",
                (colorOption.color === null ? !currentColor : currentColor === colorOption.color)
                  ? "border-foreground ring-2 ring-primary/30"
                  : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400"
              )}
              style={{
                backgroundColor: colorOption.color || "transparent",
              }}
              title={colorOption.label}
            >
              {colorOption.color === null && (
                <span className="text-muted-foreground">A</span>
              )}
            </button>
          ))}
          {/* Custom color picker */}
          <div className="relative">
            <input
              type="color"
              value={currentColor || "#000000"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                isCustomColor
                  ? "border-foreground ring-2 ring-primary/30"
                  : "border-dashed border-muted-foreground/50 hover:border-foreground/50"
              )}
              style={{
                backgroundColor: isCustomColor ? currentColor : "transparent"
              }}
            >
              {!isCustomColor && (
                <span className="text-[10px] text-muted-foreground">+</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
