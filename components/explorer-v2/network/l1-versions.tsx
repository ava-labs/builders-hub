"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, EmptyRow, LoadMore, RowSkeleton, SectionHeader } from "@/components/explorer-v2/ui";
import { PRIMARY_NETWORK_ID, mixOf, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { compareVersions, defaultVersionTarget } from "@/components/stats/VersionBreakdown";
import type { VersionMix } from "@/components/explorer-v2/network/icm-map";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* Every validated set's AvalancheGo versions, one row per chain. A large
   screen reads them off the city's windows (the Versions lens); a phone
   gets the district browser there, so this board carries the same feed
   onto the overview, where a phone lands first. Same target rule as the
   city: the newest version with real adoption, not a canary's. */

const catalogBySubnet = new Map(
  (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true && c.subnetId).map((c) => [String(c.subnetId), c]),
);

/** rows before the board asks to be opened */
const SHORT = 8;

/* the city's version palette: green on target, amber a minor behind, red older, gray unreported */
function dotOf(version: string, target: string): string {
  if (version === "Unknown") return "bg-zinc-400 dark:bg-zinc-500";
  if (compareVersions(version, target) >= 0) return "bg-green-600";
  const t = /^(\d+)\.(\d+)/.exec(target);
  const x = /^(\d+)\.(\d+)/.exec(version);
  return x && t && x[1] === t[1] && Number(x[2]) === Number(t[2]) - 1 ? "bg-amber-500" : "bg-[#E6212F]";
}

/* the share on target in the same ink: green from 80%, red with any older node, amber else */
function shareInk(mix: VersionMix, pct: number): string {
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
  return mix.stale > 0 ? "text-[#E6212F]" : "text-amber-600 dark:text-amber-400";
}

interface VersionRow {
  id: string;
  name: string;
  logo?: string;
  href?: string;
  nodes: number;
  /** newest first, unreported last */
  versions: [string, number][];
  mix: VersionMix;
}

export function L1Versions({ className }: { className?: string }) {
  const { subnets, error } = useValidatorStats();
  const [open, setOpen] = useState(false);

  const { target, rows } = useMemo(() => {
    const fleet: Record<string, { nodes: number }> = {};
    for (const sn of subnets ?? []) for (const [v, d] of Object.entries(sn.byClientVersion)) fleet[v] = { nodes: (fleet[v]?.nodes ?? 0) + d.nodes };
    const target = defaultVersionTarget(fleet);
    const rows: VersionRow[] = [];
    for (const sn of subnets ?? []) {
      const versions = Object.entries(sn.byClientVersion)
        .map(([v, d]) => [v, d.nodes] as [string, number])
        .filter(([, n]) => n > 0)
        .sort((a, b) => (a[0] === "Unknown" ? 1 : b[0] === "Unknown" ? -1 : compareVersions(b[0], a[0])));
      const nodes = versions.reduce((sum, [, n]) => sum + n, 0);
      if (nodes === 0) continue;
      const primary = sn.id === PRIMARY_NETWORK_ID;
      const c = catalogBySubnet.get(sn.id);
      rows.push({
        id: sn.id,
        name: primary ? "Primary Network" : (c?.chainName ?? sn.name),
        logo: c?.chainLogoURI ?? sn.chainLogoURI,
        // each chain's validators tab carries its set's nodes and versions
        href: primary ? "/explorer/mainnet/p-chain/validators" : c?.slug ? `/explorer/mainnet/${c.slug}/validators` : undefined,
        nodes,
        versions,
        mix: mixOf(sn.byClientVersion, target),
      });
    }
    // the Primary Network leads, then the sets by size
    rows.sort((a, b) => Number(b.id === PRIMARY_NETWORK_ID) - Number(a.id === PRIMARY_NETWORK_ID) || b.nodes - a.nodes);
    return { target, rows };
  }, [subnets]);

  const shown = open ? rows : rows.slice(0, SHORT);

  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <SectionHeader
        label="L1 Versions"
        action={
          target && (
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
              Target {target}
            </span>
          )
        }
      />
      <Board>
        {!subnets && !error && <RowSkeleton n={6} />}
        {error && <EmptyRow>Validator versions are unavailable right now.</EmptyRow>}
        {shown.map((r) => {
          const pct = Math.round((r.mix.on / r.nodes) * 100);
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-2.5">
                {r.logo ? (
                  <img src={r.logo} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{r.name}</span>
                <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", shareInk(r.mix, pct))}>
                  {pct}% on {target}+
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[26px] font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {r.versions.map(([v, n]) => (
                  <span key={v} title={`${n} nodes`} className="flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotOf(v, target))} />
                    <span className="text-zinc-900 dark:text-zinc-100">{v === "Unknown" ? "unreported" : `v${v}`}</span>
                    {n}
                  </span>
                ))}
              </span>
            </>
          );
          const cls = "flex flex-col gap-1.5 px-5 py-2.5 md:px-6";
          return r.href ? (
            <Link key={r.id} href={r.href} className={cn(cls, "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
              {body}
            </Link>
          ) : (
            <div key={r.id} className={cls}>
              {body}
            </div>
          );
        })}
      </Board>
      {rows.length > SHORT && (
        <LoadMore onClick={() => setOpen((v) => !v)} label={open ? "Show fewer" : `Show all ${rows.length} chains`} />
      )}
    </section>
  );
}
