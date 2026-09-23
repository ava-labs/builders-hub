"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, CellLabel, HashChip } from "@/components/explorer-v2/ui";
import { timeAgo, truncate } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { FeedDown, useMethodNames } from "./bits";
import { TokenMark, TokenLogo } from "./TokenMark";
import { usdOfWei } from "./hooks";
import { formatTokenAmount, usdOfToken, type TokenMap } from "@/lib/token-list";
import type { Transfer, TxSummary } from "@/lib/evm-explorer";

/* The tables an address page and a token page share, in the ledger's
   grammar: headed columns, one line per row, ink for identity, a red X
   for a revert, direction as an arrow and a word rather than a pill. */

export const FIG = "font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50";
export const UNIT = "text-sm font-normal text-zinc-400 dark:text-zinc-500";

const HEAD =
  "hidden gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500";
const ROW =
  "grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-2.5 transition-colors hover:bg-zinc-50 md:h-11 md:py-0 md:px-6 dark:hover:bg-zinc-900";

/** underline tabs in the subnav's voice, no boxes */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  labels,
}: {
  tabs: T[];
  active: T;
  onChange: (t: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          aria-pressed={active === t}
          className={cn(
            "-mb-px border-b-2 pb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-colors",
            active === t
              ? "border-[#E6212F] text-zinc-900 dark:text-zinc-50"
              : "border-transparent text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100",
          )}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">{children}</div>;
}

/* ------------------------------------------------------------------ */

export function TxTable({
  txs,
  self,
  base,
  symbol,
  usd,
  chainId,
  tokens,
  loading,
  error,
  retry,
}: {
  txs: TxSummary[];
  /** the page's address, so rows read as in or out */
  self: string;
  base: string;
  symbol: string;
  usd: number | null;
  chainId: string;
  tokens: TokenMap;
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  const me = self.toLowerCase();
  const method = useMethodNames(chainId, txs);
  const cols = "md:grid-cols-[0.75rem_7.5rem_minmax(0,9rem)_2.5rem_minmax(0,1fr)_9rem_3.5rem]";
  return (
    <Board>
      <div className={cn(HEAD, cols)}>
        <span />
        <span>Hash</span>
        <span>Method</span>
        <span />
        <span>Counterparty</span>
        <span className="text-right">Value</span>
        <span className="text-right">Age</span>
      </div>
      {txs.length === 0 && (error && !loading ? <FeedDown compact onRetry={retry} /> : <EmptyRow>{loading ? "Loading…" : "no transactions"}</EmptyRow>)}
      {txs.map((t) => {
        const out = t.from.toLowerCase() === me;
        const other = out ? t.to : t.from;
        const tok = other ? tokens.get(other.toLowerCase()) : undefined;
        const m = method(t);
        const value = Number(t.value);
        return (
          <Link key={t.hash} href={`${base}/tx/${t.hash}`} className={cn(ROW, cols)}>
            <span className="flex h-3 w-3 items-center justify-center">
              {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
            </span>
            <span className="min-w-0 truncate font-mono text-[12.5px] text-zinc-900 dark:text-zinc-50">{truncate(t.hash, 6)}</span>
            <span className={cn("min-w-0 truncate font-mono text-[12px]", m.named ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500")} title={t.methodId || undefined}>
              <CellLabel>Method</CellLabel>
              {m.label}
            </span>
            <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", out ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300")}>
              {out ? "out" : "in"}
            </span>
            <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
              <CellLabel>Counterparty</CellLabel>
              <span className="shrink-0 text-zinc-300 dark:text-zinc-700">{out ? "→" : "←"}</span>
              {other ? (
                tok ? <TokenMark address={other} chainId={chainId} token={tok} size={14} /> : <span className="truncate">{truncate(other, 10)}</span>
              ) : (
                <span className="truncate">contract creation</span>
              )}
            </span>
            <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", value > 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600")}>
              <CellLabel>Value</CellLabel>
              {value > 0 ? formatEther(t.value, { decimals: 4 }) : "0"} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
              {value > 0 && usdOfWei(t.value, usd) && <span className="ml-2 text-[11px] text-zinc-400 dark:text-zinc-500">{usdOfWei(t.value, usd)}</span>}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
              <CellLabel>Age</CellLabel>
              {timeAgo(t.timestamp).replace(" ago", "")}
            </span>
          </Link>
        );
      })}
    </Board>
  );
}

/* ------------------------------------------------------------------ */

export function TransferTable({
  transfers,
  self,
  base,
  chainId,
  tokens,
  prices,
  loading,
  error,
  retry,
  /** on a token page every row is that token, so the column is dropped */
  hideToken = false,
}: {
  transfers: Transfer[];
  self: string;
  base: string;
  chainId: string;
  tokens: TokenMap;
  prices: Map<string, number>;
  loading: boolean;
  error: string | null;
  retry: () => void;
  hideToken?: boolean;
}) {
  const me = self.toLowerCase();
  const cols = hideToken
    ? "md:grid-cols-[7.5rem_2.5rem_minmax(0,1fr)_minmax(0,11rem)_3.5rem]"
    : "md:grid-cols-[7.5rem_minmax(0,8rem)_2.5rem_minmax(0,1fr)_minmax(0,11rem)_3.5rem]";
  return (
    <Board>
      <div className={cn(HEAD, cols)}>
        <span>Tx</span>
        {!hideToken && <span>Token</span>}
        <span />
        <span>Counterparty</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Age</span>
      </div>
      {transfers.length === 0 && (error && !loading ? <FeedDown compact onRetry={retry} /> : <EmptyRow>{loading ? "Loading…" : "no token transfers"}</EmptyRow>)}
      {transfers.map((x, i) => {
        const out = x.from.toLowerCase() === me;
        const other = out ? x.to : x.from;
        const tok = tokens.get(x.token.toLowerCase());
        const amount = (() => {
          try {
            return BigInt(x.amount);
          } catch {
            return 0n;
          }
        })();
        const usd = tok ? usdOfToken(amount, tok.decimals, prices.get(x.token.toLowerCase())) : undefined;
        return (
          <Link key={`${x.txHash}-${i}`} href={`${base}/tx/${x.txHash}`} className={cn(ROW, cols)}>
            <span className="min-w-0 truncate font-mono text-[12.5px] text-zinc-900 dark:text-zinc-50">{truncate(x.txHash, 6)}</span>
            {!hideToken && (
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-[12px]">
                <CellLabel>Token</CellLabel>
                {tok ? (
                  <TokenMark address={x.token} chainId={chainId} token={tok} size={14} />
                ) : (
                  <>
                    <TokenLogo address={x.token} chainId={chainId} size={14} />
                    <span className="truncate text-zinc-500 dark:text-zinc-400">{truncate(x.token, 8)}</span>
                  </>
                )}
              </span>
            )}
            <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", out ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300")}>
              {out ? "out" : "in"}
            </span>
            <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
              <CellLabel>Counterparty</CellLabel>
              <span className="shrink-0 text-zinc-300 dark:text-zinc-700">{out ? "→" : "←"}</span>
              <HashChip value={other} href={`${base}/address/${other}`} len={10} className="text-[12px]" />
            </span>
            <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
              <CellLabel>Amount</CellLabel>
              {x.tokenId && x.tokenId !== "0" ? (
                <span className="text-zinc-500 dark:text-zinc-400">#{x.tokenId}</span>
              ) : tok ? (
                <>
                  {formatTokenAmount(amount, tok.decimals)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{tok.symbol}</span>
                  {usd && <span className="ml-2 text-[11px] text-zinc-400 dark:text-zinc-500">{usd}</span>}
                </>
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400">{x.amount}</span>
              )}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
              <CellLabel>Age</CellLabel>
              {timeAgo(x.timestamp).replace(" ago", "")}
            </span>
          </Link>
        );
      })}
    </Board>
  );
}
