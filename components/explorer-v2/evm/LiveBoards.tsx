"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader, HEAD, ROW, INK, MUTED, RowSkeleton, idInk, fnInk, feeInk, RowDoor } from "@/components/explorer-v2/ui";
import { formatNumber, truncate, ageShort } from "@/components/explorer-v2/format";
import { prewarmContractNames, useVerifiedContracts } from "@/lib/sourcify-client";
import { useMethodNames } from "./bits";
import { knownAddress } from "@/lib/evm-explorer";
import { useTokenList, formatTokenAmount, type TokenInfo } from "@/lib/token-list";
import { TokenMark } from "./TokenMark";
import { CONTINUOUS_EXECUTION_CHAINS, type Head } from "./useHeadStream";

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

export { HEAD, ROW, INK, MUTED, RowSkeleton, ageShort };

/** a transferred amount beside its method: two places when it is money,
 *  four when it is small, a floor when it is dust */
export function fmtAmount(v: number): string {
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.0001) return v.toFixed(4);
  return "<0.0001";
}

/** A height, every digit in the same ink: the belt's motion already
 *  says which row is new, so the number itself stays quiet and even. */
export function Height({ value }: { value: number }) {
  return <span className={INK}>{formatNumber(value)}</span>;
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
  accepted: "final: accepted by consensus; state root pending",
  executed: "final: state root pending, committed by a later block",
  settled: "final: state root committed",
};

/** The state root as one mark and one word. Pending: a light gray dot
 *  that breathes, every dot on the page in the same phase, because they
 *  are all the same wait. Committed: the dot settles solid and darker and
 *  the word turns over. No bar, no fill: the commit lands whenever the
 *  next header after the τ floor does, and a categorical state deserves a
 *  categorical mark. Gray, not green: a pending root is bookkeeping, not
 *  a live signal. A batch of commits cascades on `delayMs`. */
export function PhaseTrack({
  phase,
  label = true,
  rootBlock,
  delayMs = 0,
}: {
  phase: Phase;
  label?: boolean;
  /** the block that committed the root, named when known */
  rootBlock?: number | null;
  /** how long to hold before showing a commit, so a batch reads as a cascade */
  delayMs?: number;
}) {
  const committed = phase === "settled";
  // phase-lock the breathing: every dot's animation starts at the
  // document timeline's origin, so dots mounted seconds apart rise and
  // fall together
  const dot = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (committed) return;
    let raf = 0;
    const lock = () => {
      const anims = dot.current?.getAnimations() ?? [];
      if (!anims.length) {
        raf = requestAnimationFrame(lock);
        return;
      }
      for (const a of anims) a.startTime = 0;
    };
    lock();
    return () => cancelAnimationFrame(raf);
  }, [committed]);
  return (
    <span
      className="flex items-center gap-2"
      title={committed && rootBlock ? `${PHASE_TITLE[phase]} in #${rootBlock.toLocaleString("en-US")}` : PHASE_TITLE[phase]}
    >
      <motion.span
        ref={dot}
        className={cn("block h-1.5 w-1.5 shrink-0 rounded-full", committed ? "bg-zinc-500 dark:bg-zinc-400" : "animate-[root-breathe_2.4s_ease-in-out_infinite] bg-zinc-300 dark:bg-zinc-600")}
        initial={false}
        animate={{ scale: committed ? [1, 1.8, 1] : 1 }}
        transition={{ duration: 0.5, delay: committed ? delayMs / 1000 : 0, ease: "easeOut" }}
        style={{ transition: `background-color 300ms ease ${delayMs}ms` }}
      />
      {label && (
        <motion.span
          key={committed ? "committed" : "pending"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: committed ? delayMs / 1000 : 0 }}
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.12em]",
            committed ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500",
          )}
        >
          {committed ? "committed" : "pending"}
        </motion.span>
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
  /** hold the belt still (the pointer is over it); newcomers queue up and
   *  catch up, skipping ahead if needed, once released */
  paused = false,
): T[] {
  const [visible, setVisible] = useState<T[]>([]);
  const queue = useRef<T[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
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
      if (q.length && !pausedRef.current) {
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

/** the last value seen before `frozen` went true, until it goes false */
export function useFreeze<T>(value: T, frozen: boolean): T {
  const held = useRef(value);
  if (!frozen) held.current = value;
  return frozen ? held.current : value;
}

/* ------------------------------------------------------------------ */

export interface BlockRow {
  number: number;
  timestamp: number;
  /** millisecond time when the feed has it (ACP-226 headers) */
  timestampMs?: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
}

export function LatestBlocksBoard({
  rows: incomingRows,
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
  // the belt holds still under the pointer so a row can be clicked
  const [hover, setHover] = useState(false);
  const shown = useFreeze({ rows: incomingRows, tip, executedHeight }, hover);
  const rows = shown.rows;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Blocks" action={<ViewAll href={`${base}/blocks`} />} />
      <Board divide={false} className="group/belt" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
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
                <Height value={b.number} />
                <span className={cn(INK, "md:text-right")}>{b.txCount}</span>
                <span className="col-span-2 md:col-span-1">
                  <GasBar used={b.gasUsed} limit={b.gasLimit} />
                </span>
                {showSettlement && (
                  <PhaseTrack
                    phase={phaseOf(b.number, shown.executedHeight, shown.tip?.settledHeight ?? null)}
                    rootBlock={rootBlockFor?.(b.number)}
                    delayMs={(ROWS - i) * 60}
                  />
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
  href,
  len = 6,
  full = false,
}: {
  addr: string;
  name: string | null | undefined;
  token?: TokenInfo | null;
  chainId?: string;
  /** the party's page; with it the mark is a link inside the row's door */
  href?: string;
  len?: number;
  /** the whole address where the column has room (the list page); the
   *  row's own grid decides, so nothing is cut that did not have to be */
  full?: boolean;
}) {
  const fixture = knownAddress(addr);
  const label = name ?? fixture?.label;
  const inner =
    token && chainId ? (
      <TokenMark address={addr} chainId={chainId} token={token} size={14} />
    ) : label ? (
      <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
    ) : full ? (
      // the whole address once the sheet is wide enough for two of them
      // side by side; below that, the middle goes, never the ends
      <>
        <span className={cn("truncate min-[1400px]:hidden", idInk)}>{truncate(addr, 10)}</span>
        <span className={cn("hidden truncate min-[1400px]:inline", idInk)}>{addr}</span>
      </>
    ) : (
      <span className={cn("truncate", idInk)}>{truncate(addr, len)}</span>
    );
  return href ? (
    <Link href={href} title={addr} className="flex min-w-0 items-center hover:text-[#E6212F] [&>*]:hover:text-[#E6212F]" onClick={(e) => e.stopPropagation()}>
      {inner}
    </Link>
  ) : (
    <span className="flex min-w-0 items-center" title={addr}>
      {inner}
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
  // the ticker: one row at a time, names warmed before a row is released;
  // it holds still while the pointer is over it so a row can be clicked
  const [hover, setHover] = useState(false);
  const rows = useDrip(
    txs,
    ROWS + 1,
    streaming,
    (fresh) => {
      void prewarmContractNames(chainId, fresh.map((t) => t.to));
    },
    hover,
  );
  const tokens = useTokenList(chainId);
  const contracts = useVerifiedContracts(chainId, rows.map((t) => t.to));
  const method = useMethodNames(chainId, rows);

  // no lifecycle column here: rows live a few seconds and settlement
  // takes five or more, so it would never be seen to turn. The blocks
  // board, where rows live ten seconds, carries the track.
  const cols = "md:grid-cols-[0.75rem_6.5rem_minmax(0,7rem)_minmax(0,1fr)_minmax(0,9rem)_7rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Transactions" action={<ViewAll href={`${base}/txs`} />} />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
        <div className="overflow-x-auto">
        <div className="md:min-w-[46rem] xl:min-w-0">
        <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span />
          <span>Hash</span>
          <span>Method</span>
          <span>From → To</span>
          <span className="text-right">Value</span>
          {/* the C-Chain burns every fee; a sovereign L1 chooses its own destination */}
          <span className="text-right">{CONTINUOUS_EXECUTION_CHAINS.has(String(chainId)) ? "Burn" : "Fee"}</span>
        </div>
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
        {rows.map((t, i) => {
          const m = method(t);
          const value = Number(t.value);
          return (
            <MotionRow key={t.hash} animateIn={streaming} overflow={i >= ROWS}>
            <RowDoor href={`${base}/tx/${t.hash}`} className={cn(ROW, cols)}>
              {/* status: a red X only when it reverted, the row stays quiet otherwise */}
              <span className="flex h-3 w-3 items-center justify-center">
                {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
              </span>
              <Link href={`${base}/tx/${t.hash}`} className={cn(INK, idInk, "truncate hover:text-[#E6212F]")} onClick={(e) => e.stopPropagation()}>
                {truncate(t.hash, 6)}
              </Link>
              <span className={cn("truncate font-mono text-[12px]", m.named ? fnInk : "text-zinc-400 dark:text-zinc-500")} title={t.methodId || undefined}>
                {m.label}
              </span>
              <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                <Party addr={t.from} name={null} href={`${base}/address/${t.from}`} />
                <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                {t.to ? (
                  <Party
                    addr={t.to}
                    name={contracts.get(t.to.toLowerCase())?.name}
                    token={tokens.get(t.to.toLowerCase())}
                    chainId={chainId}
                    href={`${base}/address/${t.to}`}
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
              <span className={cn("font-mono text-[12.5px] tabular-nums md:text-right", feeInk)}>
                {t.feeWei !== null ? (
                  <>
                    {(t.feeWei / 1e18).toFixed(6)} <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                  </>
                ) : (
                  <span className="text-zinc-300 dark:text-zinc-700">—</span>
                )}
              </span>
            </RowDoor>
            </MotionRow>
          );
        })}
        </Belt>
        </div>
        </div>
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

