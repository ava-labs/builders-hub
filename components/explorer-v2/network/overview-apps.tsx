"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { CutChips, RowBar, ShareStrip } from "./overview-share";
import { fmtUsdCompact } from "./overview-series";

/* The ecosystem's biggest apps by TVL, on the same DefiLlama feed the
   Apps facet runs on. The strip splits the TVL by what the apps do; a
   click cuts the list to one kind of app. */

interface AppRow {
  slug: string;
  name: string;
  logo: string | null;
  category: string | null;
  tvl: number | null;
  change_1d: number | null;
}

/* the apps the strip and the list are drawn from */
const POOL = 150;
const SHOWN = 10;

const LABELS: Record<string, string> = { dex: "DEX", rwa: "RWA", nft: "NFT", cdp: "CDP" };
const kindOf = (a: AppRow) => {
  const c = (a.category || "other").toLowerCase();
  return LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
};

function useApps() {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dapps", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((d: { dapps?: AppRow[] }) => {
        setApps(
          (d.dapps ?? [])
            .filter((a) => typeof a.tvl === "number" && a.tvl > 0)
            .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
            .slice(0, POOL),
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return apps;
}

/* the day's move in ink, as the figures carry it; red stays for burns */
function DayMove({ value }: { value: number | null }) {
  if (typeof value !== "number") return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className="whitespace-nowrap text-zinc-600 dark:text-zinc-300">
      <span className="text-[8px]">{flat ? "■" : value > 0 ? "▲" : "▼"}</span> {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function OverviewApps() {
  const apps = useApps();
  const [kind, setKind] = useState<string | null>(null);

  const segments = useMemo(() => {
    const by = new Map<string, number>();
    for (const a of apps ?? []) by.set(kindOf(a), (by.get(kindOf(a)) ?? 0) + (a.tvl ?? 0));
    return [...by.entries()].map(([key, value]) => ({ key, label: key, value })).sort((a, b) => b.value - a.value);
  }, [apps]);

  const rows = (apps ?? []).filter((a) => !kind || kindOf(a) === kind).slice(0, SHOWN);
  const lead = rows[0]?.tvl ?? 1;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        label="Apps · TVL"
        action={
          <Link
            href="/explorer/mainnet/apps"
            className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            All apps
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      />
      {/* the switcher row's height, so the two strips register side by side */}
      <div className="flex min-h-8 items-center justify-end">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {apps ? `top ${apps.length} by TVL` : "…"}
        </span>
      </div>
      <ShareStrip segments={segments} picked={kind} onPick={setKind} fmt={fmtUsdCompact} noun="of TVL" />
      <CutChips chips={kind ? [{ key: "kind", label: kind }] : []} onClear={() => setKind(null)} />
      <Board divide={false} className="border-t border-zinc-200 dark:border-zinc-800">
        <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {apps === null &&
            Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="px-5 py-3.5">
                <span className="block h-4 w-3/5 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              </li>
            ))}
          {rows.map((a, i) => (
            <li key={a.slug}>
              <Link
                href={`/stats/dapps/${a.slug}`}
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900/50"
              >
                <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {a.logo ? (
                  <img src={a.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[13px] font-medium leading-5 text-[#0061E2] group-hover:underline dark:text-[#5f9dff]">
                      {a.name}
                    </span>
                    <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 sm:inline dark:text-zinc-500">
                      {kindOf(a)}
                    </span>
                  </span>
                  <RowBar share={(a.tvl ?? 0) / lead} />
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums">
                  <DayMove value={a.change_1d} />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                  {fmtUsdCompact(a.tvl ?? 0)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Board>
    </section>
  );
}
