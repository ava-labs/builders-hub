"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, CellLabel, HEAD, ROW, FIG, UNIT, Tabs, EmptyRow, LoadMore, idInk, fnInk, RowDoor } from "@/components/explorer-v2/ui";
import { ageShort, truncate } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { FeedDown, useMethodNames } from "./bits";
import { TokenMark, TokenLogo } from "./TokenMark";
import { usdOfWei } from "./hooks";
import { formatTokenAmount, usdOfToken, type TokenMap } from "@/lib/token-list";
import { isGenesisCode, type Transfer, type TxSummary } from "@/lib/evm-explorer";
import { Party } from "./LiveBoards";
import { useUnlistedTokenMeta } from "./useErc20";

/* The tables an address page and a token page share, in the ledger's
   grammar: headed columns, one line per row, ink for identity, a red X
   for a revert, direction as an arrow and a word rather than a pill. */

export { FIG, UNIT, Tabs, EmptyRow };

/* a hash long enough to tell two apart at a glance */
const HASH_LEN = 10;

/** a value too small for four decimals still reads as more than zero */
function etherShort(wei: string): string {
  const s = formatEther(wei, { decimals: 4 });
  return Number(s.replace(/,/g, "")) === 0 ? "<0.0001" : s;
}

/** one filter's chips, in the segmented-control idiom the list pages use */
function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">{label}</span>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
              active
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
            )}
          >
            {o.label}
            {o.n !== undefined && <span className={cn("tabular-nums", active ? "opacity-70" : "text-zinc-400 dark:text-zinc-500")}>{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
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
  more,
}: {
  more?: { onMore: () => void; hasMore: boolean; loading: boolean };
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
  const cols = "md:grid-cols-[0.75rem_11rem_minmax(0,9rem)_2.5rem_minmax(0,1fr)_minmax(0,9rem)_6rem_3.5rem]";
  return (
    <div className="flex flex-col gap-4">
    <Board>
      <div className={cn(HEAD, cols)}>
        <span />
        <span>Hash</span>
        <span>Method</span>
        <span />
        <span>Counterparty</span>
        <span className="text-right">Value</span>
        <span className="text-right">USD</span>
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
          <RowDoor key={t.hash} href={`${base}/tx/${t.hash}`} className={cn(ROW, cols)}>
            <span className="flex h-3 w-3 items-center justify-center">
              {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
            </span>
            <Link href={`${base}/tx/${t.hash}`} className={cn("min-w-0 truncate font-mono text-[12.5px] hover:text-[#E6212F]", idInk)} onClick={(e) => e.stopPropagation()}>
              {truncate(t.hash, HASH_LEN)}
            </Link>
            {/* a call into genesis code names a function that no longer runs */}
            <span
              className={cn("min-w-0 truncate font-mono text-[12px]", m.named && !isGenesisCode(chainId, t.to) ? fnInk : "text-zinc-400 dark:text-zinc-500")}
              title={isGenesisCode(chainId, t.to) ? "genesis code: every call to it reverts" : t.methodId || undefined}
            >
              <CellLabel>Method</CellLabel>
              {/* never a guessed name on genesis code: it reads like a way
                  to move the AVAX burned there */}
              {isGenesisCode(chainId, t.to) ? t.methodId || m.label : m.label}
            </span>
            <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", out ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300")}>
              {out ? "out" : "in"}
            </span>
            <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
              <CellLabel>Counterparty</CellLabel>
              <span className="shrink-0 text-zinc-300 dark:text-zinc-700">{out ? "→" : "←"}</span>
              {other ? (
                <Party addr={other} name={null} token={tok} chainId={chainId} href={`${base}/address/${other}`} full />
              ) : (
                <span className="truncate">contract creation</span>
              )}
            </span>
            <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", value > 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600")}>
              <CellLabel>Value</CellLabel>
              {value > 0 ? (
                <>
                  {etherShort(t.value)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                </>
              ) : (
                <span className="text-zinc-300 dark:text-zinc-700">—</span>
              )}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
              {(value > 0 && usdOfWei(t.value, usd)) || ""}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
              <CellLabel>Age</CellLabel>
              {ageShort(t.timestamp)}
            </span>
          </RowDoor>
        );
      })}
    </Board>
    {more?.hasMore && txs.length > 0 && <LoadMore onClick={more.onMore} disabled={more.loading} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Direction = "all" | "in" | "out";
type Kind = "all" | "tokens" | "nfts";

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
  rpcUrl,
  more,
}: {
  /** reads symbol and decimals for tokens the list does not carry */
  rpcUrl?: string;
  more?: { onMore: () => void; hasMore: boolean; loading: boolean };
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
  const [dir, setDir] = useState<Direction>("all");
  const [kind, setKind] = useState<Kind>("all");
  const [token, setToken] = useState<string>("all");
  const [listedOnly, setListedOnly] = useState(false);

  const isNft = (x: Transfer) => /721|1155/.test(x.standard);
  const unlisted = useMemo(() => transfers.filter((x) => !tokens.get(x.token.toLowerCase())).map((x) => x.token), [transfers, tokens]);
  const meta = useUnlistedTokenMeta(rpcUrl, unlisted);
  const symbolOf = (addr: string) => tokens.get(addr.toLowerCase())?.symbol ?? meta.get(addr.toLowerCase())?.symbol ?? truncate(addr, 6);

  // the filters only count what the other filters leave, so each chip's
  // number is what clicking it would show
  const pass = (x: Transfer, skip?: "dir" | "kind" | "token" | "listed") => {
    const out = x.from.toLowerCase() === me;
    if (skip !== "dir" && dir !== "all" && (dir === "out") !== out) return false;
    if (skip !== "kind" && kind !== "all" && (kind === "nfts") !== isNft(x)) return false;
    if (skip !== "token" && token !== "all" && x.token.toLowerCase() !== token) return false;
    if (skip !== "listed" && listedOnly && !tokens.get(x.token.toLowerCase())) return false;
    return true;
  };
  const rows = transfers.filter((x) => pass(x));
  const count = (skip: "dir" | "kind", test: (x: Transfer) => boolean) => transfers.filter((x) => pass(x, skip) && test(x)).length;
  // the tokens this page holds, busiest first
  const tokenOptions = useMemo(() => {
    const by = new Map<string, number>();
    for (const x of transfers) by.set(x.token.toLowerCase(), (by.get(x.token.toLowerCase()) ?? 0) + 1);
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [transfers]);

  const cols = hideToken
    ? "md:grid-cols-[11rem_2.5rem_minmax(0,1fr)_minmax(0,11rem)_6rem_3.5rem]"
    : "md:grid-cols-[11rem_minmax(0,9rem)_2.5rem_minmax(0,1fr)_minmax(0,11rem)_6rem_3.5rem]";
  return (
    <div className="flex flex-col gap-4">
      {transfers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Chips
            label="Direction"
            value={dir}
            onChange={setDir}
            options={[
              { value: "all", label: "All", n: count("dir", () => true) },
              { value: "in", label: "In", n: count("dir", (x) => x.from.toLowerCase() !== me) },
              { value: "out", label: "Out", n: count("dir", (x) => x.from.toLowerCase() === me) },
            ]}
          />
          {!hideToken && (
            <Chips
              label="Kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "All", n: count("kind", () => true) },
                { value: "tokens", label: "Tokens", n: count("kind", (x) => !isNft(x)) },
                { value: "nfts", label: "NFTs", n: count("kind", isNft) },
              ]}
            />
          )}
          {!hideToken && tokenOptions.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Token</span>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="border border-zinc-200 bg-white/80 px-2 py-1.5 font-mono text-[11px] text-zinc-700 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:focus:border-zinc-100"
              >
                <option value="all">All tokens</option>
                {tokenOptions.map(([addr, n]) => (
                  <option key={addr} value={addr}>
                    {symbolOf(addr)}
                    {tokens.get(addr) ? "" : " (unlisted)"} · {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!hideToken && (
            <button
              type="button"
              onClick={() => setListedOnly((v) => !v)}
              aria-pressed={listedOnly}
              title="hide tokens that are not on the token list; most airdropped spam is unlisted"
              className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <span className={cn("flex h-3 w-3 items-center justify-center border", listedOnly ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100" : "border-zinc-300 dark:border-zinc-700")}>
                {listedOnly && <span className="h-1.5 w-1.5 bg-white dark:bg-zinc-900" />}
              </span>
              Listed tokens only
            </button>
          )}
        </div>
      )}
    <Board>
      <div className={cn(HEAD, cols)}>
        <span>Tx</span>
        {!hideToken && <span>Token</span>}
        <span />
        <span>Counterparty</span>
        <span className="text-right">Amount</span>
        <span className="text-right">USD</span>
        <span className="text-right">Age</span>
      </div>
      {transfers.length === 0 && (error && !loading ? <FeedDown compact onRetry={retry} /> : <EmptyRow>{loading ? "Loading…" : "no token transfers"}</EmptyRow>)}
      {transfers.length > 0 && rows.length === 0 && <EmptyRow>no transfers match these filters</EmptyRow>}
      {rows.map((x, i) => {
        const out = x.from.toLowerCase() === me;
        const other = out ? x.to : x.from;
        const tok = tokens.get(x.token.toLowerCase());
        const um = tok ? undefined : meta.get(x.token.toLowerCase());
        const amount = (() => {
          try {
            return BigInt(x.amount);
          } catch {
            return 0n;
          }
        })();
        const usd = tok ? usdOfToken(amount, tok.decimals, prices.get(x.token.toLowerCase())) : undefined;
        return (
          <RowDoor key={`${x.txHash}-${i}`} href={`${base}/tx/${x.txHash}`} className={cn(ROW, cols)}>
            <Link href={`${base}/tx/${x.txHash}`} className={cn("min-w-0 truncate font-mono text-[12.5px] hover:text-[#E6212F]", idInk)} onClick={(e) => e.stopPropagation()}>
              {truncate(x.txHash, HASH_LEN)}
            </Link>
            {!hideToken && (
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-[12px]">
                <CellLabel>Token</CellLabel>
                {tok ? (
                  <TokenMark address={x.token} chainId={chainId} token={tok} size={14} />
                ) : (
                  <>
                    <TokenLogo address={x.token} chainId={chainId} size={14} />
                    <Link href={`${base}/address/${x.token}`} title={`${x.token} · not on the token list`} className="truncate text-zinc-500 hover:text-[#E6212F] dark:text-zinc-400" onClick={(e) => e.stopPropagation()}>
                      {um?.symbol ?? truncate(x.token, 8)}
                    </Link>
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
              <Party addr={other} name={null} href={`${base}/address/${other}`} full />
            </span>
            <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
              <CellLabel>Amount</CellLabel>
              {x.tokenId && x.tokenId !== "0" ? (
                <span className="text-zinc-500 dark:text-zinc-400">#{x.tokenId}</span>
              ) : tok ? (
                <>
                  {formatTokenAmount(amount, tok.decimals)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{tok.symbol}</span>
                </>
              ) : um ? (
                <>
                  <span className="text-zinc-600 dark:text-zinc-300">{formatTokenAmount(amount, um.decimals)}</span> <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{um.symbol}</span>
                </>
              ) : (
                // no decimals known: the raw integer, said to be raw
                <span className="text-zinc-500 dark:text-zinc-400" title="raw amount: the token did not report its decimals">
                  {amount.toLocaleString("en-US")} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">raw</span>
                </span>
              )}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">{usd ?? ""}</span>
            <span className="font-mono text-[12px] tabular-nums text-zinc-400 md:text-right dark:text-zinc-500">
              <CellLabel>Age</CellLabel>
              {ageShort(x.timestamp)}
            </span>
          </RowDoor>
        );
      })}
    </Board>
    {more?.hasMore && transfers.length > 0 && <LoadMore onClick={more.onMore} disabled={more.loading} />}
    </div>
  );
}
