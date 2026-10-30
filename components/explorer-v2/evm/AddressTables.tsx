"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, CellLabel, HEAD, ROW, FIG, INK, UNIT, Tabs, EmptyRow, LoadMore, HashChip, idInk, fnInk, RowDoor } from "@/components/explorer-v2/ui";
import { ageShort, ageWords, formatNumber, formatTime, truncate } from "@/components/explorer-v2/format";
import { formatEther } from "./format";
import { FeedDown, useMethodNames } from "./bits";
import { TokenMark, TokenLogo } from "./TokenMark";
import { usdOfWei } from "./hooks";
import { formatTokenAmount, usdOfToken, type TokenMap } from "@/lib/token-list";
import { isGenesisCode, type Transfer, type TxSummary } from "@/lib/evm-explorer";
import { Party } from "./LiveBoards";
import { useUnlistedTokenMeta } from "./useErc20";
import { useTxFees } from "./useTxFees";
import { useVerifiedContracts } from "@/lib/sourcify-client";

/* The tables an address page and a token page share, in the ledger's
   grammar: headed columns, one line per row, ink for identity, a red X
   for a revert. The transaction table follows the Etherscan account page
   (hash, method, block, age, from, IN or OUT, to, amount, fee); the
   transfer table keeps direction as an arrow and a word. */

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
  total,
  rpcUrl,
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
  /** the address's transaction count, all time, for the line above the table */
  total?: number;
  /** where the fee column reads each row's receipt */
  rpcUrl?: string;
}) {
  const me = self.toLowerCase();
  const method = useMethodNames(chainId, txs);
  const named = useVerifiedContracts(chainId, txs.flatMap((t) => [t.from, t.to]));
  const fee = useTxFees(rpcUrl, txs.map((t) => t.hash));
  // the Age header switches the column between age and UTC time, as on Etherscan
  const [clock, setClock] = useState(false);
  const cols = "md:grid-cols-[minmax(0,10rem)_minmax(0,8rem)_6rem_8rem_minmax(0,1fr)_3.25rem_minmax(0,1fr)_minmax(0,8.5rem)_minmax(0,7rem)]";
  return (
    <div className="flex flex-col gap-4">
      <Board>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 font-mono text-[12px] text-zinc-500 md:px-6 dark:text-zinc-400">
          <span>
            {txs.length === 0
              ? loading
                ? "Loading transactions…"
                : "No transactions"
              : total !== undefined && total > txs.length
                ? <>Latest <span className={INK}>{formatNumber(txs.length)}</span> of <span className={INK}>{formatNumber(total)}</span> transactions</>
                : <><span className={INK}>{formatNumber(txs.length)}</span> {txs.length === 1 ? "transaction" : "transactions"}</>}
          </span>
        </div>
        {/* nine columns need more room than a tablet has: the table scrolls
            sideways there; a phone reads each row as a labeled card */}
        <div className="md:overflow-x-auto">
          <div className="divide-y divide-zinc-200 md:min-w-[68rem] dark:divide-zinc-800">
            <div className={cn(HEAD, cols)}>
              <span>Transaction Hash</span>
              <span>Method</span>
              <span>Block</span>
              <button
                type="button"
                onClick={() => setClock((v) => !v)}
                title={clock ? "Show the age" : "Show the time in UTC"}
                className={cn("text-left uppercase tracking-[0.14em] underline decoration-dotted underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100", idInk)}
              >
                {clock ? "Time (UTC)" : "Age"}
              </button>
              <span>From</span>
              <span />
              <span>To</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Txn Fee</span>
            </div>
            {txs.length === 0 && (error && !loading ? <FeedDown compact onRetry={retry} /> : <EmptyRow>{loading ? "Loading…" : "This address has no transactions."}</EmptyRow>)}
            {txs.map((t) => {
              const from = t.from.toLowerCase();
              const to = t.to.toLowerCase();
              const dir = from === me && to === me ? "self" : from === me ? "out" : "in";
              const m = method(t);
              const genesis = isGenesisCode(chainId, t.to);
              const value = Number(t.value);
              const paid = fee(t.hash);
              return (
                <RowDoor key={t.hash} href={`${base}/tx/${t.hash}`} className={cn(ROW, cols)}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    {!t.success && <X className="h-3 w-3 shrink-0 text-[#E6212F]" strokeWidth={2.5} aria-label="Reverted" />}
                    <HashChip value={t.hash} href={`${base}/tx/${t.hash}`} len={HASH_LEN} />
                  </span>
                  {/* a call into genesis code names a function that no longer
                      runs: never a guessed name there, it reads like a way to
                      move the AVAX burned there */}
                  <span className="min-w-0">
                    <CellLabel>Method</CellLabel>
                    <span
                      className={cn(
                        "inline-block max-w-full truncate border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 align-middle font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-900",
                        m.named && !genesis ? fnInk : "text-zinc-500 dark:text-zinc-400",
                      )}
                      title={genesis ? "Genesis code: every call to it reverts" : t.methodId || m.label}
                    >
                      {genesis ? t.methodId || m.label : m.label}
                    </span>
                  </span>
                  <span className="min-w-0 font-mono text-[12.5px] tabular-nums">
                    <CellLabel>Block</CellLabel>
                    <Link href={`${base}/block/${t.blockNumber}`} className={cn("hover:text-[#E6212F]", idInk)} onClick={(e) => e.stopPropagation()}>
                      {t.blockNumber}
                    </Link>
                  </span>
                  <span className="min-w-0 truncate font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400" title={clock ? ageWords(t.timestamp) : formatTime(t.timestamp)}>
                    <CellLabel>{clock ? "Time (UTC)" : "Age"}</CellLabel>
                    {clock ? formatTime(t.timestamp).replace(" UTC", "") : ageWords(t.timestamp)}
                  </span>
                  <span className="min-w-0">
                    <CellLabel>From</CellLabel>
                    <AddressCell addr={t.from} self={from === me} base={base} chainId={chainId} tokens={tokens} name={named.get(from)?.name} />
                  </span>
                  <span className="self-end md:self-center">
                    <DirectionBadge dir={dir} />
                  </span>
                  <span className="min-w-0">
                    <CellLabel>To</CellLabel>
                    {t.to ? (
                      <AddressCell addr={t.to} self={to === me} base={base} chainId={chainId} tokens={tokens} name={named.get(to)?.name} contract={named.has(to)} />
                    ) : (
                      <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">Contract creation</span>
                    )}
                  </span>
                  <span
                    className={cn("min-w-0 truncate font-mono text-[12.5px] tabular-nums md:text-right", value > 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500")}
                    title={(value > 0 && usdOfWei(t.value, usd)) || undefined}
                  >
                    <CellLabel>Amount</CellLabel>
                    {value > 0 ? etherShort(t.value) : "0"} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                  </span>
                  <span className="min-w-0 truncate font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    <CellLabel>Txn Fee</CellLabel>
                    {paid === undefined ? <span className="text-zinc-300 dark:text-zinc-700">…</span> : paid === null ? <span className="text-zinc-300 dark:text-zinc-700">n/a</span> : feeShort(paid)}
                  </span>
                </RowDoor>
              );
            })}
          </div>
        </div>
      </Board>
      {more?.hasMore && txs.length > 0 && <LoadMore onClick={more.onMore} disabled={more.loading} />}
    </div>
  );
}

/** a fee in the native unit at eight places, so a few cents still reads */
function feeShort(wei: bigint): string {
  const s = formatEther(wei.toString(), { decimals: 8 });
  return Number(s.replace(/,/g, "")) === 0 && wei > 0n ? "<0.00000001" : s;
}

/** IN, OUT or SELF, as a tinted square badge */
function DirectionBadge({ dir }: { dir: "in" | "out" | "self" }) {
  return (
    <span
      className={cn(
        "inline-flex w-11 items-center justify-center border py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]",
        dir === "out"
          ? "border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          : dir === "in"
            ? "border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
      )}
    >
      {dir}
    </span>
  );
}

/** a party in a row: its name where it has one, a contract mark on a
 *  verified contract, a copy button; the page's own address is not a link */
function AddressCell({
  addr,
  self,
  base,
  chainId,
  tokens,
  name,
  contract = false,
}: {
  addr: string;
  self: boolean;
  base: string;
  chainId: string;
  tokens: TokenMap;
  name?: string | null;
  contract?: boolean;
}) {
  const tok = tokens.get(addr.toLowerCase());
  return (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[12px]">
      {contract && !tok && <FileText className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" aria-label="Contract" />}
      {self ? (
        <span className="truncate text-zinc-900 dark:text-zinc-50" title={addr}>
          {truncate(addr, 8)}
        </span>
      ) : (
        <Party addr={addr} name={name ?? null} token={tok} chainId={chainId} href={`${base}/address/${addr}`} len={8} />
      )}
      <CopyMini value={addr} />
    </span>
  );
}

/** the copy button a table cell carries beside an address */
function CopyMini({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy address"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => {});
      }}
      className="-m-1 shrink-0 p-1 text-zinc-300 transition-colors hover:text-zinc-900 dark:text-zinc-600 dark:hover:text-zinc-100"
    >
      {copied ? <Check className="h-3 w-3 text-[#E6212F]" /> : <Copy className="h-3 w-3" />}
    </button>
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
