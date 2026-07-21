"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, CellLabel, SectionHeader } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import {
  VersionBarChart,
  VersionLabels,
  calculateVersionStats,
  compareVersions,
  type VersionBreakdownData,
} from "@/components/stats/VersionBreakdown";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import type { ValidatorsResponse } from "@/lib/pchain-explorer";

const PRIMARY_NETWORK_ID = "11111111111111111111111111111111LpoYY";

/* Network health — the stats surface folded into the explorer: client
   version breakdown for the Primary Network (per network) and the
   hand-off to the full staking dashboard (which owns the world map). */
function NetworkHealth({ network }: { network: string }) {
  const [versions, setVersions] = useState<VersionBreakdownData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/validator-stats?network=${network}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((subnets: { id: string; byClientVersion?: VersionBreakdownData["byClientVersion"]; totalStakeString?: string }[]) => {
        if (cancelled) return;
        const primary = subnets.find((s) => s.id === PRIMARY_NETWORK_ID);
        if (primary?.byClientVersion) {
          setVersions({
            byClientVersion: primary.byClientVersion,
            totalStakeString: primary.totalStakeString,
          });
        }
      })
      .catch(() => {
        /* the health strip is additive; the validator table stands alone */
      });
    return () => {
      cancelled = true;
    };
  }, [network]);

  const latest = versions
    ? Object.keys(versions.byClientVersion).sort((a, b) => compareVersions(b, a))[0]
    : null;
  const stats = versions && latest ? calculateVersionStats(versions, latest) : null;
  const totalNodes = versions
    ? Object.values(versions.byClientVersion).reduce((sum, v) => sum + v.nodes, 0)
    : 0;

  if (!versions || !latest || !stats) return null;

  return (
    <Board divide={false}>
          <div className="flex h-full flex-col gap-4 px-5 py-5 md:px-6">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                Client versions · Primary Network
              </span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                {stats.nodesPercentAbove.toFixed(1)}% of nodes on {latest}
              </span>
            </div>
            <VersionBarChart versionBreakdown={versions} minVersion={latest} totalNodes={totalNodes} />
            <VersionLabels versionBreakdown={versions} minVersion={latest} totalNodes={totalNodes} />
            <p className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {stats.stakePercentAbove.toFixed(1)}% of stake runs the latest client
            </p>
            {network === "mainnet" && (
              <Link
                href="/stats/validators/c-chain"
                className="group mt-auto inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              >
                Full staking dashboard
                <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
              </Link>
            )}
          </div>
    </Board>
  );
}

export function PchainValidators({ chain, network }: { chain: string; network: string }) {
  return (
    <ExplorerShell chain={chain} network={network}>
      <ValidatorsContent network={network} base={`/explorer/${network}/${chain}`} />
    </ExplorerShell>
  );
}

/* The validators body, shell-agnostic (like ChainDetailsContent): the
   P-Chain route wraps it in the P-Chain shell; the C-Chain mounts it under
   its own Validators tab — same set, no context switch. `base` is the
   P-Chain explorer base, where the node detail pages live. */
export function ValidatorsContent({ network, base }: { network: string; base: string }) {
  const { data, loading, error } = usePchainData<ValidatorsResponse>(network, "validators");
  const [shown, setShown] = useState(50);
  const validators = data?.validators ?? [];

  return (
      <section className="flex flex-col gap-4">
        <NetworkHealth network={network} />
        <SectionHeader
          label={`Validators${validators.length ? ` · ${validators.length}` : ""}`}
          action={
            data?.snapshotTimestamp ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                snapshot {timeAgo(data.snapshotTimestamp)}
              </span>
            ) : undefined
          }
        />
        {loading && <div className="h-40 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
        {error && <NotFound label="No validator snapshot for this network yet" />}
        {data && (
          <>
            <Board>
              <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_0.6fr_0.7fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Node</span>
                <span className="text-right">Total Stake</span>
                <span className="text-right">Delegators</span>
                <span className="text-right">Fee</span>
                <span className="text-right">Uptime</span>
                <span className="text-right">Status</span>
              </div>
              {validators.slice(0, shown).map((v) => (
                <Link
                  key={`${v.nodeId}-${v.subnetId}`}
                  href={`${base}/node/${v.nodeId}`}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.6fr_1fr_0.7fr_0.6fr_0.7fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                    {truncate(v.nodeId, 18)}
                  </span>
                  <div className="font-mono text-[11px] tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                    <CellLabel>Total Stake</CellLabel>
                    {formatAvax(v.totalStake, { compact: true })}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    <CellLabel>Delegators</CellLabel>
                    {formatNumber(v.delegatorCount)}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    <CellLabel>Fee</CellLabel>
                    {v.delegationFeePercent}%
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    <CellLabel>Uptime</CellLabel>
                    {v.uptimePercent.toFixed(1)}%
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.1em] md:text-right ${
                      v.connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {v.connected ? "online" : "offline"}
                  </span>
                </Link>
              ))}
            </Board>
            {shown < validators.length && (
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
  );
}
