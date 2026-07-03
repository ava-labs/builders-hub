"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type TimezoneOption = {
  /** IANA timezone id stored on the event (e.g. "Asia/Kolkata"). */
  value: string;
  /** Human label shown + searched (includes city names, e.g. "Mumbai/Kolkata"). */
  label: string;
  /** Standard GMT offset in hours, used only for ordering (-10 → +12). */
  offset: number;
};

/**
 * Curated list of the timezones we support for events. Grouped by region here for
 * readability; rendered sorted by GMT offset (see `TIMEZONE_OPTIONS`). The labels
 * embed city names so type-to-search matches them — e.g. typing "Mum" surfaces
 * "Mumbai/Kolkata (IST)".
 */
const CURATED_TIMEZONES: TimezoneOption[] = [
  { value: "America/New_York", label: "New York (EST/EDT) - GMT-5/-4", offset: -5 },
  { value: "America/Chicago", label: "Chicago (CST/CDT) - GMT-6/-5", offset: -6 },
  { value: "America/Denver", label: "Denver (MST/MDT) - GMT-7/-6", offset: -7 },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT) - GMT-8/-7", offset: -8 },
  { value: "America/Toronto", label: "Toronto (EST/EDT) - GMT-5/-4", offset: -5 },
  { value: "America/Vancouver", label: "Vancouver (PST/PDT) - GMT-8/-7", offset: -8 },
  { value: "America/Mexico_City", label: "Mexico City (CST/CDT) - GMT-6/-5", offset: -6 },
  { value: "America/Bogota", label: "Bogotá, Colombia (COT) - GMT-5", offset: -5 },
  { value: "America/Costa_Rica", label: "San José, Costa Rica (CST) - GMT-6", offset: -6 },
  { value: "America/Panama", label: "Panama City, Panama (EST) - GMT-5", offset: -5 },
  { value: "America/Caracas", label: "Caracas, Venezuela (VET) - GMT-4", offset: -4 },
  { value: "America/La_Paz", label: "La Paz, Bolivia (BOT) - GMT-4", offset: -4 },
  { value: "America/Lima", label: "Lima, Peru (PET) - GMT-5", offset: -5 },
  { value: "America/Sao_Paulo", label: "São Paulo, Brazil (BRT) - GMT-3", offset: -3 },
  { value: "America/Santiago", label: "Santiago, Chile (CLT) - GMT-3", offset: -3 },
  { value: "America/Buenos_Aires", label: "Buenos Aires, Argentina (ART) - GMT-3", offset: -3 },
  { value: "UTC", label: "UTC (Coordinated Universal Time) - GMT+0", offset: 0 },
  { value: "Europe/London", label: "London (GMT/BST) - GMT+0/+1", offset: 0 },
  { value: "Europe/Paris", label: "Paris (CET/CEST) - GMT+1/+2", offset: 1 },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST) - GMT+1/+2", offset: 1 },
  { value: "Europe/Rome", label: "Rome (CET/CEST) - GMT+1/+2", offset: 1 },
  { value: "Europe/Madrid", label: "Madrid (CET/CEST) - GMT+1/+2", offset: 1 },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST) - GMT+1/+2", offset: 1 },
  { value: "Europe/Zurich", label: "Zurich (CET/CEST) - GMT+1/+2", offset: 1 },
  { value: "Europe/Stockholm", label: "Stockholm (CET/CEST) - GMT+1/+2", offset: 1 },
  { value: "Asia/Jerusalem", label: "Jerusalem (IST) - GMT+2/+3", offset: 2 },
  { value: "Europe/Moscow", label: "Moscow (MSK) - GMT+3", offset: 3 },
  { value: "Asia/Dubai", label: "Dubai (GST) - GMT+4", offset: 4 },
  { value: "Asia/Kolkata", label: "Mumbai/Kolkata (IST) - GMT+5:30", offset: 5.5 },
  { value: "Asia/Shanghai", label: "Shanghai (CST) - GMT+8", offset: 8 },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT) - GMT+8", offset: 8 },
  { value: "Asia/Singapore", label: "Singapore (SGT) - GMT+8", offset: 8 },
  { value: "Australia/Perth", label: "Perth (AWST) - GMT+8", offset: 8 },
  { value: "Asia/Tokyo", label: "Tokyo (JST) - GMT+9", offset: 9 },
  { value: "Asia/Seoul", label: "Seoul (KST) - GMT+9", offset: 9 },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT) - GMT+10/+11", offset: 10 },
  { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT) - GMT+10/+11", offset: 10 },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT) - GMT+12/+13", offset: 12 },
  { value: "Pacific/Honolulu", label: "Honolulu (HST) - GMT-10", offset: -10 },
];

/** Ordered numerically by GMT offset (ascending), then alphabetically by label. */
const TIMEZONE_OPTIONS: TimezoneOption[] = [...CURATED_TIMEZONES].sort(
  (a, b) => a.offset - b.offset || a.label.localeCompare(b.label)
);

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Searchable, GMT-offset-ordered timezone picker. Drop-in replacement for the
 * plain `<Select>` previously used in the event editor — same value semantics
 * (stores the IANA id), but type-to-search by city/abbreviation/offset.
 */
export function TimezoneCombobox({
  value,
  onChange,
  placeholder = "Select timezone",
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => TIMEZONE_OPTIONS.find((tz) => tz.value === value),
    [value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {selected ? selected.label : value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {TIMEZONE_OPTIONS.map((tz) => (
                <CommandItem
                  key={tz.value}
                  // Searched text: friendly label (city names) + IANA id.
                  value={`${tz.label} ${tz.value}`}
                  onSelect={() => {
                    onChange(tz.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === tz.value ? "opacity-100" : "opacity-0"
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
  );
}
