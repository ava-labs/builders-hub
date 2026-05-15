"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

export type SearchUser = {
  id: string;
  name: string | null;
  image: string | null;
  user_name: string | null;
  email?: string;
  custom_attributes?: string[];
};

type Props = {
  onSelect: (user: SearchUser) => void;
  excludeUserIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  scope?: "public" | "admin";
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function initials(user: SearchUser): string {
  const source = user.name ?? user.user_name ?? user.email ?? "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserSearchPicker({
  onSelect,
  excludeUserIds,
  placeholder = "Search by name…",
  autoFocus,
  scope = "public",
}: Props) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 250);
  const [results, setResults] = useState<SearchUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const excluded = useMemo(() => new Set(excludeUserIds ?? []), [excludeUserIds]);

  useEffect(() => {
    let active = true;
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ q: debouncedQuery.trim(), scope });
    fetch(`/api/users/search?${params.toString()}`, {
      headers: { "content-type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return res.json();
      })
      .then((data: { users: SearchUser[] }) => {
        if (!active) return;
        setResults(data.users ?? []);
        setOpen(true);
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(e.message);
        setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, scope]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = results.filter((u) => !excluded.has(u.id));

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-expanded={open}
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-500">
              Searching…
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-2 text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-500">
              {debouncedQuery.trim().length < 2
                ? "Type at least 2 characters"
                : "No users found"}
            </div>
          )}
          {!loading &&
            !error &&
            filtered.map((user) => {
              const subtitle = user.email ?? (user.user_name ? `@${user.user_name}` : null);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    onSelect(user);
                    setQuery("");
                    setOpen(false);
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <Avatar className="size-8">
                    {user.image && (
                      <AvatarImage src={user.image} alt={user.name ?? user.email ?? "user"} />
                    )}
                    <AvatarFallback>{initials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {user.name ?? user.user_name ?? user.email ?? "Unknown user"}
                    </div>
                    {subtitle && (
                      <div className="truncate text-xs text-zinc-600 dark:text-zinc-500">
                        {subtitle}
                      </div>
                    )}
                  </div>
                  {user.custom_attributes && user.custom_attributes.length > 0 && (
                    <div className="flex shrink-0 gap-1">
                      {user.custom_attributes.slice(0, 2).map((attr) => (
                        <span
                          key={attr}
                          className="rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700 dark:text-zinc-400"
                        >
                          {attr}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
