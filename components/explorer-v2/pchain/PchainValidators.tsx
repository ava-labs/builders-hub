"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { PrimaryStakingContent } from "@/components/explorer-v2/staking/PrimaryStaking";
import { PrimaryValidatorsContent } from "@/components/explorer-v2/staking/PrimaryValidators";
import { Board, CellLabel, SectionHeader, TypeFilterRail } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, timeAgo } from "@/components/explorer-v2/format";
import {
  VersionBarChart,
  VersionLabels,
  calculateVersionStats,
  compareVersions,
  type VersionBreakdownData,
} from "@/components/stats/VersionBreakdown";
import { usePchainData } from "./hooks";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import { NotFound } from "./PchainTx";
import type { ValidatorsResponse, ValidatorSummary } from "@/lib/pchain-explorer";
import { cn } from "@/lib/utils";

/* Numeric columns the table can order by — all present on every row. */
type SortKey = "totalStake" | "delegatorCount" | "delegationFeePercent" | "uptimePercent";

/* Network health — the stats surface folded into the explorer: client
   version breakdown for the Primary Network (per network) and the
   hand-off to the full staking dashboard (which owns the world map). */
function NetworkHealth({ network }: { network: string }) {
  // additive: if the shared feed fails, the validator table stands alone
  const { subnets } = useValidatorStats(network);
  const versions = useMemo<VersionBreakdownData | null>(() => {
    const primary = subnets?.find((s) => s.id === PRIMARY_NETWORK_ID);
    return primary?.byClientVersion
      ? { byClientVersion: primary.byClientVersion, totalStakeString: primary.totalStakeString }
      : null;
  }, [subnets]);

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
                href="/explorer/mainnet/c-chain/validators"
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
      {/* the Primary Network's set secures P, C, and X alike — mainnet gets
          the list-first roster the C-Chain tab also mounts; Fuji keeps the
          plain set list (the roster's p2p feeds are mainnet-only) */}
      {network === "mainnet" ? (
        <PrimaryValidatorsContent stakingHref={`/explorer/${network}/${chain}/staking`} />
      ) : (
        <ValidatorsContent network={network} base={`/explorer/${network}/${chain}`} />
      )}
    </ExplorerShell>
  );
}

/* The P-Chain's Staking tab — the economics half of the old observatory,
   split out so the validator roster stands alone above. Mainnet only;
   the route redirects Fuji to the validators list. */
export function PchainStaking({ chain, network }: { chain: string; network: string }) {
  return (
    <ExplorerShell chain={chain} network={network}>
      {/* purely the Primary Network's staking economy — the ACP-77 L1
          seat market lives on its own L1s tab (staking mints; seats burn:
          different economies, different doors) */}
      <PrimaryStakingContent
        validatorsHref={`/explorer/${network}/${chain}/validators`}
        base={`/explorer/${network}/${chain}/staking`}
        network={network}
      />
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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const validators = data?.validators ?? [];

  // The snapshot arrives whole, so filtering/sorting is pure client-side
  // work: NodeID substring + connection status, composed, then ordered.
  const q = query.trim().toLowerCase();
  const filtered = validators.filter(
    (v) =>
      (!q || v.nodeId.toLowerCase().includes(q)) &&
      (!status || (status === "online") === v.connected),
  );
  const rows = sort
    ? [...filtered].sort(
        (a: ValidatorSummary, b: ValidatorSummary) => (a[sort.key] - b[sort.key]) * sort.dir,
      )
    : filtered;
  const isFiltered = Boolean(q || status);

  // Click cycles desc → asc → snapshot order.
  const toggleSort = (key: SortKey) => {
    setSort((s) => (s?.key !== key ? { key, dir: -1 } : s.dir === -1 ? { key, dir: 1 } : null));
    setShown(50);
  };
  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sort?.key === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "text-right uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100",
          active && "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {label}
        {active ? (sort!.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    );
  };

  return (
      <section className="flex flex-col gap-4">
        <NetworkHealth network={network} />
        <SectionHeader
          label={`Validators${
            validators.length
              ? ` · ${isFiltered ? `${filtered.length} / ${validators.length}` : validators.length}`
              : ""
          }`}
          action={
            data?.snapshotTimestamp ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                snapshot {timeAgo(data.snapshotTimestamp)}
              </span>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(50);
            }}
            placeholder="Filter by NodeID…"
            spellCheck={false}
            className="w-full max-w-xs border border-zinc-200 bg-white/80 px-3 py-1.5 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
          />
          <TypeFilterRail
            options={[
              { value: "", label: "All" },
              { value: "online", label: "Online" },
              { value: "offline", label: "Offline" },
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setShown(50);
            }}
          />
        </div>
        {loading && <div className="h-40 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
        {error && <NotFound label="No validator snapshot for this network yet" />}
        {data && (
          <>
            <Board>
              <div className="hidden grid-cols-[minmax(19rem,1.6fr)_1fr_0.7fr_0.6fr_0.7fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Node</span>
                <SortHeader label="Total Stake" k="totalStake" />
                <SortHeader label="Delegators" k="delegatorCount" />
                <SortHeader label="Fee" k="delegationFeePercent" />
                <SortHeader label="Uptime" k="uptimePercent" />
                <span className="text-right">Status</span>
              </div>
              {rows.slice(0, shown).map((v) => (
                <Link
                  key={`${v.nodeId}-${v.subnetId}`}
                  href={`${base}/node/${v.nodeId}`}
                  className="group grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[minmax(19rem,1.6fr)_1fr_0.7fr_0.6fr_0.7fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className="truncate font-mono text-[12px] text-[#0061E2] group-hover:underline dark:text-[#5f9dff]">
                    {v.nodeId}
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
              {rows.length === 0 && (
                <div className="flex items-baseline gap-3 px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  No validators match
                  {isFiltered && (
                    <button
                      onClick={() => {
                        setQuery("");
                        setStatus("");
                        setShown(50);
                      }}
                      className="uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                    >
                      Clear filters
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
  );
}
