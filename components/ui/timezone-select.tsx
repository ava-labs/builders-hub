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
import { useState } from "react";
import { cn } from "@/utils/cn";

// Mapping of UTC offsets to major cities/regions
export const timezoneMap: Record<string, string[]> = {
  "Pacific/Midway": ["(GMT -11:00) Baker Island, US Minor Outlying Islands"],
  "Pacific/Pago_Pago": ["(GMT -11:00) Pago Pago, American Samoa"],
  "Pacific/Honolulu": ["(GMT -10:00) Honolulu, Hawaii"],
  "America/Anchorage": ["(GMT -09:00) Anchorage, Alaska"],
  "America/Los_Angeles": ["(GMT -08:00) Los Angeles, Vancouver"],
  "America/Denver": ["(GMT -07:00) Phoenix, Denver"],
  "America/Chicago": ["(GMT -06:00) Chicago, Mexico City"],
  "America/New_York": ["(GMT -05:00) Bogotá, New York"],
  "America/Santiago": ["(GMT -04:00) Santiago, Santo Domingo"],
  "America/Sao_Paulo": ["(GMT -03:00) São Paulo, Buenos Aires"],
  "America/Noronha": ["(GMT -02:00) Fernando de Noronha, Brazil"],
  "Atlantic/Azores": ["(GMT -01:00) Azores, Cape Verde"],
  "Europe/London": ["(GMT +00:00) London, Dublin"],
  "Europe/Berlin": ["(GMT +01:00) Berlin, Paris"],
  "Africa/Cairo": ["(GMT +02:00) Cairo, Jerusalem"],
  "Europe/Istanbul": ["(GMT +03:00) Moscow, Istanbul"],
  "Asia/Dubai": ["(GMT +04:00) Dubai, Baku"],
  "Asia/Karachi": ["(GMT +05:00) Karachi, Tashkent"],
  "Asia/Dhaka": ["(GMT +06:00) Dhaka, Almaty"],
  "Asia/Bangkok": ["(GMT +07:00) Bangkok, Jakarta"],
  "Asia/Singapore": ["(GMT +08:00) Singapore, Beijing"],
  "Asia/Tokyo": ["(GMT +09:00) Tokyo, Seoul"],
  "Australia/Sydney": ["(GMT +10:00) Sydney, Melbourne"],
  "Pacific/Noumea": ["(GMT +11:00) Noumea, Solomon Islands"],
  "Pacific/Auckland": ["(GMT +12:00) Auckland, Fiji"],
  "Pacific/Apia": ["(GMT +13:00) Samoa, Tonga"],
  "Pacific/Kiritimati": ["(GMT +14:00) Kiritimati, Line Islands"],
};

type Props = {
  timeZone: string;
  setTimeZone: React.Dispatch<React.SetStateAction<string>>;
};

export function TimeZoneSelect({ timeZone, setTimeZone }: Props) {
  const [open, setOpen] = useState(false);

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
              className="h-5 w-5 !text-zinc-600 dark:!text-zinc-400" /** text-zinc-400 = #a1a1aa */
            />
            <p className="!text-zinc-600 dark:!text-zinc-400">
              {timezoneMap[timeZone]
                ? timezoneMap[timeZone][0]?.slice(0, 25)
                : "Select time zone"}
              ...
            </p>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 !text-zinc-600 dark:!text-zinc-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800">
          <Command className="w-full">
            <CommandInput placeholder="Search framework..." />
            <CommandList>
              <CommandEmpty>No time zone found.</CommandEmpty>
              <CommandGroup>
                {Object.entries(timezoneMap).map((timeZoneEntrie) => (
                  <CommandItem
                    key={timeZoneEntrie[0]}
                    value={timeZoneEntrie[0]}
                    onSelect={(currentValue) => {
                      setTimeZone(
                        timeZone === timeZoneEntrie[0] ? "" : currentValue
                      );
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 !text-zinc-600 dark:!text-zinc-400",
                        timeZone === timeZoneEntrie[0]
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {timeZoneEntrie[1]}
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
