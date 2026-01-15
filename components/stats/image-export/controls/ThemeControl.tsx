"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExportTheme } from "../types";

interface ThemeControlProps {
  value: ExportTheme;
  onChange: (theme: ExportTheme) => void;
}

const THEME_OPTIONS: { id: ExportTheme; label: string; icon: React.ReactNode }[] = [
  { id: "auto", label: "Auto", icon: <Monitor className="h-4 w-4" /> },
  { id: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { id: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
];

export function ThemeControl({ value, onChange }: ThemeControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Export Theme</label>
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              value === option.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === "auto" && "Uses your current theme setting"}
        {value === "light" && "Always exports with light background"}
        {value === "dark" && "Always exports with dark background"}
      </p>
    </div>
  );
}
