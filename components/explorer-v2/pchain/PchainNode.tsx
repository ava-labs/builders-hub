"use client";

import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, HashChip, SectionHeader, SpecPlate, SpecRow, TxTypePill } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import type { NodeResponse } from "@/lib/pchain-explorer";

export function PchainNode({ chain, network, nodeId }: { chain: string; network: string; nodeId: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: n, loading, error } = usePchainData<NodeResponse>(network, `node/${nodeId}`);

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <div className="h-40 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
      {error && <NotFound label="Node not found" id={nodeId} />}
      {n && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Node"
              action={
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    n.validator.connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      n.validator.connected ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
                    }`}
                  />
                  {n.validator.connected ? "Connected" : "Offline"}
                </span>
              }
            />
            <div className="px-1">
              <HashChip value={n.nodeId} len={64} />
            </div>
            {!n.hasSnapshot && (
              <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                Not in the latest validator snapshot — showing on-chain history.
              </p>
            )}
          </section>

          {/* Summary tiles */}
          {n.hasSnapshot && (
            <Board divide={false}>
              <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
                <Tile label="TOTAL STAKE" value={formatAvax(n.validator.totalStake, { compact: true })} />
                <Tile label="DELEGATORS" value={formatNumber(n.validator.delegatorCount)} />
                <Tile label="UPTIME" value={`${n.uptime.currentP50.toFixed(1)}%`} />
                <Tile label="DAYS LEFT" value={formatNumber(n.validator.daysLeft)} />
              </div>
            </Board>
          )}

          {/* Validator detail */}
          {n.hasSnapshot && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="Validation" />
              <Board divide={false} className="px-5 py-4 md:px-6">
                <SpecPlate>
                  <SpecRow label="Subnet">
                    <HashChip value={n.validator.subnetId} len={24} />
                  </SpecRow>
                  {n.validator.validationId && (
                    <SpecRow label="Validation ID">
                      <HashChip value={n.validator.validationId} len={24} />
                    </SpecRow>
                  )}
                  <SpecRow label="Weight">{formatAvax(n.validator.weight)}</SpecRow>
                  <SpecRow label="Delegated">{formatAvax(n.validator.delegatorWeight)}</SpecRow>
                  <SpecRow label="Delegation Fee">{n.validator.delegationFeePercent}%</SpecRow>
                  <SpecRow label="Potential Reward">{formatAvax(n.validator.potentialReward)}</SpecRow>
                  <SpecRow label="Start">{formatTime(n.validator.startTimestamp)}</SpecRow>
                  <SpecRow label="End">{formatTime(n.validator.endTimestamp)}</SpecRow>
                  <SpecRow label="Proposed (14d)">{formatNumber(n.proposedBlocks14d)}</SpecRow>
                </SpecPlate>
              </Board>
            </section>
          )}

          {/* Uptime */}
          {n.uptime.sampleCount > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="Uptime" />
              <Board divide={false} className="flex flex-col gap-4 px-5 py-5 md:px-6">
                <Sparkline points={n.uptimeHistory.map((h) => h.p50Uptime)} />
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
                  {[
                    { l: "MIN", v: n.uptime.min },
                    { l: "AVG", v: n.uptime.avg },
                    { l: "P50", v: n.uptime.p50 },
                    { l: "P95", v: n.uptime.p95 },
                    { l: "MAX", v: n.uptime.max },
                  ].map((s) => (
                    <div key={s.l} className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                        {s.l}
                      </span>
                      <span className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        {s.v.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </Board>
            </section>
          )}

          {/* Validations */}
          {n.validations.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Validations · ${n.validations.length}`} />
              <Board>
                {n.validations.map((v, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 md:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                        {v.kind}
                      </span>
                      <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">{truncate(v.subnetId, 16)}</span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {v.kind === "l1" ? formatAvax(v.balance) : formatAvax(v.weight)}
                    </span>
                  </div>
                ))}
              </Board>
            </section>
          )}

          {/* Delegators */}
          {n.delegators.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader
                label={`Delegators · ${n.delegators.length}`}
                action={
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    Σ reward {formatAvax(n.delegatorsPotentialReward, { compact: true })}
                  </span>
                }
              />
              <Board>
                {n.delegators.slice(0, 100).map((d) => (
                  <Link
                    key={d.txId}
                    href={`${base}/tx/${d.txId}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">{truncate(d.txId, 16)}</span>
                    <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      <span>{formatAvax(d.stakeAmount, { compact: true })}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatAvax(d.potentialReward, { compact: true })}
                      </span>
                    </div>
                  </Link>
                ))}
              </Board>
            </section>
          )}

          {/* Node info */}
          {n.nodeInfo && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="Node Info" />
              <Board divide={false} className="px-5 py-4 md:px-6">
                <SpecPlate>
                  <SpecRow label="Version">{n.nodeInfo.version || "—"}</SpecRow>
                  <SpecRow label="Public IP">{n.nodeInfo.publicIp || "—"}</SpecRow>
                  <SpecRow label="Observed Uptime">{n.nodeInfo.observedUptime.toFixed(1)}%</SpecRow>
                </SpecPlate>
              </Board>
            </section>
          )}

          {/* History */}
          {n.history.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`History · ${n.history.length}`} />
              <Board>
                {n.history.map((h) => (
                  <Link
                    key={h.txHash}
                    href={`${base}/tx/${h.txHash}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                        {truncate(h.txHash, 16)}
                      </span>
                      <TxTypePill type={h.txType.replace(/Tx$/, "")} />
                    </div>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {timeAgo(h.blockTimestamp)}
                    </span>
                  </Link>
                ))}
              </Board>
            </section>
          )}
        </div>
      )}
    </ExplorerShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="font-mono text-lg tabular-nums tracking-tight text-zinc-900 md:text-xl dark:text-zinc-50">{value}</span>
    </div>
  );
}

/** Hand-rolled SVG sparkline (no chart lib — landing-v2 idiom). */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div className="h-16 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Not enough samples</div>;
  }
  const w = 600;
  const h = 56;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full">
      <path d={path} fill="none" stroke="#E6212F" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
