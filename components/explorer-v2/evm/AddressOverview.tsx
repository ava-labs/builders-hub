"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, ChevronDown, Cpu, FileCode2, Tag, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, BoardHeader, FIG } from "@/components/explorer-v2/ui";
import { ageWords, formatNumber, formatTime } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { TokenMark, NativeMark } from "./TokenMark";
import { Party } from "./LiveBoards";
import { formatPriceUsd, formatTokenAmount, formatUsd, type TokenInfo } from "@/lib/token-list";
import type { AddressSummary, Transfer, TxSummary } from "@/lib/evm-explorer";

/* The head of an address page, after the Etherscan account page: chips
   that say what the address is, then three cards (what it holds, where
   its history starts and ends, what it is worth), then the tab row. */

export type Who = "Account" | "Contract" | "Verified contract" | "Precompile";

export interface Holding {
  address: string;
  amount: bigint;
  token: TokenInfo;
  usd: number;
}

/** what the address is, and its name where it has one */
export function AddressChips({ who, name, note, verifyHref }: { who: Who; name?: string | null; note?: string; verifyHref?: string }) {
  const Icon = who === "Account" ? Wallet : who === "Verified contract" ? BadgeCheck : who === "Precompile" ? Cpu : FileCode2;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip>
        <Icon className={cn("h-3.5 w-3.5", who === "Verified contract" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500")} aria-hidden />
        {who}
      </Chip>
      {name && (
        <Chip>
          <Tag className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" aria-hidden />
          {name}
        </Chip>
      )}
      {note && <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{note}</span>}
      {verifyHref && (
        <Link
          href={verifyHref}
          className="ml-auto inline-flex items-center gap-1.5 border border-zinc-200 bg-white/80 px-2.5 py-1 font-mono text-[11px] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
        >
          Verify source
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 border border-zinc-200 bg-white/80 px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200">
      {children}
    </span>
  );
}

/** a fully outlined card with its title inside the frame */
function Card({ label, grid = false, children }: { label: string; /** two fields side by side until the cards sit in a row */ grid?: boolean; children: React.ReactNode }) {
  return (
    <Board divide={false} className="flex flex-col border border-zinc-200 dark:border-zinc-800">
      <BoardHeader label={label} display />
      <div className={cn("flex-1 gap-5 px-5 py-5 md:px-6", grid ? "grid grid-cols-2 lg:flex lg:flex-col" : "flex flex-col")}>{children}</div>
    </Board>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="min-w-0 font-mono text-[13.5px] tabular-nums text-zinc-900 dark:text-zinc-50">{children}</div>
    </div>
  );
}

const QUIET = "text-zinc-400 dark:text-zinc-500";
const TXLINK = "inline-flex items-center gap-0.5 underline-offset-4 hover:text-[#E6212F] hover:underline";

export function OverviewCards({
  sym,
  chainId,
  base,
  summary,
  nativeWei,
  price,
  holdings,
  balancesReady,
  pricedAll,
  latest,
  first,
  fundedBy,
  lastTransfer,
  source,
  onHoldings,
}: {
  sym: string;
  chainId: string;
  base: string;
  summary: AddressSummary;
  nativeWei: bigint | null;
  /** the native token's price in USD; null on a chain without one */
  price: number | null;
  holdings: Holding[];
  balancesReady: boolean;
  /** every held token has a price, so the total is the whole worth */
  pricedAll: boolean;
  latest?: TxSummary;
  /** the oldest transaction, known only once the whole history is loaded */
  first?: TxSummary;
  /** the first transaction that sent value to the address, from the same whole history */
  fundedBy?: TxSummary;
  /** the newest token transfer, from the transfers the page already reads */
  lastTransfer?: Transfer;
  /** a verified contract's name and compiler, with the door to its source */
  source?: { name?: string | null; compiler?: string | null; open: () => void };
  onHoldings: () => void;
}) {
  const native = nativeWei === null ? null : Number(nativeWei) / 1e18;
  const nativeUsd = native !== null && price ? native * price : null;
  const tokensUsd = holdings.reduce((acc, h) => acc + h.usd, 0);
  const worth = nativeWei === null || !balancesReady ? null : (nativeUsd ?? 0) + tokensUsd;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card label="Overview">
        <Field label={`${sym} Balance`}>
          <span className="inline-flex items-center gap-2">
            {nativeWei === null ? <span className={QUIET}>…</span> : formatEther(nativeWei.toString(), { decimals: native! >= 1 ? 6 : 8 })}
            {/* the mark is the Avalanche triangle: another native token reads as its symbol alone */}
            {sym === "AVAX" ? <NativeMark symbol={sym} size={16} /> : <span>{sym}</span>}
          </span>
        </Field>
        <Field label={`${sym} Value`}>
          {nativeUsd !== null ? (
            <>
              {formatUsd(nativeUsd)} <span className={cn("text-[12px]", QUIET)}>(@ {formatPriceUsd(price ?? undefined)}/{sym})</span>
            </>
          ) : (
            <span className={QUIET}>{nativeWei === null ? "…" : "No price for this token"}</span>
          )}
        </Field>
        <Field label="Token Holdings">
          <HoldingsMenu chainId={chainId} holdings={holdings} ready={balancesReady} total={tokensUsd} onAll={onHoldings} />
        </Field>
      </Card>

      <Card label="More Info">
        <Field label="Transactions">
          {summary.txCount > 0 ? (
            <span className="flex flex-wrap gap-x-5 gap-y-1">
              <span>
                <span className={QUIET}>Latest: </span>
                {latest ? (
                  <Link href={`${base}/tx/${latest.hash}`} className={TXLINK} title={formatTime(latest.timestamp)}>
                    {ageWords(latest.timestamp)}
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                ) : (
                  <span title={formatTime(summary.lastSeen)}>{ageWords(summary.lastSeen)}</span>
                )}
              </span>
              <span>
                <span className={QUIET}>First: </span>
                {first ? (
                  <Link href={`${base}/tx/${first.hash}`} className={TXLINK} title={formatTime(first.timestamp)}>
                    {ageWords(first.timestamp)}
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                ) : (
                  <span title={formatTime(summary.firstSeen)}>{ageWords(summary.firstSeen)}</span>
                )}
              </span>
            </span>
          ) : (
            <span className={QUIET}>No transactions</span>
          )}
        </Field>
        {fundedBy && (
          <Field label="Funded By">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <Party addr={fundedBy.from} name={null} chainId={chainId} href={`${base}/address/${fundedBy.from}`} len={10} />
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link href={`${base}/tx/${fundedBy.hash}`} className={TXLINK} title={formatTime(fundedBy.timestamp)}>
                {ageWords(fundedBy.timestamp)}
              </Link>
            </span>
          </Field>
        )}
        {lastTransfer && (
          <Field label="Token Transfers">
            <span>
              <span className={QUIET}>Latest: </span>
              <Link href={`${base}/tx/${lastTransfer.txHash}`} className={TXLINK} title={formatTime(lastTransfer.timestamp)}>
                {ageWords(lastTransfer.timestamp)}
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </span>
          </Field>
        )}
        {source && (
          <Field label="Contract Source">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <button type="button" onClick={source.open} className={cn(TXLINK, "text-left")}>
                {source.name ?? "Verified"}
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </button>
              {source.compiler && <span className={cn("text-[12px]", QUIET)}>{source.compiler}</span>}
            </span>
          </Field>
        )}
      </Card>

      <Card label="Totals" grid>
        <Field label="Net Worth">
          <span className={cn(FIG, worth === 0 && QUIET)}>{worth === null ? "…" : worth > 0 ? formatUsd(worth) : "$0.00"}</span>
          <span className={cn("mt-1 block text-[11px]", QUIET)}>{pricedAll ? `${sym} and tokens, at market price` : "Priced tokens only"}</span>
        </Field>
        <Field label="Transactions">
          <span className={FIG}>{formatNumber(summary.txCount)}</span>
          {summary.firstSeen ? <span className={cn("mt-1 block text-[11px]", QUIET)}>Since {formatTime(summary.firstSeen).slice(0, 10)}</span> : null}
        </Field>
      </Card>
    </div>
  );
}

/** the token total as a button that opens the largest holdings, with a door to the whole list */
function HoldingsMenu({ chainId, holdings, ready, total, onAll }: { chainId: string; holdings: Holding[]; ready: boolean; total: number; onAll: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const n = holdings.length;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!ready}
        className="flex w-full items-center justify-between gap-3 border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:border-zinc-400 disabled:cursor-default disabled:hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:disabled:hover:border-zinc-800"
      >
        <span className="min-w-0 truncate">
          {!ready ? (
            <span className={QUIET}>…</span>
          ) : (
            <>
              {total > 0 ? formatUsd(total) : "$0.00"} <span className={cn("text-[12px]", QUIET)}>({n} {n === 1 ? "token" : "tokens"})</span>
            </>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {n === 0 ? (
            <p className={cn("px-3 py-3 text-[12px]", QUIET)}>No listed tokens held</p>
          ) : (
            <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
              {holdings.slice(0, 8).map((h) => (
                <li key={h.address} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                  <span className="flex min-w-0 flex-col">
                    <TokenMark address={h.address} chainId={chainId} token={h.token} size={14} />
                    <span className={cn("truncate pl-5 text-[11px]", QUIET)}>
                      {formatTokenAmount(h.amount, h.token.decimals)} {h.token.symbol}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{h.usd > 0 ? formatUsd(h.usd) : <span className={QUIET}>No price</span>}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAll();
            }}
            className="flex w-full items-center justify-between border-t border-zinc-200 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            Show all holdings
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/** the address page's tab row: filled pills, the active one in ink */
export function PillTabs<T extends string>({ tabs, active, onChange, labels }: { tabs: T[]; active: T; onChange: (t: T) => void; labels: Record<T, string> }) {
  return (
    // a phone scrolls the row sideways rather than letting the last pill fall off
    <div role="tablist" aria-label="Address views" className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={cn(
            "shrink-0 whitespace-nowrap border px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors",
            active === t
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
          )}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  );
}
