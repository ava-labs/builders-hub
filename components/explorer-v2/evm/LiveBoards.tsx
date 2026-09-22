"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import { useVerifiedContracts, functionNameFromAbi, prewarmContractNames } from "@/lib/sourcify-client";
import { getFunctionBySelector } from "@/abi/event-signatures.generated";
import { knownAddress } from "@/lib/evm-explorer";
import { useTokenList, formatTokenAmount, type TokenInfo } from "@/lib/token-list";
import { TokenMark } from "./TokenMark";
import type { Head } from "./useHeadStream";

/* The home page's two live boards, in the ledger's own grammar: one line
   per row, a header naming every column, ink for identity, one
   measurement per cell. No link blue, no boxes inside the hairlines.

   Together they show Continuous Execution (ACP-194) on real data. A
   block is final the moment consensus accepts it (acceptance guarantees
   settlement under ACP-194's worst-case validity), executed once its
   receipts exist (the same second, on the C-Chain), and its state root
   is committed by a later header a few blocks on. The words on the
   boards say "final" and "state root", never "settled" or a delay: the
   root catching up is bookkeeping, not finality, and a reader should
   leave thinking the chain is fast, because it is. */

export const HEAD =
  "hidden gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500";
export const ROW =
  "grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-2.5 transition-colors hover:bg-zinc-50 md:h-11 md:py-0 md:px-6 dark:hover:bg-zinc-900";
export const INK = "font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50";
export const MUTED = "font-mono text-[12px] tabular-nums text-zinc-400 dark:text-zinc-500";

/** a transferred amount beside its method: two places when it is money,
 *  four when it is small, a floor when it is dust */
function fmtAmount(v: number): string {
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.0001) return v.toFixed(4);
  return "<0.0001";
}

/** "5s", "2m", "1h": the age without its "ago", the column header says it */
export function ageShort(unixSecs: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSecs));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** A height against a neighbour: the digits they share go quiet, the
 *  digits that changed carry the ink. The stream reads at a glance. */
export function Height({ value, against }: { value: number; against: number | undefined }) {
  const a = formatNumber(value);
  const b = against !== undefined ? formatNumber(against) : "";
  let i = 0;
  if (a.length === b.length) while (i < a.length - 1 && a[i] === b[i]) i++;
  return (
    <span className={INK}>
      <span className="text-zinc-400 dark:text-zinc-600">{a.slice(0, i)}</span>
      {a.slice(i)}
    </span>
  );
}

/** Gas as the row's one bar: fills the column, no percent beside it */
export function GasBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <span className="block h-1.5 w-full bg-zinc-100 dark:bg-zinc-900" title={`${pct.toFixed(1)}% of gas limit`}>
      <span
        className={cn("block h-full", pct >= 90 ? "bg-[#E6212F]" : "bg-[#A2AFB2] dark:bg-zinc-600")}
        style={{ width: `${Math.max(pct > 0 ? 1.5 : 0, pct).toFixed(1)}%` }}
      />
    </span>
  );
}

export type Phase = "accepted" | "executed" | "settled";

export function phaseOf(number: number, executedHeight: number | null, settledHeight: number | null): Phase {
  if (settledHeight !== null && number <= settledHeight) return "settled";
  if (executedHeight !== null && number <= executedHeight) return "executed";
  return "accepted";
}

const PHASE_TITLE: Record<Phase, string> = {
  accepted: "final: accepted by consensus, executing",
  executed: "final: executing; the state root is committed by a later block",
  settled: "final: state root committed",
};

/** final → executed → state root as three stops. Filled stops are
 *  attested by the RPC; the next one pulses while the chain works. The
 *  optional label names only the state root, the one thing still moving. */
export function PhaseTrack({
  phase,
  label = true,
  rootBlock,
}: {
  phase: Phase;
  label?: boolean;
  /** the block that committed the root, named when known */
  rootBlock?: number | null;
}) {
  const reached = phase === "settled" ? 3 : phase === "executed" ? 2 : 1;
  return (
    <span
      className="flex items-center gap-2"
      title={phase === "settled" && rootBlock ? `${PHASE_TITLE[phase]} in #${rootBlock.toLocaleString("en-US")}` : PHASE_TITLE[phase]}
    >
      <span className="flex items-center gap-1.5">
        {[1, 2, 3].map((i) => {
          const on = i <= reached;
          const next = i === reached + 1;
          return (
            <span key={i} className="relative flex h-1.5 w-1.5 shrink-0">
              {next && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-50" />}
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  on ? "bg-zinc-900 dark:bg-zinc-50" : next ? "border border-[#E6212F]" : "border border-zinc-300 dark:border-zinc-700",
                )}
              />
            </span>
          );
        })}
      </span>
      {label && (
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.12em]",
            phase === "settled" ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500",
          )}
        >
          {phase === "settled" ? "committed" : "executing"}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Motion: the board is a belt. It shows ROWS rows in a clip window one
   row taller than it looks; a newcomer slides in from above and pushes
   every row down together, the last one slides out under the clip line
   and is dropped once hidden. One curve everywhere, the tape's: sharp
   attack, long decay. */

const EASE = [0.22, 1, 0.36, 1] as const;
const ROWS = 10;
/** row pitch: the 44 px row plus its 1 px rule */
export const ROW_H = 45;

export function Belt({ children, rows = ROWS }: { children: React.ReactNode; rows?: number }) {
  return (
    // one row past the window exists for the slide-out; on small screens
    // rows are two lines tall and the window cannot be fixed, so the
    // caller hides the extra row itself
    <div className="relative md:overflow-hidden" style={{ ["--belt-h" as string]: `${rows * ROW_H}px` }}>
      <div className="md:h-(--belt-h)">{children}</div>
    </div>
  );
}

export function MotionRow({
  children,
  animateIn,
  overflow = false,
}: {
  children: React.ReactNode;
  animateIn: boolean;
  /** the row past the window: present for the slide-out on desktop,
   *  hidden on small screens where the window is not fixed */
  overflow?: boolean;
}) {
  return (
    <motion.div
      layout="position"
      initial={animateIn ? { y: -ROW_H, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn("border-b border-zinc-200 dark:border-zinc-800", overflow && "max-md:hidden")}
    >
      {children}
    </motion.div>
  );
}

/* A stream arrives in bursts (a 30-tx block lands as one poll) but should
   read as a ticker. Newcomers wait in a queue and are released one at a
   time; the cadence tightens as the backlog grows so the board never
   falls far behind the chain. */
export function useDrip<T extends { hash: string }>(
  incoming: T[],
  visibleMax: number,
  enabled: boolean,
  onEnqueue?: (items: T[]) => void,
): T[] {
  const [visible, setVisible] = useState<T[]>([]);
  const queue = useRef<T[]>([]);
  const seen = useRef(new Set<string>());
  const painted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // incoming is newest-first; queue oldest-first so release order is
    // chronological, and the very first batch paints whole
    const fresh = incoming.filter((t) => !seen.current.has(t.hash));
    if (!fresh.length) return;
    for (const t of fresh) seen.current.add(t.hash);
    if (seen.current.size > 2000) seen.current = new Set([...seen.current].slice(-1000));
    onEnqueue?.(fresh);
    if (!painted.current) {
      painted.current = true;
      setVisible(fresh.slice(0, visibleMax));
      return;
    }
    queue.current.push(...fresh.slice().reverse());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const q = queue.current;
      if (q.length) {
        // far behind: skip to the newest window rather than replaying
        // history. The ticker stays calm and near-real-time; the tab
        // behind "View all" has every transaction.
        if (q.length > visibleMax * 3) q.splice(0, q.length - visibleMax * 2);
        const next = q.shift()!;
        setVisible((v) => [next, ...v].slice(0, visibleMax));
      }
      const backlog = queue.current.length;
      const delay = backlog > 20 ? 160 : backlog > 6 ? 230 : 320;
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, 320);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, visibleMax]);

  return enabled ? visible : incoming.slice(0, visibleMax);
}

/* ------------------------------------------------------------------ */

export interface BlockRow {
  number: number;
  timestamp: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
}

export function LatestBlocksBoard({
  rows,
  tip,
  executedHeight,
  rootBlockFor,
  base,
  loading,
}: {
  rows: BlockRow[];
  tip: Head | null;
  executedHeight: number | null;
  /** the block that committed a row's state root, when the stream saw it */
  rootBlockFor?: (n: number) => number | null;
  base: string;
  loading: boolean;
}) {
  const settledHeight = tip?.settledHeight ?? null;
  const showSettlement = settledHeight !== null;
  const cols = showSettlement
    ? "md:grid-cols-[7.5rem_3rem_minmax(0,1fr)_8.5rem_3rem]"
    : "md:grid-cols-[7.5rem_3rem_minmax(0,1fr)_3rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Blocks" action={<ViewAll href={`${base}/blocks`} />} />
      <Board divide={false}>
        <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>Height</span>
          <span className="text-right">Txs</span>
          <span>Gas</span>
          {showSettlement && (
            <span title="Every block here is final. Under Continuous Execution the state root is committed by a later block; this column shows whether that has happened yet.">
              State Root
            </span>
          )}
          <span className="text-right">Age</span>
        </div>
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
          {rows.map((b, i) => (
            <MotionRow key={b.number} animateIn overflow={i >= ROWS}>
              <Link href={`${base}/block/${b.number}`} className={cn(ROW, cols)}>
                <Height value={b.number} against={rows[i === 0 ? 1 : 0]?.number} />
                <span className={cn(INK, "md:text-right")}>{b.txCount}</span>
                <span className="col-span-2 md:col-span-1">
                  <GasBar used={b.gasUsed} limit={b.gasLimit} />
                </span>
                {showSettlement && (
                  <PhaseTrack phase={phaseOf(b.number, executedHeight, settledHeight)} rootBlock={rootBlockFor?.(b.number)} />
                )}
                <span className={cn(MUTED, "text-right")}>{ageShort(b.timestamp)}</span>
              </Link>
            </MotionRow>
          ))}
        </Belt>
      </Board>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Transactions: status · hash · method · from → to · fee               */

/** one row, whichever feed it came from: the settlement stream carries
 *  its fee (receipt), the indexer fallback leaves it null and the board
 *  fetches receipts itself */
export interface TxRow {
  hash: string;
  blockNumber: number;
  from: string;
  to: string; // "" for contract creation
  value: string; // wei, decimal string
  methodId: string;
  success: boolean;
  feeWei: number | null;
  /** "100.00 USDT": a decoded ERC-20 transfer amount, when the feed had
   *  calldata and the list knows the token */
  tokenAmount?: string | null;
  /** unix seconds, when the feed carries it (the list page shows age) */
  timestamp?: number;
}

/** A party to the tx: the token list's mark when it is a token, else the
 *  verified name when Sourcify has one, a protocol fixture's label, else
 *  the truncated address */
export function Party({
  addr,
  name,
  token,
  chainId,
}: {
  addr: string;
  name: string | null | undefined;
  token?: TokenInfo | null;
  chainId?: string;
}) {
  if (token && chainId) return <TokenMark address={addr} chainId={chainId} token={token} size={14} />;
  const fixture = knownAddress(addr);
  const label = name ?? fixture?.label;
  return label ? (
    <span className="truncate font-medium text-zinc-900 dark:text-zinc-50" title={addr}>
      {label}
    </span>
  ) : (
    <span className="truncate" title={addr}>
      {truncate(addr, 6)}
    </span>
  );
}

export function LatestTxsBoard({
  txs,
  chainId,
  symbol,
  base,
  loading,
  streaming,
}: {
  txs: TxRow[];
  chainId: string;
  rpcUrl?: string;
  symbol: string;
  base: string;
  loading: boolean;
  /** rows arrive from the receipts stream; enter with motion */
  streaming: boolean;
}) {
  // the ticker: one row at a time, names warmed before a row is released
  const rows = useDrip(txs, ROWS + 1, streaming, (fresh) => {
    void prewarmContractNames(chainId, fresh.map((t) => t.to));
  });
  const contracts = useVerifiedContracts(chainId, rows.map((t) => t.to));
  const tokens = useTokenList(chainId);

  // what the tx did: the verified ABI of the called contract names the
  // selector first, then the generated registry, then the bare selector
  const method = (t: TxRow): { label: string; named: boolean } => {
    const sel = t.methodId?.toLowerCase() ?? "";
    if (!sel) return { label: t.to ? "transfer" : "create", named: true };
    const fromAbi = functionNameFromAbi(t.to ? contracts.get(t.to.toLowerCase())?.abi : null, sel);
    const name = fromAbi ?? getFunctionBySelector(sel)?.name ?? null;
    return name ? { label: name, named: true } : { label: sel, named: false };
  };

  // no lifecycle column here: rows live a few seconds and settlement
  // takes five or more, so it would never be seen to turn. The blocks
  // board, where rows live ten seconds, carries the track.
  const cols = "md:grid-cols-[0.75rem_6.5rem_minmax(0,7rem)_minmax(0,1fr)_minmax(0,8rem)_7rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Transactions" action={<ViewAll href={`${base}/txs`} />} />
      <Board divide={false}>
        <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span />
          <span>Hash</span>
          <span>Method</span>
          <span>From → To</span>
          <span className="text-right">Value</span>
          <span className="text-right">Fee</span>
        </div>
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
        {rows.map((t, i) => {
          const m = method(t);
          const value = Number(t.value);
          return (
            <MotionRow key={t.hash} animateIn={streaming} overflow={i >= ROWS}>
            <Link href={`${base}/tx/${t.hash}`} className={cn(ROW, cols)}>
              {/* status: a red X only when it reverted, the row stays quiet otherwise */}
              <span className="flex h-3 w-3 items-center justify-center">
                {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
              </span>
              <span className={cn(INK, "truncate")}>{truncate(t.hash, 6)}</span>
              <span className={cn("truncate font-mono text-[12px]", m.named ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500")} title={t.methodId || undefined}>
                {m.label}
              </span>
              <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                <Party addr={t.from} name={null} />
                <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                {t.to ? (
                  <Party
                    addr={t.to}
                    name={contracts.get(t.to.toLowerCase())?.name}
                    token={tokens.get(t.to.toLowerCase())}
                    chainId={chainId}
                  />
                ) : (
                  <span className="truncate">contract creation</span>
                )}
              </span>
              {/* what moved: native value, else a decoded token amount, else quiet */}
              <span className="min-w-0 truncate font-mono text-[12.5px] tabular-nums md:text-right">
                {value > 0 ? (
                  <span className="text-zinc-900 dark:text-zinc-50">
                    {fmtAmount(value / 1e18)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                  </span>
                ) : t.tokenAmount ? (
                  <span className="text-zinc-900 dark:text-zinc-50" title={t.tokenAmount}>
                    {t.tokenAmount}
                  </span>
                ) : (
                  <span className="text-zinc-300 dark:text-zinc-700">—</span>
                )}
              </span>
              <span className="font-mono text-[12.5px] tabular-nums text-zinc-900 md:text-right dark:text-zinc-50">
                {t.feeWei !== null ? (
                  <>
                    {(t.feeWei / 1e18).toFixed(6)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                  </>
                ) : (
                  <span className="text-zinc-300 dark:text-zinc-700">…</span>
                )}
              </span>
            </Link>
            </MotionRow>
          );
        })}
        </Belt>
      </Board>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
    >
      View all →
    </Link>
  );
}

export function RowSkeleton({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex h-11 items-center justify-between px-5 md:px-6">
          <div className="h-3 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-3 w-12 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </>
  );
}
