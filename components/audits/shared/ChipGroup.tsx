"use client";

import { cn } from "@/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
}

export const asChips = (options: readonly string[]): ChipOption[] =>
  options.map((option) => ({ value: option, label: option }));

interface ChipGroupProps {
  options: readonly ChipOption[];
  /** Selected values (single-select passes at most one). */
  value: readonly string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  "aria-label"?: string;
}

/**
 * The wizard's chip selector (design 1b renders every option inline as a
 * toggle chip, both for multi picks like project types/services and single
 * picks like deployment target/urgency).
 */
export function ChipGroup({
  options,
  value,
  onChange,
  multiple = false,
  "aria-label": ariaLabel,
}: ChipGroupProps) {
  const toggle = (option: string) => {
    const selected = value.includes(option);
    if (multiple) {
      onChange(selected ? value.filter((v) => v !== option) : [...value, option]);
      return;
    }
    onChange(selected ? [] : [option]);
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option.value)}
            className={cn(
              "h-11 cursor-pointer rounded-full border px-4 text-sm transition-colors md:h-9 md:px-3.5",
              selected
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-white/15 dark:text-zinc-300 dark:hover:border-white/40",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
