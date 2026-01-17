"use client";

import { useRef, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BackgroundSettings, GradientDirection } from "../types";
import { BACKGROUND_COLORS, GRADIENT_PRESETS } from "../constants";

interface BackgroundControlProps {
  value: BackgroundSettings;
  onChange: (settings: Partial<BackgroundSettings>) => void;
}

const GRADIENT_DIRECTIONS: { id: GradientDirection; label: string; icon: string }[] = [
  { id: "to-right", label: "Right", icon: "→" },
  { id: "to-left", label: "Left", icon: "←" },
  { id: "to-bottom", label: "Down", icon: "↓" },
  { id: "to-top", label: "Up", icon: "↑" },
  { id: "to-br", label: "Bottom Right", icon: "↘" },
  { id: "to-bl", label: "Bottom Left", icon: "↙" },
  { id: "to-tr", label: "Top Right", icon: "↗" },
  { id: "to-tl", label: "Top Left", icon: "↖" },
];

const getGradientStyle = (from: string, to: string, direction: GradientDirection = "to-right") => {
  const directionMap: Record<GradientDirection, string> = {
    "to-right": "to right",
    "to-left": "to left",
    "to-bottom": "to bottom",
    "to-top": "to top",
    "to-br": "to bottom right",
    "to-bl": "to bottom left",
    "to-tr": "to top right",
    "to-tl": "to top left",
  };
  return `linear-gradient(${directionMap[direction]}, ${from}, ${to})`;
};

export function BackgroundControl({ value, onChange }: BackgroundControlProps) {
  const colorInputRef1 = useRef<HTMLInputElement>(null);
  const colorInputRef2 = useRef<HTMLInputElement>(null);
  const gradientFromRef = useRef<HTMLInputElement>(null);
  const gradientToRef = useRef<HTMLInputElement>(null);
  const [customColor1, setCustomColor1] = useState<string>("#3b82f6");
  const [customColor2, setCustomColor2] = useState<string>("#8b5cf6");

  const handleColorSelect = (color: string) => {
    onChange({ type: "solid", color });
  };

  const handleCustomColor1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor1(color);
    onChange({ type: "solid", color });
  };

  const handleCustomColor2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor2(color);
    onChange({ type: "solid", color });
  };

  const handleGradientSelect = (from: string, to: string) => {
    onChange({
      type: "gradient",
      gradientFrom: from,
      gradientTo: to,
      gradientDirection: value.gradientDirection || "to-right",
    });
  };

  const handleGradientFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ gradientFrom: e.target.value });
  };

  const handleGradientToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ gradientTo: e.target.value });
  };

  const handleClear = () => {
    onChange({ type: "solid", color: "transparent" });
  };

  const isSelected = (color: string) => value.type === "solid" && value.color === color;
  const isGradientSelected = (from: string, to: string) =>
    value.type === "gradient" && value.gradientFrom === from && value.gradientTo === to;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Background</label>
        <button
          type="button"
          onClick={handleClear}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Clear background"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Type toggle */}
      <div className="flex gap-1 p-1 bg-muted border border-border rounded-lg">
        <button
          type="button"
          onClick={() => onChange({ type: "solid" })}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            value.type === "solid"
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Solid
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: "gradient", gradientFrom: value.gradientFrom || "#3b82f6", gradientTo: value.gradientTo || "#8b5cf6" })}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            value.type === "gradient"
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Gradient
        </button>
      </div>

      {/* Solid colors */}
      {value.type === "solid" && (
        <div className="grid grid-cols-6 gap-2 overflow-visible p-1">
          {BACKGROUND_COLORS.slice(0, 6).map((colorOption) => (
            <button
              key={colorOption.id}
              type="button"
              onClick={() => handleColorSelect(colorOption.color)}
              title={colorOption.label}
              className={cn(
                "w-8 h-8 rounded-md border-2 transition-all",
                isSelected(colorOption.color)
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500",
                colorOption.id === "white" && "border-zinc-300 dark:border-zinc-600"
              )}
              style={{ backgroundColor: colorOption.color }}
            />
          ))}
          {BACKGROUND_COLORS.slice(6, 10).map((colorOption) => (
            <button
              key={colorOption.id}
              type="button"
              onClick={() => handleColorSelect(colorOption.color)}
              title={colorOption.label}
              className={cn(
                "w-8 h-8 rounded-md border-2 transition-all",
                isSelected(colorOption.color)
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
              )}
              style={{ backgroundColor: colorOption.color }}
            />
          ))}
          {/* Custom color pickers */}
          <button
            type="button"
            onClick={() => colorInputRef1.current?.click()}
            title={isSelected(customColor1) ? `Custom: ${customColor1}` : "Pick custom color"}
            className={cn(
              "w-8 h-8 rounded-md border-2 transition-all relative overflow-hidden group",
              isSelected(customColor1)
                ? "border-primary ring-2 ring-primary/30"
                : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 hover:scale-105"
            )}
            style={{
              background: isSelected(customColor1)
                ? customColor1
                : "conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)"
            }}
          >
            {!isSelected(customColor1) && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <Plus className="h-4 w-4 text-white drop-shadow-md" />
              </span>
            )}
            <input
              ref={colorInputRef1}
              type="color"
              value={customColor1}
              onChange={handleCustomColor1Change}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </button>
          <button
            type="button"
            onClick={() => colorInputRef2.current?.click()}
            title={isSelected(customColor2) ? `Custom: ${customColor2}` : "Pick custom color"}
            className={cn(
              "w-8 h-8 rounded-md border-2 transition-all relative overflow-hidden group",
              isSelected(customColor2)
                ? "border-primary ring-2 ring-primary/30"
                : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 hover:scale-105"
            )}
            style={{
              background: isSelected(customColor2)
                ? customColor2
                : "conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)"
            }}
          >
            {!isSelected(customColor2) && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <Plus className="h-4 w-4 text-white drop-shadow-md" />
              </span>
            )}
            <input
              ref={colorInputRef2}
              type="color"
              value={customColor2}
              onChange={handleCustomColor2Change}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </button>
        </div>
      )}

      {/* Gradient options */}
      {value.type === "gradient" && (
        <div className="space-y-3">
          {/* Gradient presets */}
          <div className="grid grid-cols-6 gap-2 overflow-visible p-1">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleGradientSelect(preset.from, preset.to)}
                title={preset.label}
                className={cn(
                  "w-8 h-8 rounded-md border-2 transition-all",
                  isGradientSelected(preset.from, preset.to)
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
                )}
                style={{ background: getGradientStyle(preset.from, preset.to, "to-right") }}
              />
            ))}
          </div>

          {/* Custom gradient colors */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">From</label>
              <button
                type="button"
                onClick={() => gradientFromRef.current?.click()}
                className="w-full h-8 rounded-md border-2 border-zinc-300 dark:border-zinc-600 relative overflow-hidden"
                style={{ backgroundColor: value.gradientFrom || "#3b82f6" }}
              >
                <input
                  ref={gradientFromRef}
                  type="color"
                  value={value.gradientFrom || "#3b82f6"}
                  onChange={handleGradientFromChange}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </button>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">To</label>
              <button
                type="button"
                onClick={() => gradientToRef.current?.click()}
                className="w-full h-8 rounded-md border-2 border-zinc-300 dark:border-zinc-600 relative overflow-hidden"
                style={{ backgroundColor: value.gradientTo || "#8b5cf6" }}
              >
                <input
                  ref={gradientToRef}
                  type="color"
                  value={value.gradientTo || "#8b5cf6"}
                  onChange={handleGradientToChange}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </button>
            </div>
          </div>

          {/* Gradient direction */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Direction</label>
            <div className="grid grid-cols-4 gap-1">
              {GRADIENT_DIRECTIONS.map((dir) => (
                <button
                  key={dir.id}
                  type="button"
                  onClick={() => onChange({ gradientDirection: dir.id })}
                  title={dir.label}
                  className={cn(
                    "h-7 rounded transition-colors flex items-center justify-center border",
                    value.gradientDirection === dir.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:border-foreground/30"
                  )}
                >
                  {dir.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
