"use client";

import Link from "next/link";
import { memo, startTransition, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { INK, MUTED, LiveDot, RowDoor, fnInk } from "@/components/explorer-v2/ui";
import { ageShort, formatNumber } from "@/components/explorer-v2/format";
import { EASE_CSS, useStill } from "@/components/explorer-v2/motion";
import { Belt, MotionRow, Party, fmtAmount, useDrip, useFreeze } from "@/components/explorer-v2/evm/LiveBoards";
import { useMethodNames } from "@/components/explorer-v2/evm/bits";
import { useHeadStream, type Head, type StreamTx } from "@/components/explorer-v2/evm/useHeadStream";
import { readRpc } from "@/lib/explorer-rpc";
import { prewarmContractNames, useVerifiedContracts } from "@/lib/sourcify-client";
import { decodeErc20Call, formatTokenAmount, useTokenList } from "@/lib/token-list";
import type { TxListResponse } from "@/lib/evm-explorer";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* A chain's live preview in the city: its newest blocks and transactions
   as they land, in the explorer's own grammar. The city opens it at the
   right when a chain is picked.

   The feed is the C-Chain home's head stream, read every five seconds
   instead of every second: headers for the blocks, and each poll the
   newest block's receipts for the transactions, so a row knows when it
   reverted and a token transfer shows its amount. The C-Chain reads through the
   dedicated node, an L1 through the public RPC its catalog entry lists.
   The indexer is asked once, when the card opens, so a quiet chain's list
   opens full; its rows count only inside the strip's blocks, because for
   some L1s it is months behind the chain. Polls stop while the tab is
   hidden and when the card closes, and a feed that stays silent for three
   polls stops and says why. */

export interface LiveTarget {
  /** EVM chain ID, the explorer routes' key */
  chainId: string;
  name: string;
  logo: string;
  /** the explorer's slug; null when the explorer has no pages for it */
  slug: string | null;
  symbol: string;
  /** the chain's explorer home, when it has one */
  explorer: string | null;
  /** the chain's public RPC; the catalog's when absent */
  rpcUrl?: string | null;
}

/** the chain's newest block, as the pane's stream read it */
export interface LiveTip {
  number: number;
  /** ms since epoch */
  timestamp: number;
}

const POLL_MS = 5_000;
/* the strip's blocks, and the list's rows with the one sliding out under its foot */
const BLOCKS = 6;
const TXS = 12;
/* polls without an answer before the card stops asking */
const MAX_MISSES = 3;
/* this long connecting in view, the status says what it waits on */
const SLOW_MS = 8_000;
/* the first paint's stagger: a tile after a tile, a row after a row */
const TILE_STEP_MS = 80;
const ROW_STEP_MS = 45;
/* blocks the throughput remembers: past a minute at the C-Chain's pace */
const PULSE_KEEP = 200;
/* the tape's curve: sharp attack, long decay */
const EASE = [0.22, 1, 0.36, 1] as const;

const CATALOG = (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true);

/* the card's chain in the catalog: by EVM chain ID, or by subnet for a set the city stands as a guest */
function catalogEntry(id: string): L1Chain | undefined {
  return id.startsWith("p:") ? CATALOG.find((c) => c.subnetId === id.slice(2)) : CATALOG.find((c) => String(c.chainId) === id);
}

/* one clock for every age on the card: its tick re-renders the ages, not the rows around them */
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockSubs = new Set<() => void>();

function subscribeClock(fn: () => void): () => void {
  clockSubs.add(fn);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const f of clockSubs) f();
    }, 1_000);
  }
  return () => {
    clockSubs.delete(fn);
    if (clockSubs.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

/** now, in ms, on the card's clock: a component that reads it renders again every second */
export function useClock(): number {
  return useSyncExternalStore(subscribeClock, () => clockNow, () => 0) || Date.now();
}

/** "4s": an age that ticks with the card's clock */
export function Age({ ms }: { ms: number }) {
  useClock();
  return <>{ageShort(ms / 1000)}</>;
}

/** transactions a second over the last minute, or over the blocks seen when they span less */
function throughput(blocks: { at: number; txCount: number }[], now: number): number | null {
  if (blocks.length < 2) return null;
  const from = Math.max(Math.min(...blocks.map((b) => b.at)), now - 60_000);
  const span = now - from;
  if (span < 5_000) return null;
  // the oldest block opens the span; its transactions landed before it
  return blocks.filter((b) => b.at > from).reduce((sum, b) => sum + b.txCount, 0) / (span / 1000);
}

/** throughput in the unit that reads: per second from one a second up, else per minute */
function rateOf(tps: number | null): { value: string; unit: string } {
  if (tps === null) return { value: "—", unit: "" };
  if (tps >= 1) return { value: tps.toFixed(1), unit: "TPS" };
  const perMin = tps * 60;
  return { value: perMin === 0 ? "0" : perMin < 10 ? perMin.toFixed(1) : perMin.toFixed(0), unit: "tx/min" };
}

/** "0.8 s", "40 s", "3 min": the gap between blocks */
function gapOf(ms: number): string {
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 120) return `${Math.round(s)} s`;
  return `${Math.round(s / 60)} min`;
}

/* the indexer's newest transactions, read once; null until the read settles */
function useIndexedTxs(chainId: string, on: boolean): StreamTx[] | null {
  const [rows, setRows] = useState<StreamTx[] | null>(null);
  useEffect(() => {
    if (!on) return;
    const controller = new AbortController();
    fetch(`/api/evm/${chainId}/txs?limit=${TXS}`, {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4_000)]),
    })
      .then((res) => (res.ok ? (res.json() as Promise<TxListResponse>) : { transactions: [] }))
      .then((data) => {
        const rows = (data.transactions ?? []).map((t) => ({
          hash: t.hash,
          blockNumber: t.blockNumber,
          txIndex: t.txIndex,
          timestamp: t.timestamp,
          from: t.from,
          to: t.to,
          value: t.value,
          methodId: t.methodId ?? "",
          // the indexer keeps no calldata, so its token transfers show no amount
          input: "",
          success: t.success,
          feeWei: 0,
        }));
        // the opening rows land in a transition: their render yields to the camera's frames
        startTransition(() => setRows(rows));
      })
      .catch(() => {
        if (!controller.signal.aborted) setRows([]);
      });
    return () => controller.abort();
  }, [chainId, on]);
  return rows;
}

const txNewer = (a: StreamTx, b: StreamTx) => b.blockNumber - a.blockNumber || a.txIndex - b.txIndex;

/* ------------------------------------------------------------------ */

export function ChainLogo({ uri, name }: { uri: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 font-mono text-[12px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
        {name.charAt(0)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={uri} alt="" onError={() => setBroken(true)} className="h-8 w-8 shrink-0 rounded-full bg-white object-contain ring-1 ring-zinc-200 dark:ring-zinc-800" />;
}

export function Heading({ label, aside }: { label: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pb-2">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {aside && <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{aside}</span>}
    </div>
  );
}

/* the one line that says why a part of the card is empty */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mx-4 mb-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{children}</p>;
}

/** the pane's state in a word: its dot green while live, breathing while it waits, still when it has stopped */
export function StatusLine({ label, state }: { label: string; state: "live" | "waiting" | "still" }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
      {state === "live" ? (
        <LiveDot />
      ) : (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            state === "waiting" ? "animate-[root-breathe_2.4s_ease-in-out_infinite] bg-zinc-400 dark:bg-zinc-500" : "bg-zinc-300 dark:bg-zinc-600",
          )}
        />
      )}
      <span className="truncate">{label}</span>
    </p>
  );
}

/* Loading: grey shapes a soft light sweeps across, the wave passing down
   the card. The sweep is the app's shimmer-sweep keyframes; a reader who
   asks for less motion gets the shapes still. */

/** a shape the light sweeps across; `delay` places it in the wave */
export function Shimmer({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span aria-hidden className={cn("relative block overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900", className)}>
      <span
        className="absolute inset-0 -translate-x-full animate-[shimmer-sweep_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/[0.06]"
        style={{ animationDelay: `${delay}ms` }}
      />
    </span>
  );
}

/** rows to come, in the two-line row's shape and hairlines; the lower ones fade toward the foot */
export function SkeletonRows({ n, delay = 0 }: { n: number; delay?: number }) {
  const widths = [
    ["w-24", "w-40"],
    ["w-20", "w-36"],
    ["w-28", "w-44"],
  ];
  return (
    <div className="[mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
      {Array.from({ length: n }, (_, i) => {
        const [a, b] = widths[i % widths.length];
        const d = delay + i * 70;
        return (
          <div key={i} className="grid h-11 grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-3 border-b border-zinc-200 px-4 py-[8px] dark:border-zinc-800">
            <Shimmer className={cn("h-2.5", a)} delay={d} />
            <Shimmer className="h-2.5 w-12 justify-self-end" delay={d + 40} />
            <Shimmer className={cn("h-2.5", b)} delay={d + 20} />
            <Shimmer className="h-2.5 w-6 justify-self-end" delay={d + 60} />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the blocks: a strip of the newest six, the newest at the left       */

function BlockTile({
  b,
  base,
  newest,
  intro,
  delay,
  still,
}: {
  b: Head;
  base: string | null;
  newest: boolean;
  /** one of the first paint's tiles: it rises into its place in turn, where a later block slides in from the left */
  intro: boolean;
  /** ms before it shows */
  delay: number;
  /** the reader asked for less motion */
  still: boolean;
}) {
  // the entrance is fixed when the tile mounts: a later shift along the strip never replays it
  const [enter] = useState(() => ({ intro, delay }));
  const fill = b.gasLimit > 0 ? Math.min(1, b.gasUsed / b.gasLimit) : 0;
  const label = `Block ${formatNumber(b.number)}: ${b.txCount} ${b.txCount === 1 ? "tx" : "txs"}, ${(fill * 100).toFixed(1)}% of the gas limit`;
  const cls = cn(
    // no color transition: the newest mark moves at once, never two at a time
    "relative flex h-[58px] flex-col justify-between overflow-hidden rounded-lg border bg-white/60 px-2 py-1.5 dark:bg-zinc-950/60",
    newest ? "border-[#E6212F]/55" : "border-zinc-200 dark:border-zinc-800",
    base && !newest && "hover:border-zinc-400 dark:hover:border-zinc-600",
  );
  const body = (
    <>
      {/* gas as the block's level, the tape's vessel, rising as the tile lands; a full block goes to ink, never to red */}
      <span
        aria-hidden
        className={cn("absolute inset-x-0 bottom-0 origin-bottom", fill >= 0.9 ? "bg-zinc-800/20 dark:bg-zinc-300/20" : "bg-[#A2AFB2]/30 dark:bg-[#A2AFB2]/15")}
        style={{
          height: `${Math.max(fill > 0 ? 4 : 0, fill * 100).toFixed(1)}%`,
          animation: still ? undefined : `bh-rise 520ms ${EASE_CSS} ${enter.delay + 120}ms both`,
        }}
      />
      <span className="relative truncate font-mono text-[9.5px] tabular-nums text-zinc-400 dark:text-zinc-500">…{String(b.number).slice(-4)}</span>
      <span className={cn(INK, "relative text-[14px] leading-none")}>
        {b.txCount}
        <span className="ml-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">tx</span>
      </span>
      <span className="relative font-mono text-[9.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
        <Age ms={b.timestampMs} />
      </span>
    </>
  );
  return (
    <motion.div
      layout="position"
      initial={still ? false : enter.intro ? { opacity: 0, y: 6 } : { opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={
        enter.intro
          ? { duration: 0.3, ease: "easeOut", delay: enter.delay / 1000, layout: { duration: 0.6, ease: EASE } }
          : { duration: 0.6, ease: EASE }
      }
      className="min-w-0"
      data-live-block
    >
      {base ? (
        <Link href={`${base}/block/${b.number}`} title={label} aria-label={label} className={cls}>
          {body}
        </Link>
      ) : (
        <span title={label} className={cls}>
          {body}
        </span>
      )}
    </motion.div>
  );
}

const BlockStrip = memo(function BlockStrip({
  blocks,
  base,
  loading,
  onHold,
}: {
  blocks: Head[];
  base: string | null;
  loading: boolean;
  onHold: (hold: boolean) => void;
}) {
  const still = useStill();
  // the first paint's blocks, which fill in one after another
  const intro = useRef<Set<string> | null>(null);
  if (intro.current === null && blocks.length > 0) intro.current = new Set(blocks.map((b) => b.hash));
  if (blocks.length === 0) {
    return loading ? (
      <div className="grid grid-cols-6 gap-1.5 px-4">
        {Array.from({ length: BLOCKS }, (_, i) => (
          <Shimmer key={i} delay={i * 70} className="h-[58px] rounded-lg border border-zinc-200/80 bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/60" />
        ))}
      </div>
    ) : null;
  }
  return (
    // the strip holds still under the pointer so a block can be clicked;
    // the oldest block fades at the edge, so its drop reads as leaving
    <div
      className="grid grid-cols-6 gap-1.5 px-4 [mask-image:linear-gradient(to_right,black_86%,transparent)]"
      onMouseEnter={() => onHold(true)}
      onMouseLeave={() => onHold(false)}
    >
      {blocks.map((b, i) => {
        const first = intro.current?.has(b.hash) ?? false;
        return <BlockTile key={b.hash} b={b} base={base} newest={i === 0} intro={first} delay={first ? i * TILE_STEP_MS : 0} still={still} />;
      })}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* the transactions: the home board's row folded onto two lines         */

/* what it called and what moved, then who and when; the status mark
   stands in the left margin so the text keeps the headings' edge */
const TX_ROW =
  "relative grid h-11 grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-3 px-4 py-[5px] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900";

const TxList = memo(function TxList({
  txs,
  chainId,
  symbol,
  base,
  loading,
}: {
  txs: StreamTx[];
  chainId: string;
  symbol: string;
  base: string | null;
  loading: boolean;
}) {
  // the ticker: one row at a time, names warmed before a row is released;
  // it holds still while the pointer is over it so a row can be clicked
  const [hover, setHover] = useState(false);
  const shown = useDrip(txs, TXS, true, (fresh) => void prewarmContractNames(chainId, fresh.map((t) => t.to)), hover);
  // a block whose receipts came late slots into its place
  const rows = useMemo(() => [...shown].sort(txNewer), [shown]);
  const still = useStill();
  // the first paint's rows, by their place: they fade up over the skeleton's hairlines in turn, where a later row slides in
  const intro = useRef<Map<string, number> | null>(null);
  if (intro.current === null && rows.length > 0) intro.current = new Map(rows.map((t, i) => [t.hash, i]));
  const tokens = useTokenList(chainId);
  const contracts = useVerifiedContracts(chainId, rows.map((t) => t.to));
  const method = useMethodNames(chainId, rows);

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {loading && rows.length === 0 && <SkeletonRows n={8} />}
      {rows.length > 0 && (
        <Belt rows={TXS - 1}>
          {rows.map((t, i) => {
            const at = intro.current?.get(t.hash);
            const fade = at !== undefined && !still ? { animation: `bh-fade-up 520ms ${EASE_CSS} ${at * ROW_STEP_MS}ms both` } : undefined;
            const m = method(t);
            const value = Number(t.value);
            const to = t.to.toLowerCase();
            const token = to ? tokens.get(to) : undefined;
            const call = token ? decodeErc20Call(t.input) : null;
            const tokenAmount = call && token ? `${formatTokenAmount(call.amount, token.decimals)} ${token.symbol}` : null;
            const cells = (
              <>
                {/* status: a red X only when it reverted, the row stays quiet otherwise */}
                {!t.success && <X className="absolute left-[3px] top-[9px] h-2.5 w-2.5 text-[#E6212F]" strokeWidth={3} aria-label="reverted" />}
                <span
                  className={cn("col-start-1 row-start-1 min-w-0 truncate font-mono text-[12px]", m.named ? fnInk : "text-zinc-400 dark:text-zinc-500")}
                  title={t.methodId || undefined}
                >
                  {m.label}
                </span>
                {/* what moved: native value, else a decoded token amount, else quiet */}
                <span className="col-start-2 row-start-1 max-w-[8rem] truncate text-right font-mono text-[12px] tabular-nums">
                  {value > 0 ? (
                    <span className="text-zinc-900 dark:text-zinc-50">
                      {fmtAmount(value / 1e18)} <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                    </span>
                  ) : tokenAmount ? (
                    <span className="text-zinc-900 dark:text-zinc-50" title={tokenAmount}>
                      {tokenAmount}
                    </span>
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-700">—</span>
                  )}
                </span>
                <span className="col-start-1 row-start-2 flex min-w-0 items-center gap-1.5 font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  <Party addr={t.from} name={null} href={base ? `${base}/address/${t.from}` : undefined} />
                  <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                  {t.to ? (
                    <Party
                      addr={t.to}
                      name={contracts.get(to)?.name}
                      token={token}
                      chainId={chainId}
                      href={base ? `${base}/address/${t.to}` : undefined}
                    />
                  ) : (
                    <span className="truncate">contract creation</span>
                  )}
                </span>
                <span className={cn(MUTED, "col-start-2 row-start-2 text-right text-[11px]")}>
                  <Age ms={t.timestamp * 1000} />
                </span>
              </>
            );
            return (
              <MotionRow key={t.hash} animateIn={at === undefined && !still} overflow={i >= TXS - 1}>
                {base ? (
                  <RowDoor href={`${base}/tx/${t.hash}`} title={t.hash} className={TX_ROW} style={fade} data-live-row>
                    {cells}
                  </RowDoor>
                ) : (
                  <div title={t.hash} className={TX_ROW} style={fade} data-live-row>
                    {cells}
                  </div>
                )}
              </MotionRow>
            );
          })}
        </Belt>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */

export function ChainLive({
  chain,
  onClose,
  compact = false,
  armed = true,
  onTip,
}: {
  chain: LiveTarget;
  onClose: () => void;
  /** under a chain view that already names the chain and opens its explorer: no name row, no close, no footer */
  compact?: boolean;
  /** the stream polls only once armed: the app arms it when the camera has landed, so the polls stay out of the flight */
  armed?: boolean;
  /** the stream's newest block each time it moves, for the city's facts; null before the first, once the feed stops, and when the pane closes */
  onTip?: (tip: LiveTip | null) => void;
}) {
  const entry = catalogEntry(chain.chainId);
  // the catalog's EVM chain ID: a guest set arrives keyed by its subnet
  const chainId = entry ? String(entry.chainId) : chain.chainId;
  const rpc = /^\d+$/.test(chainId) ? readRpc(chainId, chain.rpcUrl ?? entry?.rpcUrl) : undefined;
  const symbol = chain.symbol || entry?.networkToken?.symbol || "";
  const base = chain.explorer;

  const [down, setDown] = useState(false);
  // after the opening three blocks, one block's receipts a poll: about four
  // requests every five seconds, under one a second on a shared RPC. Ten
  // heads keep a backfill batch under ten calls, the cap some L1 RPCs set
  // (Henesys answers 500 to eleven)
  // an L1 whose RPC refuses the browser reads through the site's relay, which only forwards to the catalog's own RPC
  const relay = rpc && !rpc.startsWith("/") ? `/api/rpc/${chainId}` : undefined;
  const head = useHeadStream(down || !armed ? undefined : rpc, { intervalMs: POLL_MS, keep: 10, seed: BLOCKS + 1, keepTxs: 36, pull: 1, relay });
  const answering = head.live;
  // a feed silent for three polls in view stops asking; the note says so and offers a retry
  useEffect(() => {
    if (!rpc || down || answering || !armed) return;
    let misses = 0;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      misses += 1;
      if (misses >= MAX_MISSES) setDown(true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [rpc, down, answering, armed]);
  // an RPC slow to answer: eight seconds connecting, the status says what it waits on
  const connecting = Boolean(rpc) && armed && !down && head.heads.length === 0;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!connecting) return;
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [connecting]);

  // the newest block for the city's facts, fresher than the chain pulse's reading
  const onTipRef = useRef(onTip);
  useEffect(() => {
    onTipRef.current = onTip;
  }, [onTip]);
  const tipNumber = head.tip?.number ?? null;
  const tipMs = head.tip?.timestampMs ?? null;
  useEffect(() => {
    onTipRef.current?.(tipNumber !== null && tipMs !== null ? { number: tipNumber, timestamp: tipMs } : null);
  }, [tipNumber, tipMs]);
  useEffect(() => () => onTipRef.current?.(null), []);

  // a stopped feed keeps what it last showed
  const heads = useFreeze(head.heads, down);
  const streamTxs = useFreeze(head.streamTxs, down);
  const tip = heads[0] ?? null;
  const txsInHeads = heads.some((h) => h.txCount > 0);

  // the opening fill: the indexer's rows inside the strip's blocks, fixed
  // once both have answered, so a late read never lands above newer rows
  const indexed = useIndexedTxs(chainId, Boolean(rpc));
  const [opening, setOpening] = useState<StreamTx[] | null>(null);
  useEffect(() => {
    if (opening !== null || indexed === null || heads.length === 0) return;
    const floor = heads[Math.min(heads.length, BLOCKS + 1) - 1].number;
    setOpening(indexed.filter((t) => t.blockNumber >= floor));
  }, [opening, indexed, heads]);
  const txs = useMemo(() => {
    if (opening === null) return [];
    const seen = new Set(streamTxs.map((t) => t.hash));
    return [...streamTxs, ...opening.filter((t) => !seen.has(t.hash))].sort(txNewer);
  }, [streamTxs, opening]);

  // blocks with transactions but no receipts after three polls: the RPC does not serve them
  const waiting = !down && txsInHeads && txs.length === 0;
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => setStuck(true), POLL_MS * MAX_MISSES);
    return () => {
      clearTimeout(id);
      setStuck(false);
    };
  }, [waiting]);

  // the strip drips here so the height above it moves with it
  const [holdBlocks, setHoldBlocks] = useState(false);
  const newest = useMemo(() => heads.slice(0, BLOCKS), [heads]);
  const dripped = useDrip(newest, BLOCKS, true, undefined, holdBlocks);
  // a height filled in late slots into its place
  const blocks = useMemo(() => [...dripped].sort((a, b) => b.number - a.number), [dripped]);

  // the mean gap over every kept head: an L1 makes blocks in bursts, so
  // the newest pair alone would read a quiet chain as a fast one
  const gapMs = heads.length >= 2 ? (heads[0].timestampMs - heads[heads.length - 1].timestampMs) / (heads.length - 1) : null;
  // every head the stream shows feeds the pulse, so the throughput counts
  // every block of the last minute, not only the ten the stream keeps; it
  // is read when the heads land, so the figure holds still between polls
  const pulse = useRef(new Map<number, { at: number; txCount: number }>());
  const [tps, setTps] = useState<number | null>(null);
  useEffect(() => {
    const seen = pulse.current;
    for (const h of heads) seen.set(h.number, { at: h.timestampMs, txCount: h.txCount });
    if (seen.size > PULSE_KEEP) for (const n of [...seen.keys()].sort((a, b) => a - b).slice(0, seen.size - PULSE_KEEP)) seen.delete(n);
    setTps(throughput([...seen.values()], Date.now()));
  }, [heads]);
  const rate = rateOf(down ? null : tps);
  const height = blocks[0]?.number ?? tip?.number ?? null;
  // the figures shimmer until the first heads, and the rate until the pulse has read them
  const loading = Boolean(rpc) && !down && heads.length === 0;
  const rateLoading = loading || (!down && heads.length > 0 && tps === null && pulse.current.size === 0);

  const status = !rpc
    ? "No RPC"
    : down
      ? "Stopped"
      : answering
        ? "Live"
        : heads.length
          ? "Not answering"
          : slow
            ? "Waiting for the chain's RPC"
            : "Connecting";
  // why the feed shows nothing, under the header; why the list is empty, under its heading
  const feedNote: ReactNode = !rpc ? (
    "The catalog lists no public RPC for this chain, so there is nothing to stream."
  ) : down ? (
    <>
      {heads.length ? "The chain's RPC stopped answering; these are the last blocks it sent." : "The chain's RPC is not answering."}{" "}
      <button type="button" onClick={() => setDown(false)} className="font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]">
        Retry
      </button>
    </>
  ) : null;
  const txNote = down
    ? null
    : stuck
      ? "The chain's RPC sends its blocks but not their receipts, so the transactions cannot be read."
      : heads.length > 0 && !txsInHeads && txs.length === 0
        ? `No transactions in the last ${heads.length} ${heads.length === 1 ? "block" : "blocks"}.`
        : null;

  // connecting, or waiting on a slow RPC: the dot breathes
  const waitingNow = Boolean(rpc) && !down && !answering && heads.length === 0;
  const statusLine = <StatusLine label={status} state={status === "Live" ? "live" : waitingNow ? "waiting" : "still"} />;
  // a figure shimmers until its value lands, then the value fades in once
  const figure = (label: string, value: ReactNode, pending: boolean) => (
    <div className="flex min-w-0 flex-col gap-0.5 bg-white px-3 py-2 dark:bg-zinc-950">
      <dt className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="truncate font-mono text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {pending ? <Shimmer className="my-[5px] h-3.5 w-24" /> : <span className="animate-[bh-fade_300ms_ease-out]">{value}</span>}
      </dd>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* a div, not a <header>: the site styles header elements for its navbar, and that padding would push the name in */}
      <div className={cn("shrink-0 px-4 pb-4", compact ? "pt-0" : "pt-3.5")}>
        {compact ? (
          statusLine
        ) : (
          <div className="flex items-center gap-3">
            <ChainLogo uri={chain.logo} name={chain.name} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">{chain.name}</h3>
              <div className="mt-1">{statusLine}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the live view"
              title="Close the live view"
              className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          {figure("Height", height === null ? "—" : formatNumber(height), loading)}
          {figure(
            "Throughput",
            <>
              {rate.value}
              {rate.unit && <span className="ml-1 text-[11px] font-normal text-zinc-400 dark:text-zinc-500">{rate.unit}</span>}
            </>,
            rateLoading,
          )}
        </dl>
      </div>

      {feedNote && <Note>{feedNote}</Note>}

      {rpc && (blocks.length > 0 || !down) && (
        <section className="shrink-0 pb-4">
          <Heading label="Blocks" aside={!down && gapMs ? `avg ${gapOf(gapMs)}` : undefined} />
          <BlockStrip blocks={blocks} base={base} loading={!down && heads.length === 0} onHold={setHoldBlocks} />
        </section>
      )}

      {rpc && (txs.length > 0 || !down) ? (
        <section className="flex min-h-0 flex-1 flex-col">
          <Heading label="Transactions" />
          {txNote && <Note>{txNote}</Note>}
          <TxList txs={txs} chainId={chainId} symbol={symbol} base={base} loading={!down && !stuck && (heads.length === 0 || txsInHeads)} />
        </section>
      ) : (
        <div className="flex-1" />
      )}

      {base && !compact && (
        <Link
          href={base}
          className="flex shrink-0 items-center justify-between border-t border-zinc-200/80 px-4 py-2.5 font-mono text-[11.5px] text-[#0061E2] transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-[#5f9dff] dark:hover:bg-zinc-900"
        >
          Explorer
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
