"use client";

import { useState } from "react";
import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, DetailSkeleton, HashChip, LiveDot, SectionHeader, SpecLine, SpecSheet, SubjectHeadline, Tabs, TxTypePill, UNIT, feeInk, idInk } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, formatUsd, timeAgo, truncate } from "@/components/explorer-v2/format";
import { NotFound, RailRow } from "@/components/explorer-v2/detail-parts";
import { uptimeRequirementAt, type HeliconNetwork } from "@/constants/helicon";
import { txTypeLabel, type Tx } from "@/lib/pchain-explorer";
import { useAvaxUsd, usePchainData } from "./hooks";
import { GenesisViewer } from "./GenesisViewer";
import { FundFlowDiagram, NoFundMovement, hasFundMovement } from "./FundFlowDiagram";
import { UtxoColumn } from "./utxo-ledger";
import { avaxExact, ledgerOf, sumBig, type Ledger } from "./utxo";
import { humanPeriod, useTxContext, type TxContext } from "./tx-hooks";
import { PchainTxStory, day } from "./tx-story";
import { ConversionSheet, ContinuousSheet, CreationSheet, CrossChainSheet, InitialValidatorSet, L1ValidationSheet, StakingSheet, WarpSheet, useWarpMessage } from "./tx-sections";

/* One P-Chain transaction, in the C-Chain tx page's grammar: the type in
   the header, the hash as the subject with its time beside it, then the
   split. Left, what happened: the sentence and the UTXO ledger, consumed
   to produced, then the identifiers. Right, the readings a tx is judged
   by: final, what it staked or moved, the fee it burned, its UTXOs. The
   tx type's own sheets follow, then every UTXO as a flow or a table. */

/** nAVAX the tx moved into L1 validators' balances; null while the node's copy is read */
function l1BalanceOf(tx: Tx, ctx: TxContext): number | null {
  if (tx.details?.l1Balance !== undefined) return tx.details.l1Balance;
  if (!ctx.isConvert) return 0;
  if (ctx.platformOp.loading) return null;
  return (ctx.platformOp.data?.validators ?? []).reduce((t, v) => t + Number(v.balance || 0), 0);
}

/** the rail's headline: what the tx staked, minted, moved or paid in */
function headline(tx: Tx, ledger: Ledger, balance: number | null, ctx: TxContext, uptimeReq: number | null) {
  const outs = (p: string) => ledger.produced.filter((r) => r.purpose === p).reduce((t, r) => t + r.amount, 0n);
  const staked = sumBig(tx.amountStaked);
  if (staked > 0n)
    return {
      label: "Staked",
      value: staked,
      sub: tx.endTimestamp ? `${tx.endTimestamp > Date.now() / 1000 ? "locked to" : "unlocked"} ${day(tx.endTimestamp)}` : tx.period ? `renews every ${tx.periodHuman ?? humanPeriod(tx.period)}` : undefined,
    };
  if (tx.txType === "RewardValidatorTx" && tx.details?.rewardPaid === false)
    return { label: "Reward", value: null, sub: uptimeReq !== null ? `uptime under ${uptimeReq}%` : "uptime too low" };
  // a cycle's reward is its restaked share and its payout, as the sheet adds them
  if (tx.txType === "RewardAutoRenewedValidatorTx" && ctx.rewardRestaked !== null && ctx.rewardUtxos) {
    const restaked = BigInt(Math.round(ctx.rewardRestaked));
    const paid = BigInt(ctx.rewardWithdrawn);
    return { label: "Reward", value: restaked + paid, sub: paid > 0n ? `${formatAvax(ctx.rewardRestaked)} restaked · ${formatAvax(ctx.rewardWithdrawn)} paid out` : "all restaked into the stake" };
  }
  if (ctx.isReward) return { label: "Reward", value: ledger.totalOut || BigInt(ctx.rewardWithdrawn), sub: "minted by the P-Chain" };
  if (tx.txType === "ImportTx") return { label: "Imported", value: ledger.totalOut, sub: "into this chain's UTXOs" };
  if (tx.txType === "ExportTx") return { label: "Exported", value: outs("export"), sub: "to another chain's shared memory" };
  if (balance) return { label: "L1 Balance", value: BigInt(Math.round(balance)), sub: "prepaid toward the continuous fee" };
  if (outs("sent") > 0n) return { label: "Sent", value: outs("sent"), sub: "to other owners" };
  return null;
}

export function PchainTx({ chain, network, txHash }: { chain: string; network: string; txHash: string }) {
  const base = `/explorer/${network}/${chain}`;
  // a fresh tx is on-chain seconds before the indexer has it: a 404 is
  // asked again for two minutes before the page calls it missing
  const { data: tx, loading, error } = usePchainData<Tx>(network, `tx/${txHash}`, undefined, { retry404Ms: 120_000 });
  const notFound = error === "not found";
  const ctx = useTxContext(network, txHash, tx, notFound);
  const decoded = useWarpMessage(ctx.isWarpOp ? ctx.platformOp.data : null);
  // mainnet only: Fuji AVAX has no market value
  const avaxUsd = useAvaxUsd(network === "mainnet");
  const [flowView, setFlowView] = useState<"diagram" | "table">("diagram");

  // ACP-267 raised the reward threshold from 80% to 90%, judged by the
  // validation's own start: a stake begun before Helicon is still judged
  // at 80%. A staking tx's block stands in for an unknown start; a reward
  // tx's block is the stake's end, so its start is the staking tx's, and
  // the percent is left out until that read lands.
  const start = ctx.isReward ? ctx.stakeStart : tx?.startTimestamp || tx?.blockTimestamp;
  const uptimeReq = start ? uptimeRequirementAt(start * 1000, network === "fuji" ? "fuji" : ("mainnet" as HeliconNetwork)) : null;

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Transaction" />}
      {error && !notFound && <NotFound label="Transaction not found" id={txHash} />}
      {notFound &&
        (ctx.platformOp.data ? (
          <IndexingWait txHash={txHash} />
        ) : ctx.platformOp.loading ? (
          <DetailSkeleton label="Transaction" />
        ) : (
          <NotFound label="Transaction not found" id={txHash} />
        ))}
      {tx && <TxBody tx={tx} ctx={ctx} decoded={decoded} base={base} avaxUsd={avaxUsd} uptimeReq={uptimeReq} flowView={flowView} setFlowView={setFlowView} />}
    </ExplorerShell>
  );
}

function TxBody({
  tx,
  ctx,
  decoded,
  base,
  avaxUsd,
  uptimeReq,
  flowView,
  setFlowView,
}: {
  tx: Tx;
  ctx: TxContext;
  decoded: ReturnType<typeof useWarpMessage>;
  base: string;
  avaxUsd: number | null;
  uptimeReq: number | null;
  flowView: "diagram" | "table";
  setFlowView: (v: "diagram" | "table") => void;
}) {
  const d = tx.details;
  const ledger = ledgerOf({ consumed: tx.consumedUtxos, emitted: ctx.flowEmitted, txType: tx.txType, outputCount: ctx.platformOp.data?.outputs?.length });
  const balance = l1BalanceOf(tx, ctx);
  const kept = BigInt(Math.round(balance ?? 0));
  const fee = ledger.burned > kept ? ledger.burned - kept : 0n;
  const head = headline(tx, ledger, balance, ctx, uptimeReq);
  // the sheets this tx type carries; a reward or auto-renew config tx points
  // at its staking tx without a node or weight of its own, and still earns one
  const staking = !!(tx.nodeId || d?.weight || tx.rewardAddresses?.length || d?.stakingTxId || d?.rewardPaid !== undefined);
  // a Primary Network validator's BLS key belongs to its stake, not to an L1 seat
  const seat = !!(d?.validationId || d?.l1Balance !== undefined);
  const sheets = [
    staking && <StakingSheet key="staking" tx={tx} ctx={ctx} base={base} uptimeReq={uptimeReq} bls={seat ? undefined : d?.blsPublicKey} />,
    (tx.period !== undefined || tx.autoCompoundRewardShares !== undefined || tx.autoCompoundPercent !== undefined || tx.validatorAuthority?.length) && (
      <ContinuousSheet key="continuous" tx={tx} ctx={ctx} base={base} />
    ),
    (seat || (d?.blsPublicKey && !staking)) && !ctx.isWarpOp && <L1ValidationSheet key="l1" tx={tx} ctx={ctx} base={base} />,
    (d?.chainName || d?.vmId || d?.subnetOwners?.length) && <CreationSheet key="creation" tx={tx} base={base} />,
    (d?.sourceChain || d?.destinationChain || tx.importedFrom) && <CrossChainSheet key="cross" tx={tx} />,
    ctx.isConvert && (ctx.platformOp.loading || ctx.platformOp.data) && (
      <ConversionSheet key="convert" u={ctx.platformOp.data} loading={ctx.platformOp.loading} subnetId={tx.subnetId} base={base} />
    ),
    ctx.isWarpOp && (ctx.platformOp.loading || ctx.platformOp.data) && (
      <WarpSheet key="warp" u={ctx.platformOp.data} decoded={decoded} loading={ctx.platformOp.loading} base={base} />
    ),
  ].filter(Boolean);
  const moved = hasFundMovement({
    consumed: tx.consumedUtxos,
    emitted: ctx.flowEmitted,
    burned: tx.amountBurned,
    importedFrom: tx.importedFrom,
    sourceChain: d?.sourceChain,
    destinationChain: d?.destinationChain,
  });

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <SectionHeader label="Transaction" action={<TxTypePill type={tx.txType} label={txTypeLabel(tx.txType)} />} />
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <SubjectHeadline value={tx.txHash} copyLabel="Copy transaction hash" />
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {formatTime(tx.blockTimestamp)}
            <span className="text-zinc-400 dark:text-zinc-500"> · {timeAgo(tx.blockTimestamp)}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <PchainTxStory tx={tx} ctx={ctx} ledger={ledger} decoded={decoded} base={base} avaxUsd={avaxUsd} uptimeReq={uptimeReq} balance={balance} />
            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                <SpecLine label="Type">{tx.txType}</SpecLine>
                {/* a CreateSubnetTx's ID is the subnet's, a CreateChainTx's the chain's */}
                {tx.txType === "CreateSubnetTx" && (
                  <SpecLine label="Subnet ID · created">
                    <HashChip value={tx.txHash} len={66} />
                  </SpecLine>
                )}
                {tx.txType === "CreateChainTx" && (
                  <SpecLine label="Blockchain ID · created">
                    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <HashChip value={tx.txHash} len={66} />
                      <Link href={`${base}/chain/${tx.txHash}`} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
                        Chain page →
                      </Link>
                    </span>
                  </SpecLine>
                )}
                <SpecLine label="Block">
                  <span className="inline-flex flex-wrap items-baseline gap-x-3">
                    <Link href={`${base}/block/${tx.blockNumber}`} className={`font-mono hover:text-[#E6212F] ${idInk}`}>
                      #{formatNumber(Number(tx.blockNumber))}
                    </Link>
                    {tx.blockHash && <span className="font-mono text-[12px] font-normal text-zinc-400 dark:text-zinc-500">{truncate(tx.blockHash, 12)}</span>}
                  </span>
                </SpecLine>
                {tx.memo && tx.memo !== "0x" && (
                  <SpecLine label="Memo">
                    <HashChip value={tx.memo} len={66} />
                  </SpecLine>
                )}
              </SpecSheet>
            </Board>
          </div>

          {/* the rail stands as tall as the column beside it, so both end on one line */}
          <Board divide={false} className="flex flex-col border">
            {/* a tx is final the moment its block is accepted */}
            <RailRow label="Status">Final</RailRow>
            {head && (
              <RailRow label={head.label} sub={head.value !== null && formatUsd(Number(head.value), avaxUsd) ? `${formatUsd(Number(head.value), avaxUsd)}${head.sub ? ` · ${head.sub}` : ""}` : head.sub}>
                {head.value === null ? (
                  <span className="text-zinc-400 dark:text-zinc-500">None</span>
                ) : (
                  <>
                    {formatAvax(Number(head.value), { symbol: false })} <span className={UNIT}>AVAX</span>
                  </>
                )}
              </RailRow>
            )}
            <RailRow label="Fee" sub={balance === null ? "with the L1 balances, until the node answers" : fee > 0n ? "burned: inputs less outputs" : ctx.isReward ? "a reward pays no fee" : undefined}>
              <span className={feeInk}>{avaxExact(balance === null ? ledger.burned : fee, false)}</span> <span className={UNIT}>AVAX</span>
            </RailRow>
            <RailRow label="UTXOs" sub="consumed → produced" href="#fund-flow">
              {tx.consumedUtxos.length} → {ctx.flowEmitted.length}
            </RailRow>
          </Board>
        </div>
      </section>

      {/* two up when there are two to set side by side */}
      {sheets.length > 0 && <div className={sheets.length > 1 ? "grid items-start gap-x-8 gap-y-10 lg:grid-cols-2" : "flex flex-col gap-10"}>{sheets}</div>}

      {/* the conversion's first validator set, and a new chain's genesis, run full width */}
      {ctx.isConvert && (ctx.platformOp.data?.validators?.length ?? 0) > 0 && (
        <InitialValidatorSet validators={ctx.platformOp.data!.validators!} subnetId={tx.subnetId} base={base} />
      )}
      {ctx.isCreateChain && (ctx.platformOp.loading || ctx.platformOp.data?.genesisData != null) && (
        <GenesisViewer genesisData={ctx.platformOp.data?.genesisData} loading={ctx.platformOp.loading} />
      )}

      <section id="fund-flow" className="flex scroll-mt-24 flex-col gap-4">
        <SectionHeader
          label="Fund Flow"
          action={moved ? <Tabs tabs={["diagram", "table"] as ("diagram" | "table")[]} active={flowView} onChange={setFlowView} labels={{ diagram: "Diagram", table: "Table" }} /> : undefined}
        />
        {!moved ? (
          <Board divide={false} className="px-5 py-5 md:px-6">
            <NoFundMovement txType={tx.txType} />
          </Board>
        ) : flowView === "diagram" ? (
          <Board divide={false} className="px-5 py-6 md:px-6">
            <FundFlowDiagram
              consumed={tx.consumedUtxos}
              emitted={ctx.flowEmitted}
              burned={tx.amountBurned.length ? tx.amountBurned : fee > 0n ? [{ assetId: "", name: "Avalanche", symbol: "AVAX", denomination: 9, amount: String(fee) }] : []}
              txType={tx.txType}
              base={base}
              importedFrom={tx.importedFrom}
              sourceChain={d?.sourceChain}
              destinationChain={d?.destinationChain}
              balance={balance ?? 0}
            />
          </Board>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <UtxoColumn base={base} title={`Consumed · ${tx.consumedUtxos.length}`} utxos={tx.consumedUtxos} side="in" />
            <UtxoColumn base={base} title={`Produced · ${ctx.flowEmitted.length}`} utxos={ctx.flowEmitted} side="out" />
          </div>
        )}
        {ctx.fromNode && (
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Reward UTXOs are minted into P-Chain state under this transaction&apos;s ID, not made as its outputs, so these are read from the node.
          </p>
        )}
      </section>
    </div>
  );
}

/* The node has the tx and the index does not yet: the page asks again
   and swaps in the full view the moment it lands. */
function IndexingWait({ txHash }: { txHash: string }) {
  return (
    <Board divide={false} className="px-6 py-14 text-center">
      <div className="flex flex-col items-center gap-4">
        <LiveDot size="h-2 w-2" />
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">Accepted on-chain · indexing</p>
        <p className="max-w-md text-[13px] text-zinc-500 dark:text-zinc-400">
          The P-Chain has this transaction; the explorer&apos;s index is a few blocks behind it. The page fills in when the index has it.
        </p>
        <HashChip value={txHash} len={66} />
      </div>
    </Board>
  );
}
