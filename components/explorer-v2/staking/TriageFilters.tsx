"use client";

import type { CSSProperties } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESETS, presetActive, type Facet, type FacetKey, type Preset, type Selection } from "@/lib/validator-triage";

/* The roster's filter, three ways in: the triage presets (the questions
   the page is asked most), the facet rail (every part of the filter, each
   option with the count it would leave), and the chips (what is on now). */

/** facets whose feed has not answered: their counts read `label`, not 0 */
export interface Pending {
  keys: FacetKey[];
  /** "…" while the feed loads, "n/a" when it failed */
  label: string;
  title: string;
}

export function PresetRow({
  counts,
  selection,
  onPreset,
  pending = null,
}: {
  /** preset id to the validators it lists */
  counts: Record<string, number>;
  selection: Selection;
  onPreset: (p: Preset) => void;
  pending?: Pending | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Triage</span>
      {PRESETS.map((p) => {
        const on = presetActive(p, selection);
        const n = counts[p.id] ?? 0;
        const waiting = !!pending && Object.keys(p.selection).some((k) => pending.keys.includes(k as FacetKey));
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

export function FacetRail({
  facets,
  counts,
  selection,
  onToggle,
  onClearFacet,
  swatch,
  pending = null,
  layout = "rail",
}: {
  facets: Facet[];
  /** facet key to option id to the validators that option would leave */
  counts: Record<FacetKey, Record<string, number>> | null;
  selection: Selection;
  onToggle: (key: FacetKey, id: string) => void;
  onClearFacet: (key: FacetKey) => void;
  /** a swatch that ties an option to the colors above the roster */
  swatch?: (key: FacetKey, id: string) => CSSProperties | undefined;
  pending?: Pending | null;
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
export function ActiveChips({
  facets,
  selection,
  onClearFacet,
  onClearAll,
}: {
  facets: Facet[];
  selection: Selection;
  onClearFacet: (key: FacetKey) => void;
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
