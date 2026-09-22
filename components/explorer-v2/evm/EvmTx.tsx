"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import {
  Board,
  CellLabel,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SpecLine,
  SpecSheet,
  StatCell,
  StatStrip,
  SubjectHeadline,
} from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther, formatNano } from "./format";
import { FeedDown } from "./bits";
import { CopyButton } from "@/components/explorer/DetailRow";
import { useEvmData, usePrice, usdOfWei } from "./hooks";
import { PhaseTrack } from "./LiveBoards";
import { useBlockLifecycle } from "./useBlockLifecycle";
import { useRpcTx } from "./useRpcTx";
import { EvmTrace, useTrace } from "./EvmTrace";
import { CONTINUOUS_EXECUTION_CHAINS } from "./useHeadStream";
import { useVerifiedContracts, functionNameFromAbi } from "@/lib/sourcify-client";
import { getFunctionBySelector } from "@/abi/event-signatures.generated";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import { knownAddress, type TxDetail } from "@/lib/evm-explorer";
import { useTokenList, decodeErc20Call, decodeTransferLogs, formatTokenAmount } from "@/lib/token-list";
import { TokenLogo, TokenMark } from "./TokenMark";
import { ICM_EVENT_BY_TOPIC, ICM_STATUS_LABEL, TELEPORTER_ADDRESS, type IcmMessage } from "@/lib/icm-message";

/* One transaction, in the block page's grammar: status in the section
   header, the hash as the subject with its time beside it, the readings
   a tx is judged by in a strip (what moved, what it cost, how much gas,
   which block, where that block stands in Continuous Execution), the
   identifiers in a compact sheet, then the tx's own sections. */

const FIG = "font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50";
const UNIT = "text-sm font-normal text-zinc-400 dark:text-zinc-500";

const TX_TYPES: Record<number, string> = {
  0: "Legacy",
  1: "Access list (EIP-2930)",
  2: "Dynamic fee (EIP-1559)",
  3: "Blob (EIP-4844)",
  4: "Set code (EIP-7702)",
};

function icmMessagesInLogs(logs: TxDetail["logs"]): { messageId: string; events: string[] }[] {
  const byId = new Map<string, string[]>();
  for (const log of logs) {
    if (log.address.toLowerCase() !== TELEPORTER_ADDRESS) continue;
    const name = ICM_EVENT_BY_TOPIC[(log.topics[0] ?? "").toLowerCase()];
    const id = (log.topics[1] ?? "").toLowerCase();
    if (!name || !/^0x[0-9a-f]{64}$/.test(id)) continue;
    if (!byId.has(id)) byId.set(id, []);
    const events = byId.get(id)!;
    if (!events.includes(name)) events.push(name);
  }
  return [...byId.entries()].map(([messageId, events]) => ({ messageId, events }));
}

/**
 * A 64-hex hash that is not a transaction here may be an ICM message ID; the
 * two are indistinguishable by shape, so search and any pasted link land on
 * /tx first. Probed only once the tx lookup has genuinely 404'd (after its own
 * retry window), so the ordinary path pays nothing for this.
 */
function useIcmFallback(txHash: string, enabled: boolean): IcmMessage | null {
  const [message, setMessage] = useState<IcmMessage | null>(null);
  useEffect(() => {
    setMessage(null);
    if (!enabled) return;
    let live = true;
    const controller = new AbortController();
    fetch(`/api/icm/message/${txHash}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (live && body && !body.error) setMessage(body as IcmMessage);
      })
      .catch(() => {
        /* a failed probe just leaves the plain not-found panel standing */
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [txHash, enabled]);
  return message;
}

/* Not an error: the hash resolved, just to a different kind of thing. */
function IcmInstead({ network, message }: { network: string; message: IcmMessage }) {
  return (
    <Board divide={false} className="px-5 py-10 md:px-6 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
        Interchain message
      </p>
      <p className="mt-3 break-all font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
        {message.messageId}
      </p>
      <p className="mt-5 max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        No transaction on this chain carries that hash, but it is the ID of an interchain message
        we index, currently {ICM_STATUS_LABEL[message.status].toLowerCase()}.
      </p>
      <Link
        href={`/explorer/${network}/icm/${message.messageId}`}
        className="group mt-5 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        View the message
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Board>
  );
}

/* Shared 404 panel for the EVM detail pages (tx / block / address). */
export function NotFound({ label, id }: { label: string; id?: string }) {
  return (
    <Board divide={false} className="px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</p>
      {id && <p className="mt-3 break-all font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{id}</p>}
    </Board>
  );
}

/* Kept for the list pages that still box their status; the detail pages
   state it in the header instead. */
export function StatusPill({ success }: { success: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        success
          ? "border-[#4e9a52]/40 bg-[#4e9a52]/10 text-[#3f7d43] dark:border-[#4e9a52]/45 dark:text-[#77c47b]"
          : "border-[#E6212F]/40 bg-[#E6212F]/10 text-[#c11824] dark:border-[#E6212F]/50 dark:text-[#ff6b73]",
      )}
    >
      <span className="size-1 shrink-0 bg-current opacity-80" aria-hidden />
      {success ? "Success" : "Failed"}
    </span>
  );
}

/** the header's status word: quiet when it worked, red with an X when not */
function StatusWord({ success }: { success: boolean }) {
  return success ? (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
      Success
    </span>
  ) : (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#E6212F]">
      <X className="h-3 w-3" strokeWidth={2.5} />
      Reverted
    </span>
  );
}

/** an address with its name in front of it: the token list's mark
 *  (logo + symbol · name) first, then Sourcify's contract name, then a
 *  protocol fixture's label */
function Party({
  addr,
  name,
  href,
  chainId,
  token,
}: {
  addr: string;
  name?: string | null;
  href: string;
  chainId: string;
  token?: { symbol: string; name: string; decimals: number; logoURI: string | null } | null;
}) {
  const label = token ? null : name ?? knownAddress(addr)?.label;
  const quiet = !!(token || label);
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
      {token && (
        <span className="inline-flex items-center gap-2">
          <TokenMark address={addr} chainId={chainId} token={token} size={18} />
          <span className="text-zinc-500 dark:text-zinc-400">{token.name}</span>
        </span>
      )}
      {label && <span>{label}</span>}
      <HashChip value={addr} href={href} len={66} className={quiet ? "text-zinc-400 dark:text-zinc-500" : undefined} />
    </span>
  );
}

export function EvmTx({ network, txHash }: { network: string; txHash: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken ?? "AVAX";
  const indexed = useEvmData<TxDetail>(c.chainId, `tx/${txHash}`, undefined, { retry404Ms: 20_000 });

  // C-Chain: the RPC answers the second the tx executes; the indexer copy
  // replaces it when it lands, bringing the internal calls with it.
  const liveRpc = CONTINUOUS_EXECUTION_CHAINS.has(String(c.chainId)) ? c.rpcUrl : undefined;
  const fromRpc = useRpcTx(liveRpc, txHash);
  const t = indexed.data ?? fromRpc.data;
  const loading = !t && (indexed.loading || fromRpc.loading);
  const error = t || loading ? null : indexed.error ?? (liveRpc ? "not found" : null);
  const retry = indexed.retry;

  const icmFallback = useIcmFallback(txHash, error === "not found" && !t);
  const icmMessages = t ? icmMessagesInLogs(t.logs) : [];

  // the execution trace, from the debug node; when it is here it carries
  // the internal calls, token movements and events, so the flat sections
  // for those step aside
  const { trace, state: traceState } = useTrace(c.chainId, txHash, !!liveRpc);
  const traced = traceState === "ready";

  // where the tx's block stands in Continuous Execution
  const life = useBlockLifecycle(liveRpc, t?.blockNumber ?? null);
  const showLife = !!liveRpc && life.supported;

  const { price } = usePrice(c.chainId);
  const usd = price?.price ?? null;

  // names: the called contract's verified record names both the party and
  // the selector; the generated registry names the classics after that
  const contracts = useVerifiedContracts(c.chainId, [t?.to]);
  const toContract = t?.to ? contracts.get(t.to.toLowerCase()) : undefined;
  const selector = t?.input && t.input.length >= 10 ? t.input.slice(0, 10).toLowerCase() : "";
  const methodName = selector
    ? functionNameFromAbi(toContract?.abi, selector) ?? getFunctionBySelector(selector)?.name ?? null
    : null;

  // token metadata: names the called contract, scales a decoded transfer
  const tokens = useTokenList(c.chainId);
  const toToken = t?.to ? tokens.get(t.to.toLowerCase()) ?? null : null;
  const call = t && toToken ? decodeErc20Call(t.input) : null;
  const transfers = t ? decodeTransferLogs(t.logs) : [];

  const feeWei = t ? BigInt(t.gasUsed) * BigInt(t.gasPrice || "0") : 0n;
  const gasPct = t && t.gasLimit > 0 ? (t.gasUsed / t.gasLimit) * 100 : 0;
  const value = t ? Number(t.value) : 0;

  return (
    <EvmShell network={network}>
      {loading && <DetailSkeleton label="Transaction" />}
      {/* only a real 404 is "not found"; an indexer outage says so */}
      {error === "not found" && !t &&
        (icmFallback ? (
          <IcmInstead network={network} message={icmFallback} />
        ) : (
          <NotFound label="Transaction not found" id={txHash} />
        ))}
      {error && error !== "not found" && !t && <FeedDown onRetry={retry} />}
      {t && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-5">
            <SectionHeader label="Transaction" action={<StatusWord success={t.success} />} />

            {/* the subject, and when it happened */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
              <SubjectHeadline value={t.hash} copyLabel="Copy transaction hash" />
              <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatTime(t.timestamp)}
                <span className="text-zinc-400 dark:text-zinc-500"> · {timeAgo(t.timestamp)}</span>
              </span>
            </div>

            {/* the readings */}
            <StatStrip cols={5}>
              <StatCell label="Value" sub={value > 0 ? usdOfWei(t.value, usd) : undefined}>
                <span className={cn(FIG, value === 0 && "text-zinc-400 dark:text-zinc-600")}>
                  {value > 0 ? formatEther(t.value, { decimals: value / 1e18 >= 1 ? 4 : 6 }) : "0"}{" "}
                  <span className={UNIT}>{sym}</span>
                </span>
              </StatCell>
              <StatCell
                label="Fee"
                href={`${base}/gas`}
                sub={
                  <>
                    {usdOfWei(feeWei, usd)}
                    {usdOfWei(feeWei, usd) ? " · " : ""}
                    {formatNano(t.gasPrice, sym)}
                  </>
                }
              >
                <span className={FIG}>
                  {formatEther(feeWei.toString(), { decimals: 6 })} <span className={UNIT}>{sym}</span>
                </span>
              </StatCell>
              <StatCell
                label="Gas Used"
                sub={
                  <span className="flex items-center gap-2">
                    <span className="h-1 w-24 bg-zinc-100 dark:bg-zinc-900">
                      <span
                        className={cn("block h-full", gasPct >= 95 ? "bg-[#E6212F]" : "bg-[#A2AFB2] dark:bg-zinc-600")}
                        style={{ width: `${Math.max(gasPct > 0 ? 1.5 : 0, Math.min(100, gasPct)).toFixed(1)}%` }}
                      />
                    </span>
                    {gasPct.toFixed(0)}% of {formatNumber(t.gasLimit)}
                  </span>
                }
              >
                <span className={FIG}>{formatNumber(t.gasUsed)}</span>
              </StatCell>
              <StatCell label="Block" href={`${base}/block/${t.blockNumber}`} sub={`position ${t.txIndex}`}>
                <span className={FIG}>#{formatNumber(t.blockNumber)}</span>
              </StatCell>
              {showLife ? (
                <StatCell
                  label="Finality"
                  live={life.phase !== "settled"}
                  href={life.settledBy ? `${base}/block/${life.settledBy}` : undefined}
                  sub={
                    life.ready ? (
                      <span className="flex items-center gap-2">
                        <PhaseTrack phase={life.phase} label={false} />
                        {life.settledBy ? `state root committed in #${formatNumber(life.settledBy)}` : "executing"}
                      </span>
                    ) : undefined
                  }
                >
                  <span className={FIG}>Final</span>
                </StatCell>
              ) : (
                <StatCell label="Type">
                  <span className="flex h-7 items-center font-mono text-[13px] text-zinc-900 sm:h-8 dark:text-zinc-50">
                    {TX_TYPES[t.type] ?? `Type ${t.type}`}
                  </span>
                </StatCell>
              )}
            </StatStrip>

            {/* the identifiers */}
            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                <SpecLine label="From">
                  <Party addr={t.from} href={`${base}/address/${t.from}`} chainId={c.chainId} token={tokens.get(t.from.toLowerCase())} />
                </SpecLine>
                {t.to ? (
                  <SpecLine label="To">
                    <Party addr={t.to} name={toContract?.name} href={`${base}/address/${t.to}`} chainId={c.chainId} token={toToken} />
                  </SpecLine>
                ) : t.contractAddress ? (
                  <SpecLine label="Contract Created">
                    <HashChip value={t.contractAddress} href={`${base}/address/${t.contractAddress}`} len={66} />
                  </SpecLine>
                ) : (
                  <SpecLine label="To">Contract creation</SpecLine>
                )}
                {selector && (
                  <SpecLine label="Method">
                    <span className="inline-flex flex-wrap items-baseline gap-x-3">
                      {methodName ? (
                        <>
                          <span className="font-mono">{methodName}</span>
                          {call && toToken && (
                            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                              {formatTokenAmount(call.amount, toToken.decimals)}
                              <TokenMark address={t.to} chainId={c.chainId} token={toToken} size={14} />
                              <span className="text-zinc-400 dark:text-zinc-500">
                                {call.from ? `from ${truncate(call.from, 8)} ` : ""}to {truncate(call.to, 8)}
                              </span>
                            </span>
                          )}
                          <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">{selector}</span>
                        </>
                      ) : (
                        <span className="font-mono text-zinc-500 dark:text-zinc-400">{selector}</span>
                      )}
                    </span>
                  </SpecLine>
                )}
                <SpecLine label="Nonce">{formatNumber(t.nonce)}</SpecLine>
                {showLife && <SpecLine label="Type">{TX_TYPES[t.type] ?? `Type ${t.type}`}</SpecLine>}
                {t.input && t.input !== "0x" && (
                  <SpecLine label="Input" align="start">
                    <span className="inline-flex max-w-full items-center gap-2">
                      <span className="block max-w-full break-all font-mono text-[12px] text-zinc-600 dark:text-zinc-400">
                        {truncate(t.input, 96)}
                      </span>
                      <CopyButton text={t.input} />
                    </span>
                  </SpecLine>
                )}
              </SpecSheet>
            </Board>
          </section>

          {liveRpc && <EvmTrace trace={trace} state={traceState} chainId={c.chainId} base={base} sender={t.from} symbol={sym} />}

          {!traced && transfers.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Token Transfers · ${transfers.length}`} />
              <Board>
                <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                  <span>Token</span>
                  <span>From</span>
                  <span>To</span>
                  <span className="text-right">Amount</span>
                </div>
                {transfers.map((x) => {
                  const tok = tokens.get(x.token);
                  return (
                    <div
                      key={x.logIndex}
                      className="grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-2.5 md:h-11 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:py-0 md:px-6"
                    >
                      <span className="flex min-w-0 items-center gap-2 font-mono text-[12.5px]">
                        <TokenLogo address={x.token} chainId={c.chainId} token={tok} size={18} />
                        {tok ? (
                          <Link href={`${base}/address/${x.token}`} className="truncate hover:text-[#E6212F]">
                            <span className="font-medium text-zinc-900 dark:text-zinc-50">{tok.symbol}</span>
                            <span className="ml-2 text-zinc-400 dark:text-zinc-500">{tok.name}</span>
                          </Link>
                        ) : (
                          <HashChip value={x.token} href={`${base}/address/${x.token}`} len={12} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <CellLabel>From</CellLabel>
                        <HashChip value={x.from} href={`${base}/address/${x.from}`} len={12} />
                      </span>
                      <span className="min-w-0">
                        <CellLabel>To</CellLabel>
                        <HashChip value={x.to} href={`${base}/address/${x.to}`} len={12} />
                      </span>
                      <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                        <CellLabel>Amount</CellLabel>
                        {tok ? (
                          <>
                            {formatTokenAmount(x.amount, tok.decimals)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{tok.symbol}</span>
                          </>
                        ) : (
                          <span className="text-zinc-500 dark:text-zinc-400">{x.amount.toString()}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </Board>
            </section>
          )}

          {!traced && t.internalTxns.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Internal Transactions · ${t.internalTxns.length}`} />
              <Board>
                <div className="hidden grid-cols-[1fr_1fr_0.8fr_0.6fr] gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                  <span>From</span>
                  <span>To</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Type</span>
                </div>
                {t.internalTxns.map((it, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[1fr_1fr_0.8fr_0.6fr] md:items-center md:px-6"
                  >
                    <span className="min-w-0">
                      <CellLabel>From</CellLabel>
                      <HashChip value={it.from} href={`${base}/address/${it.from}`} len={16} />
                    </span>
                    <span className="min-w-0">
                      <CellLabel>To</CellLabel>
                      {it.to ? <HashChip value={it.to} href={`${base}/address/${it.to}`} len={16} /> : "—"}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                      <CellLabel>Value</CellLabel>
                      {formatEther(it.value, { symbol: sym })}
                      {usdOfWei(it.value, usd) && (
                        <span className="ml-2 text-[11px] text-zinc-400 dark:text-zinc-500">{usdOfWei(it.value, usd)}</span>
                      )}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-400 md:text-right dark:text-zinc-500">
                      <CellLabel>Type</CellLabel>
                      {it.callType || "call"}
                    </span>
                  </div>
                ))}
              </Board>
            </section>
          )}

          {icmMessages.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Interchain Messages · ${icmMessages.length}`} />
              <Board>
                {icmMessages.map((m) => (
                  <div
                    key={m.messageId}
                    className="flex flex-col gap-1.5 px-5 py-3.5 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6"
                  >
                    <span className="min-w-0">
                      <CellLabel>Message</CellLabel>
                      <HashChip value={m.messageId} href={`/explorer/${network}/icm/${m.messageId}`} len={24} />
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      {m.events.join(" · ")}
                    </span>
                  </div>
                ))}
              </Board>
            </section>
          )}

          {!traced && (
          <section className="flex flex-col gap-4">
            <SectionHeader label={`Event Logs · ${t.logs.length}`} />
            <Board>
              {t.logs.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no logs emitted
                </div>
              )}
              {t.logs.map((log) => (
                <div key={log.logIndex} className="flex flex-col gap-2 px-5 py-4 md:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <HashChip value={log.address} href={`${base}/address/${log.address}`} len={42} />
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      #{log.logIndex}
                    </span>
                  </div>
                  {log.topics.map((topic, ti) => (
                    <p key={ti} className="break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="text-zinc-400 dark:text-zinc-600">[{ti}] </span>
                      {topic}
                    </p>
                  ))}
                  {log.data && log.data !== "0x" && (
                    <p className="break-all font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                      {truncate(log.data, 80)}
                    </p>
                  )}
                </div>
              ))}
            </Board>
          </section>
          )}
        </div>
      )}
    </EvmShell>
  );
}
