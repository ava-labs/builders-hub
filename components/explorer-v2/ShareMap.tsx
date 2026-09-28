"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";

/* The share map: a whole cut into what it is made of, as one strip.
   Every part is a segment as wide as its share, inked, named on the
   segment when it is wide enough, detailed in a plate on hover, and
   listed under the strip with its figure. The block page's gas map is
   the first of these; any "who has how much" on the explorer reads this
   way, so a reader learns it once. */

/** the explorer's categorical inks, biggest part first */
export const SHARE_TONES = ["#7c3aed", "#0061E2", "#0d9488", "#d97706", "#db2777", "#4f46e5", "#0891b2", "#65a30d"];
/** the long tail, and parts that should recede */
export const TAIL_TONE = "#d4d4d8";
/** a plain, uncategorized part */
export const PLAIN_TONE = "#A2AFB2";
const HATCH = "repeating-linear-gradient(135deg, rgba(230,33,47,0.9) 0 3px, transparent 3px 7px)";

export interface SharePart {
  key: string;
  label: string;
  value: number;
  /** defaults to the next categorical ink */
  tone?: string;
  href?: string;
  /** the part's other figures, one line in the plate and the legend */
  sub?: string;
  /** the full name or address, in the plate */
  detail?: string;
  /** red stripes over the ink: reverted, jailed, failing */
  hatch?: boolean;
  /** show the label in mono (addresses, selectors) */
  mono?: boolean;
}

export function ShareMap({
  label,
  summary,
  parts,
  fmt,
  legend = 10,
  height = "h-16",
  note,
  bare = false,
}: {
  label: string;
  /** what the whole is, top right: "10.37T gas · last 30 days" */
  summary?: React.ReactNode;
  /** biggest first; the map draws them in this order */
  parts: SharePart[];
  fmt: (v: number) => string;
  /** how many parts the legend names before "N more" */
  legend?: number;
  height?: string;
  /** one plain sentence under the legend */
  note?: React.ReactNode;
  /** no Board of its own, for a board that already frames it */
  bare?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let ink = 0;
  const toned = parts.map((p, i) => ({ ...p, tone: p.tone ?? (i < legend && ink < SHARE_TONES.length ? SHARE_TONES[ink++] : TAIL_TONE) }));
  const named = toned.slice(0, legend);
  const rest = toned.slice(legend);
  const restValue = rest.reduce((s, p) => s + p.value, 0);
  const hp = hover ? toned.find((p) => p.key === hover) : undefined;
  const pct = (v: number) => {
    const x = (v / total) * 100;
    return x >= 10 ? `${x.toFixed(0)}%` : x >= 1 ? `${x.toFixed(1)}%` : x > 0 ? "<1%" : "0%";
  };

  const body = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 md:px-6">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</span>
        {summary && <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{summary}</span>}
      </div>
      <div className="flex flex-col gap-5 px-5 pb-5 pt-4 md:px-6">
        {/* the strip */}
        <div className="relative">
          <div className={cn("flex w-full gap-[2px]", height)} onMouseLeave={() => setHover(null)}>
            {toned.map((p) => {
              const share = p.value / total;
              const seg = (
                <>
                  {p.hatch && <span aria-hidden className="absolute inset-0" style={{ background: HATCH }} />}
                  {share >= 0.1 && (
                    <span className={cn("absolute inset-x-2 bottom-1.5 hidden truncate sm:block text-[10px] leading-none text-white/95", p.mono ? "font-mono" : "font-mono")}>
                      {p.label}
                      <span className="ml-1.5 text-white/70">{pct(p.value)}</span>
                    </span>
                  )}
                </>
              );
              const cls = cn("relative block h-full min-w-[3px] overflow-hidden transition-opacity duration-150", hover !== null && hover !== p.key && "opacity-35");
              const style = { flexGrow: p.value, flexBasis: 0, background: p.tone };
              const events = { onMouseEnter: () => setHover(p.key), onFocus: () => setHover(p.key) };
              return p.href ? (
                <Link key={p.key} href={p.href} aria-label={`${p.label}, ${pct(p.value)}`} className={cls} style={style} {...events}>
                  {seg}
                </Link>
              ) : (
                <span key={p.key} tabIndex={0} aria-label={`${p.label}, ${pct(p.value)}`} className={cls} style={style} {...events}>
                  {seg}
                </span>
              );
            })}
          </div>
          {hp && (
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2">
              <TipPlate>
                <p className="flex items-center gap-2 font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                  <span className="h-1.5 w-1.5" style={{ background: hp.tone }} />
                  {hp.label}
                </p>
                <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                  {fmt(hp.value)} · {pct(hp.value)} of the whole
                  {hp.sub ? ` · ${hp.sub}` : ""}
                </p>
                {hp.detail && <p className="font-mono text-[10px] text-zinc-400">{hp.detail}</p>}
              </TipPlate>
            </div>
          )}
        </div>

        {/* the parts, named */}
        <div className="grid gap-x-10 gap-y-3 font-mono text-[12px] sm:grid-cols-2">
          {named.map((p) => {
            const name = (
              <span className={cn("min-w-0 truncate text-zinc-700 dark:text-zinc-300", p.href && "hover:text-[#E6212F]")}>{p.label}</span>
            );
            return (
              // two lines: the name and its figures, then the part's detail
              // under the name, so a long detail never squeezes the name out
              <span
                key={p.key}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(null)}
                className={cn("flex min-w-0 flex-col gap-0.5 transition-opacity", hover && hover !== p.key && "opacity-40")}
              >
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0" style={{ background: p.tone }} />
                    {p.href ? (
                      <Link href={p.href} className="flex min-w-0" title={p.detail ?? p.label}>
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{fmt(p.value)}</span>
                    <span className="w-11 text-right text-zinc-900 dark:text-zinc-50">{pct(p.value)}</span>
                  </span>
                </span>
                {p.sub && <span className="truncate pl-4 text-[11px] text-zinc-400 dark:text-zinc-500">{p.sub}</span>}
              </span>
            );
          })}
          {rest.length > 0 && (
            <span className="flex items-center justify-between gap-3 text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2" style={{ background: TAIL_TONE }} />
                {rest.length} more
              </span>
              <span className="flex items-baseline gap-3 tabular-nums">
                <span className="text-[11px]">{fmt(restValue)}</span>
                <span className="w-11 text-right">{pct(restValue)}</span>
              </span>
            </span>
          )}
        </div>
        {note && <p className="font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">{note}</p>}
      </div>
    </>
  );
  return bare ? <div>{body}</div> : <Board divide={false}>{body}</Board>;
}
