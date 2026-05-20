"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { GalleryProject } from "@/server/services/projects";
import { GalleryCard } from "./GalleryCard";

interface PublicGalleryViewProps {
  hackathonId: string;
  hackathonTitle: string;
  projects: GalleryProject[];
  nextCursor: string | null;
  availableTracks: string[];
  availableStackOptions: string[];
  /** Initial filters echoed from the URL so inputs stay in sync after server render. */
  initialFilters: {
    search?: string;
    tracks?: string[];
    stack?: string[];
    country?: string[];
    teamType?: "solo" | "duo" | "";
    sort?: "newest" | "oldest" | "name";
  };
}

const SORT_OPTIONS: { value: NonNullable<PublicGalleryViewProps["initialFilters"]["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "A → Z" },
];

const TEAM_TYPE_OPTIONS = [
  { value: "", label: "All teams" },
  { value: "solo", label: "Solo" },
  { value: "duo", label: "Duo" },
];

export function PublicGalleryView({
  hackathonId,
  hackathonTitle,
  projects,
  nextCursor,
  availableTracks,
  availableStackOptions,
  initialFilters,
}: PublicGalleryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Reset cursor when filters change.
    if (key !== "cursor") params.delete("cursor");
    router.replace(`/hackathons/${hackathonId}/gallery?${params.toString()}`);
  };

  const toggleMulti = (key: "track" | "stack" | "country", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const existing = params.getAll(key);
    const next = existing.includes(value)
      ? existing.filter((v) => v !== value)
      : [...existing, value];
    params.delete(key);
    for (const v of next) params.append(key, v);
    params.delete("cursor");
    router.replace(`/hackathons/${hackathonId}/gallery?${params.toString()}`);
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") setParam("search", searchValue.trim());
  };

  return (
    <main className="container max-w-[1400px] py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-1">{hackathonTitle} — Gallery</h1>
        <p className="text-sm text-zinc-500">
          Browse submitted projects. Filter by track, tech stack, country, or team type.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search project or team name"
            className="pl-9"
          />
        </div>

        <Select
          value={initialFilters.teamType ?? ""}
          onValueChange={(v) => setParam("team_type", v)}
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            {TEAM_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value || "all"} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={initialFilters.sort ?? "newest"}
          onValueChange={(v) => setParam("sort", v)}
        >
          <SelectTrigger className="min-w-[140px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {availableTracks.length > 0 && (
        <FilterChips
          title="Tracks"
          options={availableTracks}
          selected={initialFilters.tracks ?? []}
          onToggle={(v) => toggleMulti("track", v)}
        />
      )}
      {availableStackOptions.length > 0 && (
        <FilterChips
          title="Tech stack"
          options={availableStackOptions}
          selected={initialFilters.stack ?? []}
          onToggle={(v) => toggleMulti("stack", v)}
        />
      )}

      {projects.length === 0 ? (
        <div className="py-16 text-center text-zinc-500">
          No projects match these filters yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <GalleryCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <Link
            href={`/hackathons/${hackathonId}/gallery?${(() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("cursor", nextCursor);
              return params.toString();
            })()}`}
          >
            <Button variant="outline">Load more</Button>
          </Link>
        </div>
      )}
    </main>
  );
}

interface FilterChipsProps {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

function FilterChips({ title, options, selected, onToggle }: FilterChipsProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`text-xs px-3 py-1 rounded-full border cursor-pointer transition-colors ${
                active
                  ? "bg-red-500 text-white border-red-500"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-red-400"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
