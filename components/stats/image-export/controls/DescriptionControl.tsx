"use client";

import { Textarea } from "@/components/ui/textarea";

interface DescriptionControlProps {
  value: string;
  onChange: (description: string) => void;
  maxLength?: number;
}

export function DescriptionControl({
  value,
  onChange,
  maxLength = 200,
}: DescriptionControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Description</label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder="Add a custom description..."
        className="resize-none h-20 text-sm"
        maxLength={maxLength}
      />
    </div>
  );
}
