"use client";

import { Label } from "@/components/ui/label";
import { AlarmClock, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { useState, useMemo } from "react";
import { cn } from "@/utils/cn";

interface TimezoneInfo {
  id: string;
  label: string;
  offset: number;
  offsetString: string;
}

/**
 * Get all supported timezones with their current offsets using native Intl API
 */
function getAllTimezones(): TimezoneInfo[] {
  const timezones = Intl.supportedValuesOf('timeZone');
  console.debug('Supported timezones:', timezones);
  const now = new Date();
  
  return timezones.map((tz) => {
    const offset = getTimezoneOffset(tz, now);
    const offsetString = formatOffset(offset);
    const label = formatTimezoneLabel(tz, offsetString);
    
    return {
      id: tz,
      label,
      offset,
      offsetString,
    };
  }).sort((a, b) => a.offset - b.offset);
}

/**
 * Format offset in minutes to string like "GMT-05:00"
 */
function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `GMT${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Format timezone label: "(GMT-05:00) America/New_York"
 */
function formatTimezoneLabel(tzId: string, offsetString: string): string {
  return `(${offsetString}) ${tzId}`;
}

/**
 * Gets the UTC offset in minutes for a timezone at a given date
 */
function getTimezoneOffset(tz: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}



/**
 * Check if a timezone ID is valid
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a timezone - validates it exists or returns empty string
 */
export function resolveTimezone(tz: string): string {
  if (!tz) return '';
  return isValidTimezone(tz) ? tz : '';
}

type Props = {
  timeZone: string;
  setTimeZone: React.Dispatch<React.SetStateAction<string>>;
};

export function TimeZoneSelect({ timeZone, setTimeZone }: Props) {
  const [open, setOpen] = useState(false);
  
  // Memoize timezone list - computed once per component mount
  const timezones = useMemo(() => getAllTimezones(), []);
  
  // Find current timezone info for display
  const currentTz = useMemo(() => 
    timezones.find(tz => tz.id === timeZone), 
    [timezones, timeZone]
  );

  return (
    <div
      className="flex w-full max-w-md items-center gap-1.5 text-zinc-400"
      color="#a1a1aa"
    >
      <Label
        htmlFor="timezone"
        className="pr-3 dark:text-zinc-50 text-zinc-900 hidden md:inline"
      >
        Time Zone:{" "}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[270px] justify-between"
          >
            <AlarmClock
              className="h-5 w-5 !text-zinc-600 dark:!text-zinc-400"
            />
            <p className="!text-zinc-600 dark:!text-zinc-400 truncate">
              {currentTz
                ? currentTz.label.slice(0, 25) + (currentTz.label.length > 25 ? '...' : '')
                : "Select time zone"}
            </p>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 !text-zinc-600 dark:!text-zinc-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
          <Command className="w-full">
            <CommandInput placeholder="Search time zone..." />
            <CommandList>
              <CommandEmpty>No time zone found.</CommandEmpty>
              <CommandGroup>
                {timezones.map((tz) => (
                  <CommandItem
                    key={tz.id}
                    value={`${tz.id} ${tz.label}`}
                    onSelect={() => {
                      setTimeZone(timeZone === tz.id ? "" : tz.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 !text-zinc-600 dark:!text-zinc-400",
                        timeZone === tz.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {tz.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
