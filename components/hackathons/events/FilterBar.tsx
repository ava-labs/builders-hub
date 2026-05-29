"use client";
import { Globe, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type EventsLang, t } from "@/lib/events/i18n";

type Props = {
  lang: EventsLang;
  search: string;
  onSearchChange: (value: string) => void;
  activeType: string;
  onActiveTypeChange: (value: string) => void;
  typeCounts: Record<string, number>;
  location?: string;
  onLocationChange: (value: string) => void;
};

export default function FilterBar({
  lang,
  search,
  onSearchChange,
  activeType,
  onActiveTypeChange,
  typeCounts,
  location,
  onLocationChange,
}: Props) {
  const types = [
    { key: "all", label: t(lang, "events.tabs.all") },
    { key: "hackathon", label: t(lang, "events.tabs.hackathons") },
    { key: "workshop", label: t(lang, "events.tabs.workshops") },
    { key: "bootcamp", label: t(lang, "events.tabs.bootcamps") },
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Search */}
      <div className="relative w-full lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t(lang, "events.search.placeholder")}
          className="h-10 border-zinc-200 bg-white pl-9 pr-9 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type segmented */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-800/40">
          {types.map(({ key, label }) => {
            const active = activeType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onActiveTypeChange(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded px-1.5 font-mono text-[10px]",
                    active
                      ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
                  )}
                >
                  {typeCounts[key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Location / format */}
        <Select
          value={location || "all"}
          onValueChange={(value) => onLocationChange(value === "all" ? "" : value)}
        >
          <SelectTrigger className="h-10 w-[170px] gap-2 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <Globe className="h-4 w-4 text-zinc-400" />
            <SelectValue placeholder={t(lang, "events.filter.location.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t(lang, "events.filter.location.all")}</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="InPerson">
              {t(lang, "events.filter.location.inPerson")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
