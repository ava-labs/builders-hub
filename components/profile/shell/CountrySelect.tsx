"use client";

import * as React from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { GlobeIcon } from "./icons";
import { COUNTRIES } from "./data";

interface Props {
  value: string | null | undefined;
  onChange: (value: string) => void;
}

export function CountrySelect({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="pr-select-fake"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlobeIcon size={14} />
          {value ? <span>{value}</span> : <span className="pr-ph">Select your country</span>}
        </span>
        <ChevronDown />
      </button>
      {open && (
        <div className="pr-country-popover" role="listbox">
          <div className="pr-search-row">
            <Search size={14} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country..."
              aria-label="Search country"
            />
          </div>
          <div className="pr-list">
            {filtered.map((country) => (
              <button
                key={country}
                type="button"
                role="option"
                aria-selected={value === country}
                className="pr-list-item"
                onClick={() => {
                  onChange(country);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{country}</span>
                {value === country && (
                  <span className="pr-check-r">
                    <Check size={14} />
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--pr-g-650)" }}>
                No countries match "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
