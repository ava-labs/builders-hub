"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, SectionHeader, StatCell, StatDash, StatFigure, StatStrip } from "@/components/explorer-v2/ui";
import { formatAvax, timeAgo } from "@/components/explorer-v2/format";
import { NotFound } from "@/components/explorer-v2/pchain/PchainTx";
import {
  VersionBreakdownCard,
  calculateVersionStats,
  compareVersions,
  type VersionBreakdownData,
} from "@/components/stats/VersionBreakdown";

/* An L1's own validator set — the chain-scope Validators tab for every
   chain that isn't the Primary Network (whose tab mounts the staking
   observatory instead). Replaces the old /stats/validators/[slug] page:
   same /api/chain-validators feed, explorer sheet grammar. L1 validators
   don't stake AVAX or take delegators; they carry a weight and prepay
   their continuation fees from a balance, so those are the columns. */

interface L1Validator {
  nodeId: string;
  validationId?: string;
  weight?: number;
  remainingBalance?: number; // nAVAX; funds continuation fees
  creationTimestamp?: number;
  version?: string;
}

type SortKey = "weight" | "remainingBalance" | "creationTimestamp" | "version";

/* weight is unitless — compact it like the old page did */
function formatWeight(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString("en-US");
}

export function L1ValidatorsContent({
  subnetId,
  network,
  base,
}: {
  subnetId: string;
  /** chain-validators feed network: "mainnet" | "fuji" */
  network: string;
  /** the P-Chain explorer base owning the node detail pages */
  base: string;
}) {
  const [validators, setValidators] = useState<L1Validator[] | null>(null);
  const [versionBreakdown, setVersionBreakdown] = useState<VersionBreakdownData | null>(null);
  const [error, setError] = useState(false);
  const [minVersion, setMinVersion] = useState("");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(50);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "weight", dir: -1 });

  useEffect(() => {
    let cancelled = false;
    setValidators(null);
    setError(false);
    fetch(`/api/chain-validators/${subnetId}?network=${network}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { validators?: L1Validator[]; versionBreakdown?: VersionBreakdownData }) => {
        if (cancelled) return;
        setValidators(data.validators ?? []);
        if (data.versionBreakdown) setVersionBreakdown(data.versionBreakdown);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [subnetId, network]);

  const availableVersions = useMemo(
    () =>
      versionBreakdown
        ? Object.keys(versionBreakdown.byClientVersion)
            .filter((v) => v !== "Unknown")
            .sort()
            .reverse()
        : [],
    [versionBreakdown],
  );
  useEffect(() => {
    if (!minVersion && availableVersions.length > 0) setMinVersion(availableVersions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVersions]);

  const totals = useMemo(() => {
    if (!validators?.length) return null;
    return {
      count: validators.length,
      weight: validators.reduce((sum, v) => sum + (v.weight ?? 0), 0),
      balance: validators.reduce((sum, v) => sum + (v.remainingBalance ?? 0), 0),
    };
  }, [validators]);
  const versionStats =
    versionBreakdown && minVersion ? calculateVersionStats(versionBreakdown, minVersion) : null;

  // snapshot arrives whole; filter and order are pure client-side work
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = (validators ?? []).filter(
      (v) =>
        !q ||
        v.nodeId.toLowerCase().includes(q) ||
        (v.validationId && v.validationId.toLowerCase().includes(q)),
    );
    return [...filtered].sort((a, b) => {
      if (sort.key === "version") {
        return compareVersions(a.version || "0", b.version || "0") * sort.dir;
      }
      return ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * sort.dir;
    });
  }, [validators, q, sort]);

  // click cycles desc → asc
  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key !== key ? { key, dir: -1 } : { key, dir: s.dir === -1 ? 1 : -1 }));
    setShown(50);
  };
  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sort.key === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "text-right uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100",
          active && "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {label}
        {active ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  if (error) return <NotFound label="No validator data for this chain yet" />;

  return (
    <div className="flex flex-col gap-10">
      <StatStrip cols={4}>
        <StatCell label="Validators">
          {totals ? <StatFigure value={totals.count} /> : <StatDash />}
        </StatCell>
        <StatCell label="Total weight">
          {totals ? (
            <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
              {formatWeight(totals.weight)}
            </span>
          ) : (
            <StatDash />
          )}
        </StatCell>
        <StatCell label="Prepaid balance">
          {totals ? (
            <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
              {formatAvax(totals.balance, { compact: true, symbol: false })}
              <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
            </span>
          ) : (
            <StatDash />
          )}
        </StatCell>
        <StatCell label={`On ${minVersion || "latest"} · nodes`}>
          {versionStats ? (
            <span
              className={cn(
                "font-mono text-xl tabular-nums tracking-tight sm:text-2xl md:text-[1.75rem]",
                versionStats.nodesPercentAbove >= 80
                  ? "text-emerald-600 dark:text-emerald-400"
                  : versionStats.nodesPercentAbove > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-[#E6212F]",
              )}
            >
              {versionStats.nodesPercentAbove.toFixed(1)}%
            </span>
          ) : (
            <StatDash />
          )}
        </StatCell>
      </StatStrip>

      {versionBreakdown && availableVersions.length > 0 && totals && (
        <VersionBreakdownCard
          versionBreakdown={versionBreakdown}
          availableVersions={availableVersions}
          minVersion={minVersion}
          onVersionChange={setMinVersion}
          totalValidators={totals.count}
        />
      )}

      <section className="flex flex-col gap-4">
        <SectionHeader
          label={`Validator set${
            validators?.length
              ? ` · ${q ? `${rows.length} / ${validators.length}` : validators.length}`
              : ""
          }`}
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(50);
          }}
          placeholder="Filter by NodeID or ValidationID…"
          spellCheck={false}
          className="w-full max-w-xs border border-zinc-200 bg-white/80 px-3 py-1.5 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
        />
        {validators === null && (
          <div className="h-40 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        )}
        {validators !== null && (
          <>
            <Board>
              <div className="hidden grid-cols-[minmax(19rem,1.6fr)_0.9fr_0.7fr_0.8fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Node</span>
                <SortHeader label="Version" k="version" />
                <SortHeader label="Weight" k="weight" />
                <SortHeader label="Balance" k="remainingBalance" />
                <SortHeader label="Joined" k="creationTimestamp" />
              </div>
              {rows.slice(0, shown).map((v) => (
                <Link
                  key={v.validationId ?? v.nodeId}
                  href={`${base}/node/${v.nodeId}`}
                  className="group grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[minmax(19rem,1.6fr)_0.9fr_0.7fr_0.8fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className="truncate font-mono text-[12px] text-[#0061E2] group-hover:underline dark:text-[#5f9dff]">
                    {v.nodeId}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums md:text-right",
                      !v.version || v.version === "Unknown"
                        ? "text-zinc-400 dark:text-zinc-500"
                        : minVersion && compareVersions(v.version, minVersion) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    {v.version || "Unknown"}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                    {formatWeight(v.weight ?? 0)}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums md:text-right",
                      (v.remainingBalance ?? 0) === 0
                        ? "text-[#E6212F]"
                        : "text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    {formatAvax(v.remainingBalance, { compact: true })}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    {timeAgo(v.creationTimestamp)}
                  </span>
                </Link>
              ))}
              {rows.length === 0 && (
                <div className="flex items-baseline gap-3 px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  No validators match
                  {q && (
                    <button
                      onClick={() => {
                        setQuery("");
                        setShown(50);
                      }}
                      className="uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
            </Board>
            {shown < rows.length && (
              <button
                onClick={() => setShown((s) => s + 50)}
                className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
              >
                Load more
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
