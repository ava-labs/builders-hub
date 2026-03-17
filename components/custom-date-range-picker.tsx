"use client";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { differenceInCalendarDays, subDays, subMonths, format } from "date-fns";
import { CalendarDays, ArrowRight, RotateCcw } from "lucide-react";
import type { DateRange } from "react-day-picker";

const MAX_DAYS = 183;

const QUICK_PRESETS = [
  { label: "14D", days: 14 },
  { label: "45D", days: 45 },
  { label: "60D", days: 60 },
  { label: "6M", days: 183 },
] as const;

interface CustomDateRangePickerProps {
  customRange: DateRange | undefined;
  setCustomRange: (range: DateRange | undefined) => void;
  isCustomActive: boolean;
  onApply: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeRangeLabel: string | null;
}

export function CustomDateRangePicker({
  customRange,
  setCustomRange,
  isCustomActive,
  onApply,
  open,
  onOpenChange,
  timeRangeLabel,
}: CustomDateRangePickerProps) {
  const hasFullRange = customRange?.from && customRange?.to;
  const dayCount = hasFullRange ? differenceInCalendarDays(customRange.to!, customRange.from!) + 1 : 0;
  const isOverLimit = dayCount > MAX_DAYS;

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = subDays(to, days - 1);
    setCustomRange({ from, to });
    // Defer apply to next tick so state updates first
    setTimeout(() => onApply(), 0);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
            isCustomActive
              ? "bg-zinc-700 text-white border-zinc-600"
              : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <CalendarDays className="w-3 h-3" />
          {timeRangeLabel || "Custom"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-zinc-900 border-zinc-700/80 shadow-2xl shadow-black/50 rounded-xl"
        align="end"
      >
        {/* Quick presets + date display */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
          {/* Quick presets */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mr-1">Quick</span>
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.days)}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date range display */}
          <div className="flex items-center gap-2 text-sm">
            <span className={`font-medium ${customRange?.from ? "text-white" : "text-zinc-600"}`}>
              {customRange?.from ? format(customRange.from, "MMM d, yyyy") : "Start date"}
            </span>
            <ArrowRight className={`w-3.5 h-3.5 ${hasFullRange ? "text-emerald-500" : "text-zinc-700"}`} />
            <span className={`font-medium ${customRange?.to ? "text-white" : "text-zinc-600"}`}>
              {customRange?.to ? format(customRange.to, "MMM d, yyyy") : "End date"}
            </span>
            {hasFullRange && (
              <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isOverLimit
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              }`}>
                {dayCount}d{isOverLimit && ` / ${MAX_DAYS} max`}
              </span>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="p-3">
          <Calendar
            mode="range"
            selected={customRange}
            onSelect={(range: DateRange | undefined) => {
              setCustomRange(range);
              // Auto-apply when both dates are selected and within limit
              if (range?.from && range?.to) {
                const span = differenceInCalendarDays(range.to, range.from);
                if (span <= MAX_DAYS) {
                  onApply();
                }
              }
            }}
            disabled={[
              { before: subMonths(new Date(), 6) },
              { after: new Date() },
            ]}
            numberOfMonths={2}
            classNames={{
              months: "flex gap-6",
              month: "space-y-3",
              caption_label: "text-sm font-semibold text-zinc-200",
              nav: "flex items-center gap-1",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "text-zinc-500 w-9 font-medium text-[0.75rem] text-center",
              row: "flex w-full mt-1",
              day: "h-9 w-9 text-center text-sm p-0 relative",
              today: "ring-1 ring-emerald-500/50 rounded-md",
              outside: "text-zinc-700 opacity-40",
              disabled: "text-zinc-700 opacity-30 cursor-not-allowed",
              range_middle: "bg-emerald-500/15 rounded-none",
              range_start: "bg-emerald-600 text-white rounded-l-md rounded-r-none font-semibold",
              range_end: "bg-emerald-600 text-white rounded-r-md rounded-l-none font-semibold",
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 pt-2 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => setCustomRange(undefined)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          {isOverLimit && (
            <span className="text-xs text-red-400">Max {MAX_DAYS} days</span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
