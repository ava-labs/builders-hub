"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, DetailSkeleton, HashChip, SectionHeader, SpecLine, SpecSheet, SubjectHeadline, HEAD, ROW, UNIT, INK, idInk, fnInk, feeInk, RowDoor } from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther, formatNano } from "./format";
import { FeedDown, useMethodNames } from "./bits";
import { useEvmData, usePrice, usdOfWei } from "./hooks";
import { NotFound, RailRow } from "./EvmTx";
import { PhaseTrack } from "./LiveBoards";
import { useBlockLifecycle } from "./useBlockLifecycle";
import { useRpcBlock } from "./useRpcBlock";
import { CONTINUOUS_EXECUTION_CHAINS } from "./useHeadStream";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { knownAddress, type BlockDetail } from "@/lib/evm-explorer";
import { useTokenList } from "@/lib/token-list";
import { TokenMark } from "./TokenMark";
import { BlockGasMap } from "./BlockGasMap";
import { GenesisJsonSection } from "@/components/explorer/EvmChainDetails";
import mainnetGenesis from "@/constants/cchain-genesis/mainnet.json";
import fujiGenesis from "@/constants/cchain-genesis/fuji.json";
import { readRpc } from "@/lib/explorer-rpc";

// the C-Chain's genesis, vendored from avalanchego, drawn on block 0
const GENESIS: Record<string, object> = { "43114": mainnetGenesis, "43113": fujiGenesis };


/* One block, split like the tx page. Left: the gas map (every tx as its
   share of the gas, inked by what it called, the calls that bought the
   most listed under it), then its identifiers. Right: the
   readings a block is judged by, stacked in a rail (final, state root,
   txs, fees, base fee, gas). Its transactions in a headed table below.
   Previous and next live in the section header, where a reader's hand
   already is. */

interface BlockProposer {
  proposerId: string;
  proposerParentId: string;
  proposerNodeId: string;
  proposerPChainHeight: number;
  proposerTimestamp: number;
}

/** the validator that built the block, from the Snowman++ wrapper. The
 *  Data API trails a fresh block by seconds, so a miss is asked again a
 *  few times before the page gives up on it. */
function useBlockProposer(chainId: string, block: number | null): BlockProposer | null {
  const [p, setP] = useState<BlockProposer | null>(null);
  useEffect(() => {
    setP(null);
    if (block === null || (chainId !== "43114" && chainId !== "43113")) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = (tries: number) => {
      fetch(`/api/block-proposer/${chainId}/${block}`)
        .then((res) => (res.ok ? res.json() : res.status === 404 ? null : Promise.reject(new Error(String(res.status)))))
        .then((data: BlockProposer | null) => {
          if (cancelled) return;
          if (data) setP(data);
          else if (tries > 0) timer = setTimeout(() => ask(tries - 1), 5000);
        })
        .catch(() => {});
    };
    ask(4);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [chainId, block]);
  return p;
}

export function EvmBlock({ network, id }: { network: string; id: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";
  const indexed = useEvmData<BlockDetail>(c.chainId, `block/${id}`, undefined, { retry404Ms: 20_000 });

  // C-Chain: the RPC is the primary source. The indexer trails the chain
  // (seconds to a minute) and the live boards link to blocks the moment
  // they are sealed, so the indexer alone would 404 on every fresh block.
  const liveRpc = CONTINUOUS_EXECUTION_CHAINS.has(String(c.chainId)) ? readRpc(c.chainId, c.rpcUrl) : undefined;
  const fromRpc = useRpcBlock(liveRpc, id);
  const b = fromRpc.data ?? indexed.data;
  const loading = !b && (indexed.loading || fromRpc.loading);
  const error = b || loading ? null : indexed.error ?? (liveRpc ? "not found" : null);
  const retry = indexed.retry;

  // Continuous Execution lifecycle, from the RPC, C-Chain only
  const life = useBlockLifecycle(liveRpc, b?.number ?? null);
  // hidden for blocks sealed before Helicon; they carry no settledHeight
  const showLife = !!liveRpc && life.supported;

  const proposer = useBlockProposer(String(c.chainId), b?.number ?? null);
  // the proposer is a Primary Network validator: its page lives on the P-Chain
  const pBase = `/explorer/${network}/p-chain`;

  const tokens = useTokenList(c.chainId);
  const method = useMethodNames(c.chainId, b?.transactions ?? []);
  // the gas map and the table share one pointer and one selection: hover
  // a segment and its row lights up, pick a group and the table narrows
  const [hover, setHover] = useState<string | null>(null);
  const [filter, setFilter] = useState<Set<string> | null>(null);
  const nameOf = (addr: string) => tokens.get(addr.toLowerCase())?.symbol;
  const shownTxs = b ? (filter ? b.transactions.filter((t) => filter.has(t.hash)) : b.transactions) : [];
  const burn = b ? knownAddress(b.miner) : undefined;
  const gasPct = b && b.gasLimit > 0 ? (b.gasUsed / b.gasLimit) * 100 : 0;
  const chargedGas = b ? b.transactions.reduce((sum, t) => sum + t.gasUsed, 0) : 0;
  const reverted = b ? b.transactions.filter((t) => !t.success).length : 0;
  // the C-Chain burns every fee; sovereign L1s choose their own destination
  const burnsFees = String(c.chainId) === "43114" || String(c.chainId) === "43113";

  // what the block cost, in the token and in dollars. Receipts give the
  // exact sum (RPC path); the indexer path only knows gas × base fee,
  // which on the C-Chain is the burn floor, so it is marked as such.
  const { price } = usePrice(c.chainId);
  const usd = price?.price ?? null;
  const exactFees = b && b.transactions.length > 0 && b.transactions.every((t) => t.feeWei);
  const feesWei = b
    ? exactFees
      ? b.transactions.reduce((acc, t) => acc + BigInt(t.feeWei!), 0n)
      : BigInt(b.gasUsed) * BigInt(b.baseFeePerGas || "0")
    : 0n;

  return (
    <EvmShell network={network}>
      {loading && <DetailSkeleton label="Block" />}
      {/* only a real 404 is "not found"; an indexer outage says so */}
      {error === "not found" && !b && <NotFound label="Block not found" id={id} />}
      {error && error !== "not found" && !b && <FeedDown onRetry={retry} />}
      {b && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <SectionHeader
              label="Block"
              action={
                <span className="flex shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {b.number > 0 && (
                    <Link href={`${base}/block/${b.number - 1}`} className="transition-colors hover:text-[#E6212F]">
                      ← #{formatNumber(b.number - 1)}
                    </Link>
                  )}
                  <Link href={`${base}/block/${b.number + 1}`} className="transition-colors hover:text-[#E6212F]">
                    #{formatNumber(b.number + 1)} →
                  </Link>
                </span>
              }
            />

            {/* the subject, and when it happened, on one baseline */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
              <SubjectHeadline value={String(b.number)} display={`#${formatNumber(b.number)}`} copyLabel="Copy block number" />
              <span className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatTime(b.timestamp)}
                <span className="text-zinc-400 dark:text-zinc-500"> · {timeAgo(b.timestamp)}</span>
              </span>
            </div>

            {/* the split: what the block did and its identity on the left;
                the readings a block is judged by in the rail on the right */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="flex min-w-0 flex-col gap-6">
                <BlockGasMap
                  txs={b.transactions}
                  gasUsed={b.gasUsed}
                  gasLimit={b.gasLimit}
                  method={method}
                  sym={sym}
                  base={base}
                  blockNumber={b.number}
                  nameOf={nameOf}
                  hover={hover}
                  onHover={setHover}
                  onFilter={setFilter}
                />

                {/* the identifiers */}
                <Board divide={false} className="px-5 md:px-6">
                  <SpecSheet>
                    <SpecLine label="Hash">
                      <HashChip value={b.hash} len={66} />
                    </SpecLine>
                    <SpecLine label="Parent">
                      <HashChip value={b.parentHash} href={`${base}/block/${b.number - 1}`} len={66} />
                    </SpecLine>
                    {b.miner && (
                      <SpecLine label="Fee Recipient">
                        <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
                          {burn && <span title={burn.note}>{burn.label}</span>}
                          <HashChip
                            value={b.miner}
                            href={`${base}/address/${b.miner}`}
                            len={66}
                            className={burn ? "text-zinc-400 dark:text-zinc-500" : undefined}
                          />
                        </span>
                      </SpecLine>
                    )}
                    {proposer && (
                      <>
                        <SpecLine label="Proposer">
                          <HashChip value={proposer.proposerNodeId} href={`${pBase}/node/${proposer.proposerNodeId}`} len={66} />
                        </SpecLine>
                        <SpecLine label="Proposer P-Chain Height">
                          <Link href={`${pBase}/block/${proposer.proposerPChainHeight}`} className={cn("font-mono hover:text-[#E6212F]", idInk)}>
                            #{formatNumber(proposer.proposerPChainHeight)}
                          </Link>
                          <span className="ml-3 font-mono text-[12px] font-normal text-zinc-400 dark:text-zinc-500">the validator set this block was proposed under</span>
                        </SpecLine>
                        <SpecLine label="Proposer Block ID">
                          <HashChip value={proposer.proposerId} len={66} />
                        </SpecLine>
                        <SpecLine label="Proposer Parent ID">
                          <HashChip value={proposer.proposerParentId} len={66} />
                        </SpecLine>
                      </>
                    )}
                    <SpecLine label="Gas Limit">{formatNumber(b.gasLimit)}</SpecLine>
                    <SpecLine label="Timestamp">
                      <span className="font-mono tabular-nums">{b.timestamp}</span>
                      <span className="ml-3 font-mono text-[12px] text-zinc-400 dark:text-zinc-500">unix seconds</span>
                    </SpecLine>
                  </SpecSheet>
                </Board>
              </div>

              {/* the readings: the rail stands as tall as the column beside
                  it, its rows sharing the height, so both end on one line */}
              <Board divide={false} className="flex flex-col border">
                {/* finality: a block is final the moment it is accepted */}
                <RailRow label="Status">Final</RailRow>
                {/* the state root is bookkeeping a later block does, not finality */}
                {showLife && (
                  <RailRow label="State Root" href={life.settledBy ? `${base}/block/${life.settledBy}` : undefined}>
                    {life.ready ? (
                      <span className="flex items-center gap-2.5">
                        <PhaseTrack phase={life.phase} label={false} />
                        {life.settledBy ? `#${formatNumber(life.settledBy)}` : <span className="text-zinc-400 dark:text-zinc-500">pending</span>}
                      </span>
                    ) : (
                      "…"
                    )}
                  </RailRow>
                )}
                <RailRow
                  label="Transactions"
                  href={b.txCount > 0 ? "#transactions" : undefined}
                  sub={reverted > 0 ? <span className="text-[#E6212F]">{reverted} reverted</span> : undefined}
                >
                  {formatNumber(b.txCount)}
                </RailRow>
                <RailRow
                  label={burnsFees ? "Fees Burned" : "Fees Paid"}
                  href={`${base}/gas`}
                  sub={
                    feesWei > 0n ? (
                      <>
                        {usdOfWei(feesWei, usd) ?? ""}
                        {!exactFees && b.transactions.length > 0 && (
                          <span title="gas used × base fee; priority fees not included">{usd ? " · " : ""}at base fee</span>
                        )}
                      </>
                    ) : undefined
                  }
                >
                  <span className={feeInk}>{formatEther(feesWei.toString(), { decimals: feesWei >= 10n ** 18n ? 3 : 5 })}</span> <span className={UNIT}>{sym}</span>
                </RailRow>
                <RailRow label="Base Fee" href={`${base}/gas/base-fee`}>
                  {b.baseFeePerGas && b.baseFeePerGas !== "0" ? formatNano(b.baseFeePerGas, sym) : "—"}
                </RailRow>
                {/* ACP-194: a header reserves every tx's gas limit; each receipt
                    charges max(used, limit / 2), which is what fees pay on */}
                <RailRow
                  label="Gas Reserved"
                  sub={
                    <span className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-24 bg-zinc-100 dark:bg-zinc-900">
                          <span
                            className={cn("block h-full", gasPct >= 90 ? "bg-zinc-800 dark:bg-zinc-300" : "bg-[#A2AFB2] dark:bg-zinc-600")}
                            style={{ width: `${Math.max(gasPct > 0 ? 1.5 : 0, Math.min(100, gasPct)).toFixed(1)}%` }}
                          />
                        </span>
                        {gasPct.toFixed(1)}% of {formatNumber(b.gasLimit)}
                      </span>
                      {b.transactions.length > 0 && <span>{formatNumber(chargedGas)} charged</span>}
                    </span>
                  }
                >
                  {formatNumber(b.gasUsed)}
                </RailRow>
              </Board>
            </div>
          </section>

          <section id="transactions" className="flex flex-col gap-4">
            <SectionHeader
              label={filter ? `Transactions · ${shownTxs.length} of ${b.transactions.length}` : `Transactions · ${b.transactions.length}`}
              action={filter ? <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#E6212F]">selected on the gas map</span> : undefined}
            />
            <Board>
              {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
              <div className="overflow-x-auto">
              <div className="divide-y divide-zinc-200 md:min-w-[58rem] lg:min-w-0 dark:divide-zinc-800">
              {b.transactions.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no transactions
                </div>
              )}
              {b.transactions.length > 0 && (
                <div className={cn(HEAD, "grid-cols-[0.75rem_minmax(0,1.4fr)_minmax(0,9rem)_minmax(0,1.6fr)_7rem_minmax(0,9rem)_6rem]")}>
                  <span />
                  <span>Hash</span>
                  <span>Method</span>
                  <span>From → To</span>
                  <span className="text-right">Gas Charged</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">USD</span>
                </div>
              )}
              {shownTxs.map((t) => {
                const m = method(t);
                const value = Number(t.value);
                return (
                  <RowDoor
                    key={t.hash}
                    id={`tx-${t.hash}`}
                    href={`${base}/tx/${t.hash}`}
                    onMouseEnter={() => setHover(t.hash)}
                    onMouseLeave={() => setHover(null)}
                    className={cn(ROW, "md:grid-cols-[0.75rem_minmax(0,1.4fr)_minmax(0,9rem)_minmax(0,1.6fr)_7rem_minmax(0,9rem)_6rem]", hover === t.hash && "bg-zinc-50 dark:bg-zinc-900")}
                  >
                    <span className="flex h-3 w-3 items-center justify-center">
                      {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
                    </span>
                    <span className={cn("min-w-0 truncate font-mono text-[12.5px]", idInk)}>{truncate(t.hash, 6)}</span>
                    <span className="min-w-0">
                      <CellLabel>Method</CellLabel>
                      <span
                        className={cn("block truncate font-mono text-[12px]", m.named ? fnInk : "text-zinc-400 dark:text-zinc-500")}
                        title={t.methodId || undefined}
                      >
                        {m.label}
                      </span>
                    </span>
                    <span className="col-span-2 flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-zinc-500 md:col-span-1 dark:text-zinc-400">
                      <CellLabel>From → To</CellLabel>
                      <span className="truncate">{truncate(t.from, 8)}</span>
                      <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                      {t.to && tokens.get(t.to.toLowerCase()) ? (
                        <TokenMark address={t.to} chainId={c.chainId} token={tokens.get(t.to.toLowerCase())!} size={14} />
                      ) : (
                        <span className="truncate">{t.to ? truncate(t.to, 8) : "contract creation"}</span>
                      )}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                      <CellLabel>Gas Charged</CellLabel>
                      {formatNumber(t.gasUsed)}
                    </span>
                    <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", value > 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600")}>
                      <CellLabel>Value</CellLabel>
                      {value > 0 ? (
                        <>
                          {formatEther(t.value, { decimals: 4 })} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{sym}</span>
                        </>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
                      {(value > 0 && usdOfWei(t.value, usd)) || ""}
                    </span>
                  </RowDoor>
                );
              })}
                          </div>
              </div>
            </Board>
          </section>
          {/* block 0 is the chain's founding document: show it verbatim */}
          {b.number === 0 && GENESIS[String(c.chainId)] && (
            <GenesisJsonSection
              raw={JSON.stringify(GENESIS[String(c.chainId)], null, 2)}
              sourceUrl={`https://github.com/ava-labs/avalanchego/blob/master/genesis/genesis_${String(c.chainId) === "43113" ? "fuji" : "mainnet"}.json`}
            />
          )}
        </div>
      )}
    </EvmShell>
  );
}
