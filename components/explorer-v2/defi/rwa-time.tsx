"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { SectionHeader } from "@/components/explorer-v2/ui";
import type { DayWindow, RangeChoice } from "@/lib/rwa/series";
import type { DatePreset, TimeInterval } from "@/lib/rwa/types";
import { CHIP, OFF, ON } from "./ProtocolFilters";

/* The pilot's time controls, the old dashboard's: an interval (daily,
   weekly, monthly) and a range (a preset, or any span picked on a
   calendar, two months wide, one on a phone). Each chart section
   carries its own pair, as before. */

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];
const PRESET_LABEL = Object.fromEntries(PRESETS.map((p) => [p.value, p.label])) as Record<DatePreset, string>;
const DAY_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const INTERVALS: { v: TimeInterval; label: string }[] = [
  { v: "daily", label: "Daily" },
  { v: "weekly", label: "Weekly" },
  { v: "monthly", label: "Monthly" },
];

const twoDigits = (n: number) => String(n).padStart(2, "0");
/** a calendar pick, local midnight, as its own calendar day */
export const dayKey = (d: Date) => `${d.getFullYear()}-${twoDigits(d.getMonth() + 1)}-${twoDigits(d.getDate())}`;
/** a day as the calendar's local date */
export const localDate = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

/** a calendar click: the first starts a range, the second closes it, earlier day first. The picker counts
 *  clicks itself, since the day picker reads a first click as a whole one-day range */
export function nextPick(start: Date | undefined, day: Date): { start: Date } | { from: string; to: string } {
  if (!start) return { start: day };
  const [a, b] = day < start ? [day, start] : [start, day];
  return { from: dayKey(a), to: dayKey(b) };
}

/** "All time", "Last 30 days", or "Oct 1, 2025 to Sep 30, 2026" */
export function rangeLabel(choice: RangeChoice): string {
  if ("preset" in choice) return PRESET_LABEL[choice.preset];
  return `${DAY_LABEL.format(new Date(`${choice.from}T00:00:00Z`))} to ${DAY_LABEL.format(new Date(`${choice.to}T00:00:00Z`))}`;
}

/** a section's title with its time controls: beside it from md up, under it on a phone, so the title never truncates */
export function TimedHeader({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
      <SectionHeader label={label} className="min-w-0 md:flex-1" />
      <span className="flex flex-wrap items-center gap-2 md:justify-end" data-export-hidden>
        {children}
      </span>
    </div>
  );
}

export function IntervalSwitch({ id, value, onChange }: { id: string; value: TimeInterval; onChange: (v: TimeInterval) => void }) {
  return <ViewSwitch id={id} value={value} onChange={onChange} options={INTERVALS} />;
}

/** the range control: a chip with the range's name; presets and a calendar in its popover. `shown` is the window the choice covers now, for
 *  the calendar's highlight; `bounds` the days with readings, the only ones the calendar offers */
export function RangePicker({ value, shown, bounds, onChange }: { value: RangeChoice; shown?: DayWindow; bounds?: DayWindow; onChange: (choice: RangeChoice) => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  // the first day of a range being picked; a new opening starts a fresh pick
  const [start, setStart] = useState<Date | undefined>();

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    setPhone(query.matches);
    const follow = (e: MediaQueryListEvent) => setPhone(e.matches);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  const active = "preset" in value ? value.preset : null;
  const highlight = start ? { from: start, to: undefined } : shown ? { from: localDate(shown.from), to: localDate(shown.to) } : undefined;
  const pickPreset = (preset: DatePreset) => {
    setStart(undefined);
    onChange({ preset });
    setOpen(false);
  };
  const presetButtons = (row: boolean) =>
    PRESETS.map((p) => (
      <button
        key={p.value}
        type="button"
        aria-pressed={active === p.value}
        onClick={() => pickPreset(p.value)}
        className={cn(CHIP, active === p.value ? ON : OFF, row ? "shrink-0" : "w-full justify-start")}
      >
        {p.label}
      </button>
    ));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setStart(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={cn(CHIP, OFF)} aria-label={`Date range: ${rangeLabel(value)}`}>
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
          {rangeLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-auto max-w-[95vw] rounded-none border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col sm:flex-row">
          {/* a phone lists the presets in a row above the calendar */}
          <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 p-2 sm:hidden dark:border-zinc-800">{presetButtons(true)}</div>
          <Calendar
            mode="range"
            captionLayout="dropdown"
            startMonth={bounds ? localDate(bounds.from) : new Date(2024, 0)}
            endMonth={bounds ? localDate(bounds.to) : new Date(new Date().getFullYear() + 1, 11)}
            disabled={bounds ? [{ before: localDate(bounds.from) }, { after: localDate(bounds.to) }] : undefined}
            defaultMonth={highlight?.from ?? new Date()}
            selected={highlight}
            numberOfMonths={phone ? 1 : 2}
            onSelect={(_range, day) => {
              const pick = nextPick(start, day);
              if ("start" in pick) {
                setStart(pick.start);
                return;
              }
              setStart(undefined);
              onChange(pick);
              setOpen(false);
            }}
          />
          <div className="hidden min-w-[9.5rem] flex-col gap-1 border-l border-zinc-200 p-3 sm:flex dark:border-zinc-800">{presetButtons(false)}</div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
