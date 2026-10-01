"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { PrimaryStakingContent } from "@/components/explorer-v2/staking/PrimaryStaking";
import { PrimaryValidatorsContent } from "@/components/explorer-v2/staking/PrimaryValidators";
import { L1ValidatorSetContent } from "@/components/explorer-v2/staking/L1ValidatorSet";
import { ValidatorSetSwitch } from "@/components/explorer-v2/evm/views";
import { Board, CellLabel, EmptyRow, HEAD, INK, LoadMore, MUTED, ROW, RowDoor, SectionHeader, TypeFilterRail, idInk } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, timeAgo } from "@/components/explorer-v2/format";
import { NotFound } from "@/components/explorer-v2/detail-parts";
import {
  VersionBarChart,
  VersionLabels,
  calculateVersionStats,
  type VersionBreakdownData,
  defaultVersionTarget,
} from "@/components/stats/VersionBreakdown";
import { usePchainData } from "./hooks";
import { PRIMARY_NETWORK_ID, useValidatorStats } from "@/components/explorer-v2/validator-stats";
import type { ValidatorsResponse, ValidatorSummary } from "@/lib/pchain-explorer";
import { cn } from "@/lib/utils";

/* Numeric columns the table can order by: all present on every row. */
type SortKey = "totalStake" | "delegatorCount" | "delegationFeePercent" | "uptimePercent";
const COLS = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]";

/* Network health: the stats surface folded into the explorer, client
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

  // newest version with real adoption, not the highest one present
  const latest = versions ? defaultVersionTarget(versions.byClientVersion) || null : null;
  const stats = versions && latest ? calculateVersionStats(versions, latest) : null;
  const totalNodes = versions ? Object.values(versions.byClientVersion).reduce((sum, v) => sum + v.nodes, 0) : 0;

  if (!versions || !latest || !stats) return null;

  return (
    <Board divide={false}>
      <div className="flex h-full flex-col gap-4 px-5 py-5 md:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Client Versions · Primary Network</span>
          <span className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
            {stats.nodesPercentAbove.toFixed(1)}% of nodes on {latest}
          </span>
        </div>
        <VersionBarChart versionBreakdown={versions} minVersion={latest} totalNodes={totalNodes} />
        <VersionLabels versionBreakdown={versions} minVersion={latest} totalNodes={totalNodes} />
        <p className="text-[13px] tabular-nums text-zinc-500 dark:text-zinc-400">{stats.stakePercentAbove.toFixed(1)}% of stake runs the latest client.</p>
        {network === 'mainnet' && (
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
  const base = `/explorer/${network}/${chain}`;
  return (
    <ExplorerShell chain={chain} network={network}>
      {/* the Primary Network's set secures P, C, and X alike: each gets the
          list-first roster the C-Chain tab also mounts, on either network.
          The P-Chain adds a switch to every L1's set, since the P-Chain
          records those seats; the X-Chain has none to show */}
      {chain === "p-chain" ? (
        <div className="flex flex-col gap-6">
          <SectionHeader label="Validator Sets" action={<ValidatorSetSwitch base={base} view="primary" />} />
          <PrimaryValidatorsContent stakingHref={`${base}/staking`} network={network} />
        </div>
      ) : (
        <PrimaryValidatorsContent stakingHref={`${base}/staking`} network={network} />
      )}
    </ExplorerShell>
  );
}

/* The tab's other set: every L1's validators, on either network. */
export function PchainL1Validators({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  return (
    <ExplorerShell chain={chain} network={network}>
      <div className="flex flex-col gap-6">
        <SectionHeader label="Validator Sets" action={<ValidatorSetSwitch base={base} view="l1s" />} />
        <L1ValidatorSetContent network={network} />
        {/* the two sets share the P-Chain's record, not the work */}
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          L1 validators validate only their own L1, not the Primary Network. They stake no AVAX: each pays a continuous fee from its prepaid balance.
        </p>
      </div>
    </ExplorerShell>
  );
}

/* The P-Chain's Staking tab: the economics half of the old observatory,
   split out so the validator roster stands alone above. Mainnet only;
   the route redirects Fuji to the validators list. */
export function PchainStaking({ chain, network }: { chain: string; network: string }) {
  return (
    <ExplorerShell chain={chain} network={network}>
      {/* purely the Primary Network's staking economy: the ACP-77 L1
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
   its own Validators tab: same set, no context switch. `base` is the
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
            <Board divide={false}>
              <div className={cn(HEAD, COLS, "border-b border-zinc-200 dark:border-zinc-800")}>
                <span>Node</span>
                <SortHeader label="Total Stake" k="totalStake" />
                <SortHeader label="Delegators" k="delegatorCount" />
                <SortHeader label="Fee" k="delegationFeePercent" />
                <SortHeader label="Uptime" k="uptimePercent" />
                <span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.slice(0, shown).map((v) => (
                  <RowDoor key={`${v.nodeId}-${v.subnetId}`} href={`${base}/node/${v.nodeId}`} className={cn(ROW, COLS)}>
                    <span className={cn("truncate font-mono text-[12.5px]", idInk)}>{v.nodeId}</span>
                    <span className={cn(INK, "text-right")}>
                      <CellLabel>Total Stake</CellLabel>
                      {formatAvax(v.totalStake, { compact: true })}
                    </span>
                    <span className={cn(MUTED, "md:text-right")}>
                      <CellLabel>Delegators</CellLabel>
                      {formatNumber(v.delegatorCount)}
                    </span>
                    <span className={cn(MUTED, "text-right")}>
                      <CellLabel>Fee</CellLabel>
                      {v.delegationFeePercent}%
                    </span>
                    <span className={cn(MUTED, "md:text-right")}>
                      <CellLabel>Uptime</CellLabel>
                      {v.uptimePercent.toFixed(1)}%
                    </span>
                    <span className={cn("text-right font-mono text-[10px] uppercase tracking-[0.1em]", v.connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500")}>
                      {v.connected ? "online" : "offline"}
                    </span>
                  </RowDoor>
                ))}
              </div>
              {rows.length === 0 && (
                <EmptyRow>
                  No validators match
                  {isFiltered && (
                    <button
                      onClick={() => {
                        setQuery("");
                        setStatus("");
                        setShown(50);
                      }}
                      className="ml-3 uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                    >
                      Clear filters
                    </button>
                  )}
                </EmptyRow>
              )}
            </Board>
            {shown < rows.length && (
              <LoadMore onClick={() => setShown((s) => s + 50)} />
            )}
          </>
        )}
      </section>
  );
}
