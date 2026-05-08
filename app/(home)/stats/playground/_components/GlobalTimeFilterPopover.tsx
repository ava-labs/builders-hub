"use client";
import { format } from "date-fns";
import { CalendarIcon, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GlobalTimeFilterState } from "../_hooks/useGlobalTimeFilter";

interface GlobalTimeFilterPopoverProps {
  filter: GlobalTimeFilterState;
}

// Calendar-range + start/end time inputs, opened from the controls bar.
// Owns no state of its own; reads/writes through the `filter` hook bag.
export function GlobalTimeFilterPopover({
  filter,
}: GlobalTimeFilterPopoverProps) {
  const {
    globalStartTime,
    globalEndTime,
    tempGlobalStartTime,
    tempGlobalEndTime,
    showPopover,
    globalDateRange,
    setShowPopover,
    setTempGlobalStartTime,
    setTempGlobalEndTime,
    applyTempRange,
    clearRange,
  } = filter;

  const triggerLabel = (() => {
    if (tempGlobalStartTime && tempGlobalEndTime) {
      return `${format(tempGlobalStartTime, "MMM d")} - ${format(tempGlobalEndTime, "MMM d")}`;
    }
    if (tempGlobalStartTime) return format(tempGlobalStartTime, "PPP");
    if (globalDateRange.from && globalDateRange.to) {
      return `${format(globalDateRange.from, "MMM d")} - ${format(globalDateRange.to, "MMM d")}`;
    }
    if (globalDateRange.from) return format(globalDateRange.from, "PPP");
    return "Date range";
  })();

  const hasAnyValue =
    !!globalStartTime ||
    !!globalEndTime ||
    !!tempGlobalStartTime ||
    !!tempGlobalEndTime;

  return (
    <Popover open={showPopover} onOpenChange={setShowPopover}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 h-9 sm:h-10 rounded-lg border border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white hover:bg-[#f5f5f6] dark:hover:bg-neutral-750 cursor-pointer",
            !globalDateRange.from &&
              !globalDateRange.to &&
              "text-neutral-500 dark:text-neutral-400"
          )}
        >
          <CalendarIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
          <span className="text-xs sm:text-sm whitespace-nowrap hidden sm:inline">
            {triggerLabel}
          </span>
          {hasAnyValue && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                clearRange();
              }}
              className="ml-0.5 sm:ml-1 h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors cursor-pointer"
              aria-label="Clear date filter"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  clearRange();
                }
              }}
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={{
            from: tempGlobalStartTime,
            to: tempGlobalEndTime,
          }}
          onSelect={(range) => {
            // Preserve any time component the user already configured;
            // otherwise default to start-of-day / end-of-day.
            if (range?.from) {
              const newDate = new Date(range.from);
              if (tempGlobalStartTime) {
                newDate.setHours(
                  tempGlobalStartTime.getHours(),
                  tempGlobalStartTime.getMinutes(),
                  0,
                  0
                );
              } else {
                newDate.setHours(0, 0, 0, 0);
              }
              setTempGlobalStartTime(newDate);
            } else {
              setTempGlobalStartTime(undefined);
            }

            if (range?.to) {
              const newDate = new Date(range.to);
              if (tempGlobalEndTime) {
                newDate.setHours(
                  tempGlobalEndTime.getHours(),
                  tempGlobalEndTime.getMinutes(),
                  0,
                  0
                );
              } else {
                newDate.setHours(23, 59, 0, 0);
              }
              setTempGlobalEndTime(newDate);
            } else {
              setTempGlobalEndTime(undefined);
            }
          }}
          initialFocus
        />
        <div className="p-3 border-t space-y-2">
          <TimeRow
            label="Start:"
            value={tempGlobalStartTime}
            onChange={(value) => setTempGlobalStartTime(value)}
            defaultStr="00:00"
          />
          <TimeRow
            label="End:"
            value={tempGlobalEndTime}
            onChange={(value) => setTempGlobalEndTime(value)}
            defaultStr="23:59"
          />
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={applyTempRange}
              variant="outline"
              size="sm"
              className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              title="Reload data"
            >
              <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
              Reload
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TimeRowProps {
  label: string;
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  defaultStr: string;
}

function TimeRow({ label, value, onChange, defaultStr }: TimeRowProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[50px]">
        {label}
      </label>
      <Input
        type="time"
        value={value ? value.toTimeString().slice(0, 5) : defaultStr}
        onChange={(e) => {
          const [hours, minutes] = e.target.value.split(":").map(Number);
          if (value) {
            const updated = new Date(value);
            updated.setHours(hours, minutes, 0, 0);
            onChange(updated);
          } else {
            // No date yet — anchor to today so the time field becomes editable.
            const today = new Date();
            today.setHours(hours, minutes, 0, 0);
            onChange(today);
          }
        }}
        className="text-xs sm:text-sm"
        disabled={!value}
      />
    </div>
  );
}
