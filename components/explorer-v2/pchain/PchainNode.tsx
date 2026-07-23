"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  YAxis,
} from "recharts";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
  TxTypePill,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import { getCurrentValidators, type CurrentValidator } from "@/lib/pchain-node";
import type { NodeResponse } from "@/lib/pchain-explorer";

/* The node page as one instrument, not an endless scroll: a bold summary
   strip, then two split views — what the validator IS (the spec plate)
   beside how it's PERFORMING (the hourly charts folded in from the old
   /stats/validators/node page) — and the long lists capped behind
   expanders. */

/* --- the P2P observatory feed (hourly uptime, block production, slots) --- */

interface P2PDetail {
  current_p50_uptime: number;
  miss_rate_14d: number;
  missed_14d: number;
  proposed_14d: number;
  uptime: { bucket: string; p50_uptime: number }[];
  blocks: { hour: string; proposed: number; missed: number }[];
  slots: { slot: number; cnt: number }[];
}

function useP2PDetail(nodeId: string, enabled: boolean) {
  const [data, setData] = useState<P2PDetail | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/validators/${encodeURIComponent(nodeId)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
    return () => controller.abort();
  }, [nodeId, enabled]);
  return data;
}

const LIST_CAP = 8;

export function PchainNode({
  chain,
  network,
  nodeId,
  subnetHint,
}: {
  chain: string;
  network: string;
  nodeId: string;
  /** subnet the caller knows this node validates — lets us ask the P-Chain
   *  directly when the indexer (Primary Network only) has never seen it */
  subnetHint?: string;
}) {
  const base = `/explorer/${network}/${chain}`;
  const { data: n, loading, error } = usePchainData<NodeResponse>(network, `node/${nodeId}`);
  // the P2P observatory only watches mainnet's Primary Network
  const p2p = useP2PDetail(nodeId, network === "mainnet" && Boolean(n?.hasSnapshot));

  // L1-only validators never stake on the Primary Network, so the indexer
  // 404s on them. With a subnet hint we go straight to the node:
  // platform.getCurrentValidators({subnetID, nodeIDs}).
  const [l1, setL1] = useState<CurrentValidator | null>(null);
  const [l1Checked, setL1Checked] = useState(false);
  useEffect(() => {
    if (!error || !subnetHint) return;
    let cancelled = false;
    getCurrentValidators(network, subnetHint, [nodeId]).then((vs) => {
      if (cancelled) return;
      setL1(vs?.[0] ?? null);
      setL1Checked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [error, subnetHint, network, nodeId]);

  const [showAllDelegators, setShowAllDelegators] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const uptimeSeries = useMemo(
    () =>
      p2p?.uptime?.length
        ? p2p.uptime.map((u) => ({ t: u.bucket, v: u.p50_uptime }))
        : (n?.uptimeHistory ?? []).map((h, i) => ({ t: String(i), v: h.p50Uptime })),
    [p2p, n],
  );
  const blocksSeries = useMemo(
    () => (p2p?.blocks ?? []).map((b) => ({ t: b.hour, proposed: b.proposed, missed: b.missed })),
    [p2p],
  );
  const slots = useMemo(() => {
    if (!p2p?.slots?.length) return null;
    const total = p2p.slots.reduce((s, x) => s + x.cnt, 0);
    if (total === 0) return null;
    const at = (s: number) => p2p.slots.find((x) => x.slot === s)?.cnt ?? 0;
    const slot2plus = total - at(0) - at(1);
    return { total, slot0: at(0), slot1: at(1), slot2plus };
  }, [p2p]);

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Validator" />}
      {error && subnetHint && !l1Checked && <DetailSkeleton label="Validator" />}
      {error && (!subnetHint || (l1Checked && !l1)) && <NotFound label="Node not found" id={nodeId} />}
      {error && l1 && <L1ValidatorView nodeId={nodeId} subnetId={subnetHint!} v={l1} base={base} />}
      {n && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Node"
              action={
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
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
            <NodeIdHeadline nodeId={n.nodeId} />
            {!n.hasSnapshot && (
              <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                Not in the latest validator snapshot. Showing on-chain history.
              </p>
            )}
          </section>

          {/* the numbers that matter, bold, in one strip */}
          {n.hasSnapshot && (
            <Board divide={false}>
              <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:grid-cols-3 lg:grid-cols-6 sm:divide-y-0 dark:divide-zinc-800">
                <Tile label="Total stake" value={formatAvax(n.validator.totalStake, { compact: true })} strong />
                <Tile label="Delegators" value={formatNumber(n.validator.delegatorCount)} />
                <Tile
                  label="Uptime"
                  value={`${n.uptime.currentP50.toFixed(1)}%`}
                  strong
                  tone={n.uptime.currentP50 >= 98 ? "good" : n.uptime.currentP50 >= 90 ? "warn" : "bad"}
                />
                {/* miss_rate_14d arrives as a percent already (0–100) */}
                <Tile
                  label="Miss rate · 14d"
                  value={p2p ? `${p2p.miss_rate_14d.toFixed(1)}%` : "—"}
                  tone={p2p ? (p2p.miss_rate_14d === 0 ? "good" : p2p.miss_rate_14d < 5 ? "warn" : "bad") : undefined}
                />
                <Tile label="Proposed · 14d" value={formatNumber(p2p?.proposed_14d ?? n.proposedBlocks14d)} />
                <Tile label="Days left" value={formatNumber(n.validator.daysLeft)} />
              </div>
            </Board>
          )}

          {/* split view: what it IS | how it's PERFORMING */}
          {n.hasSnapshot && (
            <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[1fr_1.1fr]">
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
                    <SpecRow label="Own stake">
                      <strong className="font-semibold">{formatAvax(n.validator.weight)}</strong>
                    </SpecRow>
                    <SpecRow label="Delegated">{formatAvax(n.validator.delegatorWeight)}</SpecRow>
                    <SpecRow label="Delegation fee">{n.validator.delegationFeePercent}%</SpecRow>
                    <SpecRow label="Potential reward">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatAvax(n.validator.potentialReward)}
                      </span>
                    </SpecRow>
                    <SpecRow label="Term">
                      {formatTime(n.validator.startTimestamp)} → {formatTime(n.validator.endTimestamp)}
                    </SpecRow>
                    {n.nodeInfo?.version && <SpecRow label="Version">{n.nodeInfo.version}</SpecRow>}
                    {n.nodeInfo?.publicIp && (
                      <SpecRow label="Public IP">
                        <span className="font-mono text-[12px]">{n.nodeInfo.publicIp}</span>
                      </SpecRow>
                    )}
                  </SpecPlate>
                </Board>
              </section>

              <section className="flex flex-col gap-4">
                <SectionHeader
                  label="Performance"
                  action={
                    uptimeSeries.length > 1 ? (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        {p2p?.uptime?.length ? "hourly · 14d" : "snapshots"}
                      </span>
                    ) : undefined
                  }
                />
                <Board divide={false} className="flex flex-col gap-5 px-5 py-5 md:px-6">
                  {/* uptime, hourly */}
                  {uptimeSeries.length > 1 ? (
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={uptimeSeries} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                          <YAxis hide domain={["dataMin", 100]} />
                          <RechartsTooltip
                            cursor={{ stroke: "rgba(161,161,170,0.3)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const d = payload[0].payload as { t: string; v: number };
                              return (
                                <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                                  <p className="text-[10px] text-zinc-500">{d.t}</p>
                                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                    {d.v.toFixed(2)}% uptime
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Area
                            dataKey="v"
                            type="monotone"
                            stroke="#E6212F"
                            strokeWidth={1.5}
                            fill="#E6212F"
                            fillOpacity={0.08}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Not enough samples</p>
                  )}
                  {n.uptime.sampleCount > 0 && (
                    <div className="grid grid-cols-5 gap-4">
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
                          <span className="font-mono text-[13px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {s.v.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* block production, proposed vs missed */}
                  {blocksSeries.length > 1 && (
                    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          Block production
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                          <span className="text-zinc-900 dark:text-zinc-100">{formatNumber(p2p?.proposed_14d ?? 0)}</span>{" "}
                          proposed ·{" "}
                          <span className={p2p && p2p.missed_14d > 0 ? "text-[#E6212F]" : ""}>
                            {formatNumber(p2p?.missed_14d ?? 0)} missed
                          </span>
                        </span>
                      </div>
                      <div className="h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={blocksSeries} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                            <YAxis hide domain={[0, "dataMax"]} />
                            <RechartsTooltip
                              cursor={{ stroke: "rgba(161,161,170,0.3)" }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null;
                                const d = payload[0].payload as { t: string; proposed: number; missed: number };
                                return (
                                  <div className="border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                                    <p className="text-[10px] text-zinc-500">{d.t}</p>
                                    <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                      {d.proposed} proposed
                                    </p>
                                    {d.missed > 0 && (
                                      <p className="text-xs tabular-nums text-[#E6212F]">{d.missed} missed</p>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            <Line dataKey="proposed" type="monotone" stroke="#A2AFB2" strokeWidth={1.5} dot={false} />
                            <Line dataKey="missed" type="monotone" stroke="#E6212F" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* proposal timing: how often it lands its first slot */}
                  {slots && (
                    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          Proposal timing
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                          slot 0 <span className="font-bold text-zinc-900 dark:text-zinc-100">{((slots.slot0 / slots.total) * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden">
                        <div
                          className="bg-zinc-900 dark:bg-zinc-100"
                          style={{ width: `${(slots.slot0 / slots.total) * 100}%` }}
                          title={`Slot 0 · ${formatNumber(slots.slot0)}`}
                        />
                        <div
                          className="bg-[#A2AFB2]"
                          style={{ width: `${(slots.slot1 / slots.total) * 100}%` }}
                          title={`Slot 1 · ${formatNumber(slots.slot1)}`}
                        />
                        <div
                          className="bg-[#E6212F]"
                          style={{ width: `${(slots.slot2plus / slots.total) * 100}%` }}
                          title={`Slot 2+ · ${formatNumber(slots.slot2plus)}`}
                        />
                      </div>
                      <div className="flex gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        <span>■ slot 0 first try</span>
                        <span>slot 1</span>
                        <span className="text-[#E6212F]">slot 2+</span>
                      </div>
                    </div>
                  )}
                </Board>
              </section>
            </div>
          )}

          {/* one validation is already the plate's Subnet row — this strip
              only earns space when the node validates several networks */}
          {n.validations.length > 1 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Validations · ${n.validations.length}`} />
              <Board divide={false}>
                <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-3 dark:divide-zinc-800">
                  {n.validations.map((v, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 md:px-6">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                          {v.kind}
                        </span>
                        <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                          {truncate(v.subnetId, 16)}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {v.kind === "l1" ? formatAvax(v.balance) : formatAvax(v.weight)}
                      </span>
                    </div>
                  ))}
                </div>
              </Board>
            </section>
          )}

          {/* split view: money | record — two symmetric lists, same cap,
              same rhythm, so the rails end together */}
          <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
            {n.delegators.length > 0 && (
              <section className="flex min-w-0 flex-col gap-4">
                <SectionHeader
                  label={`Delegators · ${n.delegators.length}`}
                  action={
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      Σ reward{" "}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatAvax(n.delegatorsPotentialReward, { compact: true })}
                      </span>
                    </span>
                  }
                />
                <Board>
                  {(showAllDelegators ? n.delegators : n.delegators.slice(0, LIST_CAP)).map((d) => (
                    <Link
                      key={d.txId}
                      href={`${base}/tx/${d.txId}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                    >
                      <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">{truncate(d.txId, 16)}</span>
                      <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {formatAvax(d.stakeAmount, { compact: true })}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{formatAvax(d.potentialReward, { compact: true })}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {n.delegators.length > LIST_CAP && (
                    <ExpandRow
                      expanded={showAllDelegators}
                      count={n.delegators.length - LIST_CAP}
                      onClick={() => setShowAllDelegators((v) => !v)}
                    />
                  )}
                </Board>
              </section>
            )}

            {n.history.length > 0 && (
              <section className="flex min-w-0 flex-col gap-4">
                <SectionHeader label={`History · ${n.history.length}`} />
                <Board>
                  {(showAllHistory ? n.history : n.history.slice(0, LIST_CAP)).map((h) => (
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
                  {n.history.length > LIST_CAP && (
                    <ExpandRow
                      expanded={showAllHistory}
                      count={n.history.length - LIST_CAP}
                      onClick={() => setShowAllHistory((v) => !v)}
                    />
                  )}
                </Board>
              </section>
            )}
          </div>
        </div>
      )}
    </ExplorerShell>
  );
}

/* The L1 validator's live record, straight from the P-Chain. Slimmer than
   the indexer view (no uptime history or delegators — L1 validators have
   neither on the Primary Network), but authoritative. */
function L1ValidatorView({
  nodeId,
  subnetId,
  v,
  base,
}: {
  nodeId: string;
  subnetId: string;
  v: CurrentValidator;
  base: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Node"
          action={
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              L1 validator · live from P-Chain
            </span>
          }
        />
        <NodeIdHeadline nodeId={nodeId} />
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionHeader label="L1 Validation" />
          <Board divide={false} className="px-5 py-4 md:px-6">
            <SpecPlate>
              <SpecRow label="Subnet">
                <HashChip value={subnetId} href={`${base}/tx/${subnetId}`} len={24} />
              </SpecRow>
              {v.validationID && (
                <SpecRow label="Validation ID">
                  <HashChip value={v.validationID} len={24} />
                </SpecRow>
              )}
              <SpecRow label="Weight">{formatNumber(Number(v.weight))}</SpecRow>
              {v.balance !== undefined && <SpecRow label="Balance">{formatAvax(v.balance)}</SpecRow>}
              {v.startTime && <SpecRow label="Start">{formatTime(Number(v.startTime))}</SpecRow>}
              {v.publicKey && (
                <SpecRow label="BLS Public Key">
                  <HashChip value={v.publicKey} len={24} />
                </SpecRow>
              )}
            </SpecPlate>
          </Board>
        </section>

        {(v.remainingBalanceOwner || v.deactivationOwner) && (
          <section className="flex flex-col gap-4">
            <SectionHeader label="Owners" />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                {v.remainingBalanceOwner?.addresses?.map((a) => (
                  <SpecRow key={a} label="Remaining Balance">
                    <HashChip value={a} len={24} />
                  </SpecRow>
                ))}
                {v.deactivationOwner?.addresses?.map((a) => (
                  <SpecRow key={a} label="Deactivation">
                    <HashChip value={a} len={24} />
                  </SpecRow>
                ))}
              </SpecPlate>
            </Board>
          </section>
        )}
      </div>
    </div>
  );
}

/* The page's subject, at headline weight: the NodeID is what you came for,
   so it reads like a title — full value, bold mono, one click to copy. */
function NodeIdHeadline({ nodeId }: { nodeId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(nodeId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the text is selectable anyway */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy NodeID"
      className="group flex w-fit max-w-full items-baseline gap-3 text-left"
    >
      <span className="break-all font-mono text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
        {nodeId}
      </span>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 self-center text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 self-center text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400" />
      )}
    </button>
  );
}

function Tile({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  /** the figures eyes should land on first */
  strong?: boolean;
  tone?: "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-[#E6212F]"
          : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={`font-mono tabular-nums tracking-tight ${toneCls} ${
          strong ? "text-xl font-bold md:text-2xl" : "text-lg md:text-xl"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* the escape hatch that keeps long lists from becoming the page */
function ExpandRow({ expanded, count, onClick }: { expanded: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-5 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 md:px-6 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
    >
      {expanded ? "Show less" : `Show ${count} more`}
    </button>
  );
}
