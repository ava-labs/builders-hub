"use client";

import { useEffect, useMemo, useState } from "react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, DetailSkeleton, HashChip, SectionHeader, SpecLine, SpecSheet, SubjectHeadline } from "@/components/explorer-v2/ui";
import { ShareMap } from "@/components/explorer-v2/ShareMap";
import { NotFound, RailRow } from "@/components/explorer-v2/detail-parts";
import { dayLong, dayShort, formatNumber, truncate } from "@/components/explorer-v2/format";
import { uptimeRequirementAt } from "@/constants/helicon";
import { PRIMARY_SUBNET_ID, getCurrentValidators, type CurrentValidator } from "@/lib/pchain-node";
import { isPrimaryTerm, type NodeResponse, type NodeStakingTx, type TxSummary } from "@/lib/pchain-explorer";
import { usePchainData } from "./hooks";
import { SubscribeAlerts } from "./SubscribeAlerts";
import { MAX_TOTAL_STAKE_NAVAX, avax, delegationFeeCut, leadSeat, useConversion, useP2PDetail, useStakeContext, useValidationHistory, validatedAsSubnet } from "./node-data";
import { NodePerformance } from "./node-performance";
import { ActivityTable, DelegatorsTable, SubnetTerms, ValidationHistory, ValidationsTable } from "./node-record";
import { L1ValidatorView } from "./node-l1";
import { STORY, STORY_INK } from "./tx-story";
import { humanPeriod } from "./tx-hooks";

/* The node page, split like the tx and block pages. Left: the stake's
   story in one sentence, the stake map (own stake, delegated, open room
   against the cap) and the current term as a line through time. Right:
   the readings a delegator judges a validator by, in a rail. Then how it
   has performed, its track record, its identifiers whole, and its
   delegations and staking txs as ledgers. A node off the Primary Network
   leads with its L1 seat, and its past terms follow as history. */

const GOOD = "text-emerald-600 dark:text-emerald-400";

export function PchainNode({
  chain,
  network,
  nodeId,
  subnetHint,
}: {
  chain: string;
  network: string;
  nodeId: string;
  /** subnet the caller knows this node validates: lets us ask the P-Chain
   *  directly when the indexer (Primary Network only) has never seen it */
  subnetHint?: string;
}) {
  const base = `/explorer/${network}/${chain}`;
  const { data: n, loading, error } = usePchainData<NodeResponse>(network, `node/${nodeId}`);
  // the P2P observatory only watches mainnet's Primary Network
  const p2p = useP2PDetail(nodeId, network === "mainnet" && Boolean(n?.hasSnapshot));
  // payout owners + BLS identity + the network-share denominator, live
  const { identity, networkStake } = useStakeContext(network, nodeId, Boolean(n?.hasSnapshot));
  // past terms: asked for unconditionally, since the nodes where the track
  // record matters most are the ones no longer in the current snapshot
  const validations = useValidationHistory(network, nodeId);

  // the stake story, derived once: share of the network, delegation
  // headroom, the validator's total take, how far through the term it is
  const stake = useMemo(() => {
    const v = n?.validator;
    if (!v) return null;
    const maxTotal = Math.min(5 * v.weight, MAX_TOTAL_STAKE_NAVAX);
    const capacity = Math.max(0, maxTotal - v.totalStake);
    const sharePct = networkStake ? (v.totalStake / networkStake) * 100 : null;
    // Split each delegation the way the chain does, then sum: not the other
    // way round. avalanchego's reward.Split floors the DELEGATOR's side and
    // gives the validator the remainder, per delegation:
    //   net = floor((1e6 − shares) × gross / 1e6);  fee = gross − net
    // A percentage multiply on the aggregate rounds the other way and lands a
    // nAVAX off on each tile (2026-08-20: 23,065.1 vs the chain's 23,066).
    const feeTake = Number(n.delegators.reduce((sum, d) => sum + delegationFeeCut(d.potentialReward, v.delegationFeePercent), 0n));
    const totalTake = v.potentialReward + feeTake;
    const now = Date.now() / 1000;
    const span = v.endTimestamp - v.startTimestamp;
    const progressPct = span > 0 ? Math.min(100, Math.max(0, ((now - v.startTimestamp) / span) * 100)) : null;
    return { maxTotal, capacity, sharePct, feeTake, totalTake, progressPct };
  }, [n, networkStake]);
  // ACP-267: a validation started after Helicon needs 90% uptime for its reward, an earlier one 80%
  const uptimeReq = uptimeRequirementAt((n?.validator?.startTimestamp ?? Date.now() / 1000) * 1000, network === "fuji" ? "fuji" : "mainnet");
  // an auto-renewed validator's end is its current term's, not the stake's
  const renewal = n?.history.find((h) => h.txHash === n.validator.txId && h.txType === "AddAutoRenewedValidatorTx");
  // pre-Banff validators carry one rewardOwner; later ones split the pair
  const validationPayout = identity?.validationRewardOwner ?? identity?.rewardOwner;
  const delegationPayout = identity?.delegationRewardOwner ?? identity?.rewardOwner;

  // The L1 seat the page leads with. A node off the Primary Network leads
  // with its seat even when it has staking history: those are past terms,
  // often on the very subnet that has since become this L1. The subnet
  // arrives two ways: a ?subnet= hint on the link, or the node document's
  // own validations. Either way the page asks the node for the seat:
  // platform.getCurrentValidators({subnetID, nodeIDs}).
  const l1Subnet = error ? subnetHint : leadSeat(n, subnetHint);
  // the document's own l1 validation on that subnet, shaped like the RPC
  // record: the render fallback when the RPC can't answer (rate limit,
  // outage). The page must never go blank while holding the seat data in hand.
  const l1FromDoc = useMemo<CurrentValidator | null>(() => {
    const v = n?.validations?.find((x) => x.kind === "l1" && x.subnetId === l1Subnet);
    if (!v) return null;
    return { nodeID: nodeId, weight: String(v.weight), balance: v.balance !== undefined ? String(v.balance) : undefined, validationID: v.validationId };
  }, [n, nodeId, l1Subnet]);
  const [l1, setL1] = useState<CurrentValidator | null>(null);
  const [l1Answered, setL1Answered] = useState(false);
  const [l1Checked, setL1Checked] = useState(false);
  useEffect(() => {
    if (!l1Subnet) return;
    let cancelled = false;
    getCurrentValidators(network, l1Subnet, [nodeId]).then((vs) => {
      if (cancelled) return;
      setL1(vs?.[0] ?? null);
      // an empty list is the node's answer; null is a read that failed
      setL1Answered(vs !== null);
      setL1Checked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [l1Subnet, network, nodeId]);
  // the node lists every seat on the L1, an inactive one too: an answer
  // without this node's seat means it has left, whatever the document says
  const seat = l1 ?? (l1Answered ? null : l1FromDoc);
  // the node validated this L1 back when it was a subnet: one line says when it converted
  const conversion = useConversion(network, validatedAsSubnet(l1Subnet, n, validations) ? l1Subnet : undefined);

  const [olderHistory, setOlderHistory] = useState<NodeStakingTx[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | undefined>(undefined);
  const [historyDone, setHistoryDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadOlderHistory = async () => {
    if (historyDone || loadingOlder || !n) return;
    setLoadingOlder(true);
    try {
      const seen = new Set([...n.history.map((h) => h.txHash), ...olderHistory.map((h) => h.txHash)]);
      let cursor = historyCursor;
      for (let hop = 0; hop < 4; hop++) {
        const qs = new URLSearchParams({ node: nodeId, limit: "100" });
        if (cursor !== undefined) qs.set("before", String(cursor));
        const res = await fetch(`/api/pchain/${network}/txs?${qs}`);
        const page: TxSummary[] = res.ok ? await res.json() : [];
        if (page.length === 0) {
          setHistoryDone(true);
          break;
        }
        cursor = page[page.length - 1].blockHeight;
        const fresh = page.filter((t) => !seen.has(t.txHash));
        if (fresh.length > 0) {
          setOlderHistory((o) => [...o, ...fresh.map((t) => ({ txHash: t.txHash, txType: t.txType, blockTimestamp: t.blockTimestamp, period: t.period }))]);
          break;
        }
      }
      setHistoryCursor(cursor);
    } finally {
      setLoadingOlder(false);
    }
  };
  const fullHistory = n ? [...n.history, ...olderHistory] : [];

  // the track record: every closed Primary Network term and what it paid,
  // then the terms it served as a subnet validator
  const terms = validations && (
    <>
      {validations.totals.periods > 0 && <ValidationHistory data={validations} base={base} />}
      {validations.periods.some((p) => !isPrimaryTerm(p)) && <SubnetTerms data={validations} base={base} />}
    </>
  );
  // the networks it validates, its delegations, its staking txs
  const ledgers = n && (
    <>
      {n.validations.length > 1 && <ValidationsTable n={n} />}
      {n.delegators.length > 0 && <DelegatorsTable n={n} base={base} />}
      {n.history.length > 0 && <ActivityTable history={fullHistory} base={base} more={{ done: historyDone, loading: loadingOlder, onMore: loadOlderHistory }} />}
    </>
  );

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Validator" />}
      {l1Subnet && !l1Checked && <DetailSkeleton label="Validator" />}
      {error && (!l1Subnet || (l1Checked && !l1)) && <NotFound label="Node not found" id={nodeId} />}
      {/* the seat view: the RPC record when the node answered, the doc's
          own copy when it couldn't: a rate-limited RPC must not blank a
          page whose data is already in hand. Its past terms follow it. */}
      {l1Subnet && l1Checked && seat && (
        <div className="flex flex-col gap-10">
          <L1ValidatorView
            network={network}
            nodeId={nodeId}
            subnetId={l1Subnet}
            otherSubnets={n?.validations?.filter((x) => x.kind === "l1").map((x) => x.subnetId)}
            v={seat}
            live={!!l1}
            conversion={conversion}
            base={base}
          />
          {terms}
          {ledgers}
        </div>
      )}
      {/* Primary Network validators, and nodes with no l1 seat at all, keep
          the full indexer document view: including the corner where a seat
          should lead but neither the RPC nor the doc could produce one */}
      {n && (!l1Subnet || (l1Checked && !seat)) && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <SectionHeader
              label="Validator"
              action={
                // connection state comes from the Primary Network snapshot:
                // without one it's a zero value, not a real "Offline"
                n.hasSnapshot ? (
                  <span
                    className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                      n.validator.connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${n.validator.connected ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                    {n.validator.connected ? "Connected" : "Offline"}
                  </span>
                ) : undefined
              }
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-col gap-2">
                <SubjectHeadline value={n.nodeId} copyLabel="Copy NodeID" />
                {/* who it is, in one line a human can read */}
                <p className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  {[n.nodeInfo?.version, n.nodeInfo?.publicIp, validations?.totals.firstStart ? `validating since ${dayLong(validations.totals.firstStart)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {/* alerts watch the mainnet Primary Network set only */}
              {network === "mainnet" && n.hasSnapshot && <SubscribeAlerts nodeId={n.nodeId} />}
            </div>
            {!n.hasSnapshot && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Not in the latest validator snapshot. The page shows its on-chain history.</p>}
          </section>

          {/* the split: the stake and the term on the left, the readings a
              delegator judges a validator by in the rail on the right */}
          {n.hasSnapshot && stake && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="flex min-w-0 flex-col gap-6">
                {/* the stake's story: what it staked, who joined, what the term pays */}
                <Board divide={false}>
                  <p className={STORY}>
                    <span className={STORY_INK} title={n.nodeId}>
                      {truncate(n.nodeId, 13)}
                    </span>{" "}
                    stakes <span className={STORY_INK}>{avax(n.validator.weight)}</span> on the Primary Network
                    {/* an auto-renewed stake runs on past its term's end */}
                    {renewal ? (
                      <>
                        {renewal.period ? <>, renewing every {humanPeriod(renewal.period)}</> : null}; this term ends {dayLong(n.validator.endTimestamp).replace(/^\w+, /, "")}
                      </>
                    ) : (
                      <> until {dayLong(n.validator.endTimestamp).replace(/^\w+, /, "")}</>
                    )}
                    {n.validator.delegatorCount > 0 && (
                      <>
                        , with <span className={STORY_INK}>{avax(n.validator.delegatorWeight)}</span> delegated by {formatNumber(n.validator.delegatorCount)}{" "}
                        {n.validator.delegatorCount === 1 ? "delegator" : "delegators"}
                      </>
                    )}
                    . If its uptime stays at {uptimeReq}% or more, the term pays the validator <span className={GOOD}>{avax(stake.totalTake)}</span>
                    {n.validator.delegatorCount > 0 ? (
                      <>
                        {" "}
                        <span className="text-zinc-400 dark:text-zinc-500">
                          ({avax(n.validator.potentialReward)} on its own stake, {avax(stake.feeTake)} in its {n.validator.delegationFeePercent}% fee)
                        </span>{" "}
                        and its delegators <span className={GOOD}>{avax(Math.max(0, n.delegatorsPotentialReward - stake.feeTake))}</span>.
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                </Board>

                {/* the stake map: what fills this validator's weight, against the most it may carry */}
                <ShareMap
                  label="Stake map"
                  summary={`${avax(n.validator.totalStake)} of ${avax(stake.maxTotal)} max`}
                  fmt={(v) => avax(v)}
                  legend={3}
                  parts={[
                    { key: "own", label: "Own stake", value: n.validator.weight, tone: "#18181b", sub: "locked by the operator" },
                    { key: "delegated", label: "Delegated", value: n.validator.delegatorWeight, tone: "#0061E2", sub: `${formatNumber(n.validator.delegatorCount)} delegators` },
                    {
                      key: "open",
                      label: "Open capacity",
                      value: stake.capacity,
                      tone: "#e4e4e7",
                      sub: stake.capacity === 0 ? "full: no room to delegate" : "room left to delegate",
                    },
                  ].filter((p) => p.value > 0 || p.key === "open")}
                  note={
                    stake.capacity === 0
                      ? `This validator is full. Its stake is capped at five times its own stake, and at 3M AVAX, so new delegations cannot join until one ends.`
                      : `${avax(stake.capacity)} of room is left before the cap: five times the own stake, and at most 3M AVAX.`
                  }
                />

                {/* the term, as a line through time */}
                <Board divide={false}>
                  <div className="flex items-baseline justify-between gap-4 px-5 pt-5 md:px-6">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Current Term</span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      {formatNumber(Math.round((n.validator.endTimestamp - n.validator.startTimestamp) / 86400))} days
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 px-5 pb-5 pt-4 md:px-6">
                    <div className="relative h-8">
                      <div className="absolute inset-x-0 top-3 h-2 bg-zinc-100 dark:bg-zinc-900" />
                      <div className="absolute left-0 top-3 h-2 bg-zinc-900 dark:bg-zinc-100" style={{ width: `${(stake.progressPct ?? 0).toFixed(2)}%` }} />
                      {/* today */}
                      <div className="absolute top-0 flex h-8 -translate-x-1/2 flex-col items-center" style={{ left: `${(stake.progressPct ?? 0).toFixed(2)}%` }}>
                        <span className="h-8 w-px bg-zinc-900 dark:bg-zinc-100" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 items-baseline gap-3 font-mono text-[11px] tabular-nums">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Started</span>
                        {dayLong(n.validator.startTimestamp)}
                      </span>
                      <span className="text-center text-zinc-900 dark:text-zinc-50">
                        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Today</span>
                        {stake.progressPct?.toFixed(0)}% done · {formatNumber(n.validator.daysLeft)} days left
                      </span>
                      <span className="text-right text-zinc-500 dark:text-zinc-400">
                        <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Ends</span>
                        {dayLong(n.validator.endTimestamp)}
                      </span>
                    </div>
                  </div>
                </Board>
              </div>

              {/* the readings: the rail stands as tall as the column beside it */}
              <Board divide={false} className="flex flex-col border">
                <RailRow label="Status" sub={n.validator.connected ? "reachable by its peers" : "not reachable right now"}>
                  {n.validator.connected ? <span className={GOOD}>Connected</span> : <span className="text-zinc-400">Offline</span>}
                </RailRow>
                <RailRow label="Uptime" sub={p2p?.uptime?.length ? "peers' median view, last 14 days" : "peers' median view"}>
                  <span className={n.uptime.currentP50 >= uptimeReq ? undefined : "text-[#E6212F]"}>{n.uptime.currentP50.toFixed(2)}%</span>
                </RailRow>
                <RailRow label="Total Stake" sub={stake.sharePct != null ? `${stake.sharePct.toFixed(2)}% of the network` : undefined}>
                  {avax(n.validator.totalStake)}
                </RailRow>
                <RailRow label="Delegation Fee" sub="its cut of delegators' rewards">
                  {n.validator.delegationFeePercent}%
                </RailRow>
                {p2p && (
                  <RailRow
                    label="Blocks"
                    sub={
                      <span className={p2p.missed_14d > 0 ? "text-[#E6212F]" : undefined}>
                        {formatNumber(p2p.missed_14d)} missed · {p2p.miss_rate_14d.toFixed(1)}% · last 14 days
                      </span>
                    }
                  >
                    {formatNumber(p2p.proposed_14d)} proposed
                  </RailRow>
                )}
                <RailRow label="Term Ends" sub={`${formatNumber(n.validator.daysLeft)} days left`}>
                  {dayShort(n.validator.endTimestamp)}
                </RailRow>
              </Board>
            </div>
          )}

          {/* how it has performed: uptime by the hour, blocks by the day */}
          {n.hasSnapshot && <NodePerformance n={n} p2p={p2p} uptimeReq={uptimeReq} />}

          {terms}

          {/* the identifiers, whole */}
          {n.hasSnapshot && (
            <section className="flex flex-col gap-4">
              <SectionHeader label="Identity" />
              <Board divide={false} className="px-5 md:px-6">
                <SpecSheet>
                  <SpecLine label="Subnet">
                    {n.validator.subnetId === PRIMARY_SUBNET_ID ? (
                      <span className="inline-flex flex-wrap items-baseline gap-x-3">
                        Primary Network
                        <HashChip value={n.validator.subnetId} len={66} className="text-zinc-400 dark:text-zinc-500" />
                      </span>
                    ) : (
                      <HashChip value={n.validator.subnetId} len={66} />
                    )}
                  </SpecLine>
                  {n.validator.validationId && (
                    <SpecLine label="Validation ID">
                      <HashChip value={n.validator.validationId} len={66} />
                    </SpecLine>
                  )}
                  {n.validator.txId && (
                    <SpecLine label="Staking Tx">
                      <HashChip value={n.validator.txId} href={`${base}/tx/${n.validator.txId}`} len={66} />
                    </SpecLine>
                  )}
                  {/* where the money lands, live from the P-Chain, since the indexer doesn't mirror reward owners */}
                  {validationPayout?.addresses?.[0] && (
                    <SpecLine label={delegationPayout?.addresses?.[0] && delegationPayout.addresses[0] !== validationPayout.addresses[0] ? "Payout · Validation" : "Payout"}>
                      <HashChip value={validationPayout.addresses[0]} href={`${base}/address/${validationPayout.addresses[0]}`} len={66} />
                    </SpecLine>
                  )}
                  {delegationPayout?.addresses?.[0] && delegationPayout.addresses[0] !== validationPayout?.addresses?.[0] && (
                    <SpecLine label="Payout · Delegation">
                      <HashChip value={delegationPayout.addresses[0]} href={`${base}/address/${delegationPayout.addresses[0]}`} len={66} />
                    </SpecLine>
                  )}
                  {identity?.signer?.publicKey && (
                    <SpecLine label="BLS Public Key" align="start">
                      <HashChip value={identity.signer.publicKey} len={200} />
                    </SpecLine>
                  )}
                </SpecSheet>
              </Board>
            </section>
          )}

          {ledgers}
        </div>
      )}
    </ExplorerShell>
  );
}
