"use client";

import type { CSSProperties } from "react";
import { Check, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { presetActive, type Facet, type FacetKey, type Preset, type Selection, type StatusRow } from "@/lib/validator-triage";

/* The roster's filter, four ways in: the search, the triage presets (the
   questions the page is asked most), the facet rail (every part of the
   filter, each option with the count it would leave), and the chips (what
   is on now). Each part takes its roster's facet keys; the Primary
   Network's are the defaults. */

/** a roster row's version, inked by its status against the target */
export const STATUS_INK = {
  current: "text-zinc-700 dark:text-zinc-300",
  behind: "text-[#E6212F]",
  unknown: "text-zinc-400 dark:text-zinc-500",
} as const;

/** a cell whose feed has no figure */
export const NA = <span className="text-zinc-300 dark:text-zinc-700">n/a</span>;

/** days until a validation ends or a balance runs out: red inside a week, amber inside a month */
export function daysLeftTone(days: number): string {
  if (days < 7) return "font-medium text-[#E6212F]";
  if (days < 30) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-700 dark:text-zinc-300";
}

/** facets whose feed has not answered: their counts read `label`, not 0 */
export interface Pending<K extends string = FacetKey> {
  keys: K[];
  /** "…" while the feed loads, "n/a" when it failed */
  label: string;
  title: string;
}

/** the search: one line, so a pasted list keeps its IDs apart with spaces */
export function RosterSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 transition-colors focus-within:border-zinc-900 sm:w-[26rem] dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
      <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          // a one-line input drops line breaks, which would glue a pasted list together
          const text = e.clipboardData.getData("text");
          if (!/[\r\n]/.test(text)) return;
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          onChange(`${el.value.slice(0, start)}${text.replace(/\s+/g, " ").trim()}${el.value.slice(end)}`);
        }}
        placeholder={placeholder}
        aria-label="Search validators"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** a toolbar action in the ledger voice */
export function ToolButton({
  icon: Icon,
  onClick,
  disabled,
  title,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex shrink-0 items-center gap-1.5 border border-zinc-200 bg-white/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 transition-colors enabled:hover:border-zinc-900 enabled:hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:enabled:hover:border-zinc-100 dark:enabled:hover:text-zinc-100"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {children}
    </button>
  );
}

export function PresetRow<K extends string = FacetKey>({
  presets,
  counts,
  selection,
  onPreset,
  pending = null,
}: {
  presets: Preset<K>[];
  /** preset id to the validators it lists */
  counts: Record<string, number>;
  selection: Selection<K>;
  onPreset: (p: Preset<K>) => void;
  pending?: Pending<K> | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Triage</span>
      {presets.map((p) => {
        const on = presetActive(p, selection);
        const n = counts[p.id] ?? 0;
        const waiting = !!pending && Object.keys(p.selection).some((k) => pending.keys.includes(k as K));
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p)}
            aria-pressed={on}
            title={waiting ? pending.title : p.title}
            disabled={!on && (waiting || n === 0)}
            className={cn(
              "inline-flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:cursor-default disabled:opacity-50",
              on
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white/80 text-zinc-600 enabled:hover:border-zinc-400 enabled:hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:enabled:hover:border-zinc-500 dark:enabled:hover:text-zinc-100",
            )}
          >
            {p.label}
            <span
              className={cn(
                "tabular-nums",
                on ? "text-white/70 dark:text-zinc-900/60" : p.id === "not-on-target" && n > 0 ? "text-[#E6212F]" : "text-zinc-400 dark:text-zinc-500",
              )}
            >
              {waiting ? pending.label : n.toLocaleString("en-US")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FacetRail<K extends string = FacetKey, R = StatusRow>({
  facets,
  counts,
  selection,
  onToggle,
  onClearFacet,
  swatch,
  pending = null,
  layout = "rail",
}: {
  facets: Facet<K, R>[];
  /** facet key to option id to the validators that option would leave */
  counts: Record<K, Record<string, number>> | null;
  selection: Selection<K>;
  onToggle: (key: K, id: string) => void;
  onClearFacet: (key: K) => void;
  /** a swatch that ties an option to the colors above the roster */
  swatch?: (key: K, id: string) => CSSProperties | undefined;
  pending?: Pending<K> | null;
  /** a column beside the roster, or a grid over it on narrow screens */
  layout?: "rail" | "grid";
}) {
  return (
    <div className={cn(layout === "grid" ? "grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4" : "flex flex-col gap-5")}>
      {facets.map((f) => {
        const picked = selection[f.key] ?? [];
        const waiting = !!pending?.keys.includes(f.key);
        return (
          <div key={f.key} role="group" aria-label={f.label} title={waiting ? pending?.title : undefined} className="min-w-0">
            <div className="mb-1 flex min-h-5 items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{f.label}</span>
              {picked.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClearFacet(f.key)}
                  className="shrink-0 font-mono text-[10px] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="flex flex-col">
              {f.options.map((o) => {
                const on = picked.includes(o.id);
                const n = counts?.[f.key]?.[o.id] ?? 0;
                const empty = (waiting || n === 0) && !on;
                const sw = swatch?.(f.key, o.id);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={empty}
                      onClick={() => onToggle(f.key, o.id)}
                      className="group flex w-full items-center gap-2 py-[5px] text-left disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition-colors",
                          on
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                            : "border-zinc-300 group-enabled:group-hover:border-zinc-500 dark:border-zinc-700 dark:group-enabled:group-hover:border-zinc-400",
                        )}
                      >
                        {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                      </span>
                      {sw && <span className={cn("h-2 w-2 shrink-0 rounded-[1px]", empty && "opacity-40")} style={sw} />}
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate font-mono text-[11.5px] transition-colors",
                          empty ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-100",
                        )}
                      >
                        {o.label}
                      </span>
                      <span className={cn("font-mono text-[11px] tabular-nums", empty ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-400 dark:text-zinc-500")}>
                        {waiting ? pending?.label : n.toLocaleString("en-US")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** what the roster is cut to, one chip a facet; a chip's cross clears that facet */
export function ActiveChips<K extends string = FacetKey, R = StatusRow>({
  facets,
  selection,
  onClearFacet,
  onClearAll,
}: {
  facets: Facet<K, R>[];
  selection: Selection<K>;
  onClearFacet: (key: K) => void;
  onClearAll: () => void;
}) {
  const chips = facets.flatMap((f) => {
    const ids = selection[f.key];
    if (!ids?.length) return [];
    const labels = ids.map((id) => f.options.find((o) => o.id === id)?.label ?? id);
    return [{ key: f.key, text: `${f.label}: ${labels.join(", ")}` }];
  });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onClearFacet(c.key)}
          className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#0061E2]/[0.08] py-1.5 pl-3 pr-2 font-mono text-[11px] text-[#0061E2] transition-colors hover:bg-[#0061E2]/[0.14] dark:bg-[#5b9bff]/15 dark:text-[#8db8ff]"
        >
          <span className="truncate">{c.text}</span>
          <X className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="px-1 font-mono text-[11px] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
