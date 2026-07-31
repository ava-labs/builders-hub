"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHIP_POP } from "@/components/audits/shared/motion";

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
              "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm transition-colors md:h-9 md:px-3.5",
              // Selected = red outline + wash (Foundations chips): red marks
              // active states, never a second CTA.
              selected
                ? "border-brand bg-brand/5 text-brand-deep dark:border-[#FF394A] dark:bg-[#FF394A]/10 dark:text-brand-soft"
                : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-white/15 dark:text-zinc-300 dark:hover:border-white/40",
            )}
          >
            {selected ? <Check aria-hidden className={cn("h-3 w-3", CHIP_POP)} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
