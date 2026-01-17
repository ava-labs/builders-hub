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
import { TITLE_SIZE_OPTIONS } from "../constants";

interface TitleControlProps {
  value: TitleSettings;
  onChange: (settings: Partial<TitleSettings>) => void;
}

const STYLE_OPTIONS: { id: TitleStyle; fontWeight: string }[] = [
  { id: "bold", fontWeight: "font-bold" },
  { id: "normal", fontWeight: "font-normal" },
];

export function TitleControl({ value, onChange }: TitleControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Title</label>
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
    </div>
  );
}
