"use client";

import { Check, Download, Link2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CutChips } from "@/components/explorer-v2/network/icm-parts";
import { FACETS, PRESETS, presetActive, type FacetKey, type Preset, type Selection } from "@/lib/defi/protocol-filters";
import type { GroupKey } from "@/lib/defi/taxonomy";
import { groupTone, usd } from "./palette";

/* The protocol table's filter, all of it in view: a search, the presets
   (the questions the page is asked most), and one row of chips a facet,
   each chip with the count and TVL it would leave. Chips in a row OR
   together; the rows AND. What is on shows as blue chips above the
   table, and the view leaves as a CSV or a link. */

type Counts = Record<FacetKey, Record<string, { n: number; tvl: number }>>;

const CHIP =
  "inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10.5px] tabular-nums transition-colors disabled:cursor-default disabled:opacity-40";
const OFF =
  "border-zinc-200 bg-white/80 text-zinc-600 enabled:hover:border-zinc-400 enabled:hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:enabled:hover:border-zinc-500 dark:enabled:hover:text-zinc-100";
const ON = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

export function ProtocolFilters({
  query,
  onQuery,
  selection,
  counts,
  presetCounts,
  onToggle,
  onPreset,
  onClearFacet,
  onClearAll,
  copied,
  onCopyLink,
  onCsv,
  shown,
}: {
  query: string;
  onQuery: (q: string) => void;
  selection: Selection;
  counts: Counts | null;
  presetCounts: Record<string, number>;
  onToggle: (key: FacetKey, id: string) => void;
  onPreset: (p: Preset) => void;
  onClearFacet: (key: FacetKey) => void;
  onClearAll: () => void;
  copied: boolean;
  onCopyLink: () => void;
  onCsv: () => void;
  /** protocols in the cut */
  shown: number;
}) {
  const chips = FACETS.flatMap((f) => {
    const ids = selection[f.key];
    if (!ids?.length) return [];
    const labels = ids.map((id) => f.options.find((o) => o.id === id)?.label ?? id);
    return [{ key: f.key, label: `${f.label}: ${labels.join(", ")}` }];
  });
  if (query.trim()) chips.unshift({ key: "q" as FacetKey, label: `Search: ${query.trim()}` });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 transition-colors focus-within:border-zinc-900 sm:w-72 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
          <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search protocols or categories"
            aria-label="Search protocols"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          {query && (
            <button type="button" onClick={() => onQuery("")} aria-label="Clear search" className="shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => {
            const on = presetActive(p, selection);
            const n = presetCounts[p.id] ?? 0;
            return (
              <button
                key={p.id}
                type="button"
                title={p.title}
                aria-pressed={on}
                disabled={!on && n === 0}
                onClick={() => onPreset(p)}
                className={cn(CHIP, "uppercase tracking-[0.1em]", on ? ON : OFF)}
              >
                {p.label}
                <span className={on ? "text-white/70 dark:text-zinc-900/60" : "text-zinc-400 dark:text-zinc-500"}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onCsv} disabled={shown === 0} className={cn(CHIP, OFF, "uppercase tracking-[0.1em]")} title="Download this list as CSV">
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            CSV
          </button>
          <button type="button" onClick={onCopyLink} className={cn(CHIP, OFF, "uppercase tracking-[0.1em]")} title="Copy a link to this view">
            {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />}
            {copied ? "Copied" : "Link"}
          </button>
        </div>
      </div>

      {/* one row a facet; each chip leaves its count and TVL */}
      <div className="grid gap-x-8 gap-y-2.5 border-y border-zinc-100 py-3 lg:grid-cols-2 dark:border-zinc-900">
        {FACETS.map((f) => (
          <div key={f.key} role="group" aria-label={f.label} className={cn("flex min-w-0 items-start gap-3", f.key === "group" && "lg:col-span-2")}>
            <span className="w-[5.5rem] shrink-0 pt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{f.label}</span>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {f.options.map((o) => {
                const on = !!selection[f.key]?.includes(o.id);
                const c = counts?.[f.key]?.[o.id];
                const n = c?.n ?? 0;
                if (f.key === "group" && o.id === "cex" && n === 0 && !on) return null;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={!on && n === 0}
                    onClick={() => onToggle(f.key, o.id)}
                    title={c ? `${n} protocol${n === 1 ? "" : "s"} · ${usd(c.tvl)}` : undefined}
                    className={cn(CHIP, on ? ON : OFF)}
                  >
                    {f.key === "group" && <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: groupTone(o.id as GroupKey) }} />}
                    {o.label}
                    <span className={on ? "text-white/70 dark:text-zinc-900/60" : "text-zinc-400 dark:text-zinc-500"}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <CutChips chips={chips} onDrop={(k) => (k === "q" ? onQuery("") : onClearFacet(k as FacetKey))} onClear={onClearAll} />
    </div>
  );
}

