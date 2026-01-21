"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PresetType } from "./types";
import type { CustomTemplate } from "./hooks/useCustomTemplates";

interface PresetSelectorProps {
  value: PresetType | string;
  onChange: (preset: PresetType | string) => void;
  showLabel?: boolean;
  customTemplates?: CustomTemplate[];
}

const PRESET_OPTIONS: { id: PresetType; label: string; description: string }[] = [
  { id: "default", label: "Social Card", description: "X, LinkedIn (1.91:1) 1200×628" },
  { id: "social-media", label: "Social Post", description: "Instagram, Square (1:1) 1080×1080" },
  { id: "slide-deck", label: "Presentation", description: "Landscape (16:9) 1200×675" },
  { id: "collage", label: "Collage", description: "Multi-chart grid (3:2) 1800×1200" },
  { id: "customize", label: "Customize", description: "Full control" },
];

export function PresetSelector({
  value,
  onChange,
  showLabel = true,
  customTemplates = [],
}: PresetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Find selected option from presets or custom templates
  const selectedPreset = PRESET_OPTIONS.find((opt) => opt.id === value);
  const isCustomTemplateValue = typeof value === "string" && value.startsWith("custom-");
  const selectedTemplate = isCustomTemplateValue
    ? customTemplates.find((t) => t.id === value)
    : null;
  const displayLabel = selectedTemplate?.name || selectedPreset?.label || "Select...";

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      {showLabel && <span className="text-sm text-muted-foreground mr-1">Preset</span>}

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between gap-2 px-3 py-1.5 text-sm",
              "bg-background border border-input rounded-md",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "min-w-0 md:min-w-[150px]"
            )}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Presets</DropdownMenuLabel>
          {PRESET_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className="flex items-center justify-between gap-2 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className={cn(value === option.id && "font-medium")}>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
              {value === option.id && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          ))}

          {customTemplates.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">My Templates</DropdownMenuLabel>
              {customTemplates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => handleSelect(template.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className={cn(
                    "truncate text-sm",
                    value === template.id && "font-medium"
                  )}>
                    {template.name}
                  </span>
                  {value === template.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
