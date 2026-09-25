"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { CutChips, RankSwitch, RowBar, ShareStrip } from "./overview-share";
import { fmtCompact } from "./overview-series";

/* The chains, ranked by what the reader picks. The strip on top splits
   the total by the chains' categories; a click cuts the list to one
   category and the cut shows as a chip. Chains without the figure are
   counted, not ranked as zero. */

export interface OverviewChain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number | null;
  activeAddresses: number | null;
  icmMessages: number | null;
  validatorCount: number | string;
  metricsOk?: boolean;
}

type Rank = "txCount" | "activeAddresses" | "icmMessages" | "validatorCount";

const RANKS: { value: Rank; label: string; noun: string }[] = [
  { value: "txCount", label: "Txs", noun: "of transactions" },
  { value: "activeAddresses", label: "Addresses", noun: "of active addresses" },
  { value: "icmMessages", label: "ICM", noun: "of ICM messages" },
  { value: "validatorCount", label: "Validators", noun: "of validators" },
];

const catalog = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true).map((c) => [String(c.chainId), c]),
);

export function chainHref(chainId: string): string | null {
  const c = catalog.get(String(chainId));
  if (!c) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}` : `/explorer/mainnet/${c.slug}/accounts`;
}

const categoryOf = (chainId: string) => catalog.get(String(chainId))?.category || "Other";

function figureOf(c: OverviewChain, rank: Rank): number | null {
  const v = c[rank];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const SHOWN = 10;

export function OverviewChains({ chains, windowLabel }: { chains: OverviewChain[] | null; windowLabel: string }) {
  const [rank, setRank] = useState<Rank>("txCount");
  const [category, setCategory] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const meta = RANKS.find((r) => r.value === rank)!;

  const ranked = useMemo(
    () =>
      (chains ?? [])
        .flatMap((c) => {
          const v = figureOf(c, rank);
          return v !== null && v > 0 ? [{ c, v, category: categoryOf(c.chainId) }] : [];
        })
        .sort((a, b) => b.v - a.v),
    [chains, rank],
  );

  const segments = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of ranked) by.set(r.category, (by.get(r.category) ?? 0) + r.v);
    return [...by.entries()].map(([key, value]) => ({ key, label: key, value })).sort((a, b) => b.value - a.value);
  }, [ranked]);

  // a cut that the new ranking no longer holds falls away
  const cut = category && segments.some((s) => s.key === category) ? category : null;
  const rows = cut ? ranked.filter((r) => r.category === cut) : ranked;
  const shown = all ? rows : rows.slice(0, SHOWN);
  const lead = rows[0]?.v ?? 1;
  const missing = chains ? chains.length - ranked.length : 0;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        label={`Chains · ${windowLabel}`}
        action={
          <Link
            href="/explorer/mainnet/chains"
            className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            All chains
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RankSwitch id="overview-chains" options={RANKS} value={rank} onChange={setRank} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {!chains ? "…" : cut ? `${rows.length} of ${ranked.length}` : `${ranked.length} ranked${missing > 0 ? ` · ${missing} no data` : ""}`}
        </span>
      </div>
      <ShareStrip segments={segments} picked={cut} onPick={setCategory} fmt={fmtCompact} noun={meta.noun} />
      <CutChips chips={cut ? [{ key: "category", label: cut }] : []} onClear={() => setCategory(null)} />
      <Board divide={false} className="border-t border-zinc-200 dark:border-zinc-800">
        <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {chains === null &&
            Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="px-5 py-3.5">
                <span className="block h-4 w-2/5 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              </li>
            ))}
          {shown.map(({ c, v }, i) => {
            const href = chainHref(c.chainId);
            const body = (
              <>
                <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {c.chainLogoURI ? (
                  <img src={c.chainLogoURI} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[13px] font-medium leading-5",
                      href ? "text-[#0061E2] group-hover:underline dark:text-[#5f9dff]" : "text-zinc-900 dark:text-zinc-100",
                    )}
                  >
                    {c.chainName}
                  </span>
                  <RowBar share={v / lead} />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                  {fmtCompact(v)}
                </span>
              </>
            );
            const row = "flex items-center gap-3 px-5 py-3 md:px-6";
            return (
              <li key={c.chainId}>
                {href ? (
                  <Link href={href} className={cn(row, "group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50")}>
                    {body}
                  </Link>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            );
          })}
          {chains !== null && rows.length === 0 && (
            <li className="px-5 py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              No chain reports this figure
            </li>
          )}
        </ol>
        {rows.length > SHOWN && (
          <button
            type="button"
            onClick={() => setAll((a) => !a)}
            className="w-full border-t border-zinc-200 px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:px-6 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-100"
          >
            {all ? "Show top 10" : `Show all ${rows.length}`}
          </button>
        )}
      </Board>
    </section>
  );
}
