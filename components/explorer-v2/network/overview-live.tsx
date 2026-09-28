"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader, HEAD, ROW, INK, MUTED, RowSkeleton, RowDoor, idInk, fnInk } from "@/components/explorer-v2/ui";
import { ageShort, truncate } from "@/components/explorer-v2/format";
import { Belt, GasBar, Height, MotionRow, Party, fmtAmount, useDrip } from "@/components/explorer-v2/evm/LiveBoards";
import { methodLabel } from "@/components/explorer-v2/evm/bits";
import { getFunctionBySelector } from "@/abi/event-signatures.generated";
import { useSignatures } from "@/lib/token-list";
import { hasRealChainLogo } from "@/lib/pchain-explorer";
import type { TxListResponse } from "@/lib/evm-explorer";

/* The splash's live boards: the C-Chain home's Latest Blocks and Latest
   Transactions, merged across the busiest chains. Every row wears the
   logo and name of the chain it came from and doors into that chain's
   own explorer.

   Feeds: blocks from each chain's RPC through the explorer route's
   blocksOnly diet (headers only), transactions from the indexer. A
   chain's transactions are only asked for when its block feed has seen a
   block with transactions the indexer has not yet returned, so a quiet
   chain costs nothing past its block poll. A chain that returns no new
   block backs off to one poll in four sweeps. Polls stop while the tab is
   hidden, and a chain that fails three times drops out silently. */

export interface LiveChain {
  /** EVM chain id, the API route key */
  chainId: string;
  slug: string;
  name: string;
  logo: string;
  symbol: string;
}

interface ApiBlock {
  number: string;
  timestamp: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  /** hex-parsed ms precision where the chain provides it (Avalanche does) */
  timestampMilliseconds?: number;
}

interface LiveBlock {
  /** chain and height: the drip's identity */
  hash: string;
  chain: LiveChain;
  height: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  /** epoch ms, the merge order across chains */
  at: number;
}

interface LiveTx {
  hash: string;
  chain: LiveChain;
  blockNumber: number;
  txIndex: number;
  from: string;
  to: string;
  value: string;
  methodId?: string;
  success: boolean;
  /** unix seconds */
  timestamp: number;
}

const POLL_MS = 5_000;
/* a chain with no new block waits up to this many sweeps */
const MAX_BACKOFF = 4;
const MAX_FAILURES = 3;
/* the indexer trails the RPC by seconds; give up on a block after this
   many sweeps without it */
const TX_LAG_SWEEPS = 3;
/* rows each chain may add per sweep, so the fastest chain cannot take
   the whole board: the opening frame gets a few more */
const OPEN_PER_CHAIN = 3;
const SWEEP_PER_CHAIN = 2;
const KEEP = 40;
const ROWS = 10;

/* the sliding window the live TPS reading is measured over */
const PULSE_WINDOW_MS = 75_000;
const PULSE_MIN_SPAN_S = 15;

const toNum = (v: string | number) => Number(String(v).replace(/,/g, ""));

function toLiveBlocks(chain: LiveChain, blocks: ApiBlock[]): LiveBlock[] {
  return blocks.flatMap((b) => {
    const height = toNum(b.number);
    const at = b.timestampMilliseconds ?? Date.parse(b.timestamp);
    if (!Number.isFinite(height) || !Number.isFinite(at)) return [];
    return [
      {
        hash: `${chain.chainId}-${height}`,
        chain,
        height,
        txCount: b.transactionCount ?? 0,
        gasUsed: toNum(b.gasUsed) || 0,
        gasLimit: toNum(b.gasLimit) || 0,
        at,
      },
    ];
  });
}

/* newest first, each chain limited to its share */
function sample<T extends { chain: LiveChain }>(rows: T[], perChain: number, newer: (a: T, b: T) => number): T[] {
  const counts = new Map<string, number>();
  return rows
    .slice()
    .sort(newer)
    .filter((r) => {
      const n = counts.get(r.chain.chainId) ?? 0;
      if (n >= perChain) return false;
      counts.set(r.chain.chainId, n + 1);
      return true;
    });
}

const blockNewer = (a: LiveBlock, b: LiveBlock) => b.at - a.at || b.height - a.height;
const txNewer = (a: LiveTx, b: LiveTx) =>
  b.timestamp - a.timestamp || b.blockNumber - a.blockNumber || b.txIndex - a.txIndex;

function useNetworkLive(chains: LiveChain[], onTps?: (tps: number | null) => void) {
  const [blocks, setBlocks] = useState<LiveBlock[]>([]);
  const [txs, setTxs] = useState<LiveTx[]>([]);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (chains.length === 0) return;
    let cancelled = false;
    let sweeping = false;
    let sweepN = 0;
    const lastBlock = new Map<string, number>();
    const nextSweep = new Map<string, number>();
    const idle = new Map<string, number>();
    const failures = new Map<string, number>();
    const txFailures = new Map<string, number>();
    // the newest tx-bearing block the RPC showed, and the newest the indexer returned
    const wantTx = new Map<string, number>();
    const haveTx = new Map<string, number>();
    const lag = new Map<string, number>();
    const seenTx = new Set<string>();
    // every fresh block feeds the pulse, so the reading is real
    // throughput, not what the board chooses to show
    const pulse: { at: number; txCount: number }[] = [];

    const reportTps = () => {
      if (!onTps) return;
      const cutoff = Date.now() - PULSE_WINDOW_MS;
      while (pulse.length > 0 && pulse[0].at < cutoff) pulse.shift();
      if (pulse.length < 2) return;
      const spanS = (pulse[pulse.length - 1].at - pulse[0].at) / 1000;
      if (spanS < PULSE_MIN_SPAN_S) return;
      onTps(pulse.reduce((sum, p) => sum + p.txCount, 0) / spanS);
    };

    async function pollBlocks(chain: LiveChain, first: boolean): Promise<LiveBlock[]> {
      const id = chain.chainId;
      if ((failures.get(id) ?? 0) >= MAX_FAILURES) return [];
      if (!first && (nextSweep.get(id) ?? 0) > sweepN) return [];
      const last = lastBlock.get(id);
      const query = last ? `blocksOnly=true&lastFetchedBlock=${last}` : "blocksOnly=true";
      try {
        const res = await fetch(`/api/explorer/${id}?${query}`, { signal: AbortSignal.timeout(POLL_MS * 2) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { blocks?: ApiBlock[] };
        const fresh = toLiveBlocks(chain, data.blocks ?? []);
        if (fresh.length > 0) {
          lastBlock.set(id, Math.max(...fresh.map((b) => b.height)));
          idle.set(id, 0);
          nextSweep.set(id, sweepN + 1);
          const withTxs = fresh.filter((b) => b.txCount > 0).map((b) => b.height);
          if (withTxs.length > 0) wantTx.set(id, Math.max(wantTx.get(id) ?? 0, ...withTxs));
        } else {
          const n = Math.min(MAX_BACKOFF, (idle.get(id) ?? 0) + 1);
          idle.set(id, n);
          nextSweep.set(id, sweepN + n);
        }
        return fresh;
      } catch {
        failures.set(id, (failures.get(id) ?? 0) + 1);
        return [];
      }
    }

    async function pollTxs(chain: LiveChain, first: boolean): Promise<LiveTx[]> {
      const id = chain.chainId;
      if ((txFailures.get(id) ?? 0) >= MAX_FAILURES) return [];
      const have = haveTx.get(id) ?? 0;
      if (!first && (wantTx.get(id) ?? 0) <= have) return [];
      try {
        // no-store: the proxy's stale-while-revalidate would otherwise make
        // the browser send each poll twice
        const res = await fetch(`/api/evm/${id}/txs?limit=${first ? 6 : 10}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(POLL_MS * 2),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TxListResponse;
        const fresh = (data.transactions ?? [])
          .filter((t) => !seenTx.has(t.hash))
          .map<LiveTx>((t) => ({
            hash: t.hash,
            chain,
            blockNumber: t.blockNumber,
            txIndex: t.txIndex,
            from: t.from,
            to: t.to,
            value: t.value,
            methodId: t.methodId,
            success: t.success,
            timestamp: t.timestamp,
          }));
        fresh.forEach((t) => seenTx.add(t.hash));
        const newest = Math.max(have, ...fresh.map((t) => t.blockNumber));
        haveTx.set(id, newest);
        // the indexer has not caught up to the block yet: ask again next
        // sweep, a few times at most
        const behind = (wantTx.get(id) ?? 0) > newest;
        const tries = behind ? (lag.get(id) ?? 0) + 1 : 0;
        lag.set(id, tries);
        if (tries >= TX_LAG_SWEEPS) {
          haveTx.set(id, wantTx.get(id) ?? newest);
          lag.set(id, 0);
        }
        return fresh;
      } catch {
        txFailures.set(id, (txFailures.get(id) ?? 0) + 1);
        return [];
      }
    }

    async function sweep(first: boolean) {
      if (sweeping) return; // a slow round still in flight: let it finish
      if (!first && document.visibilityState === "hidden") return;
      sweeping = true;
      sweepN += 1;
      const results = await Promise.all(
        chains.map(async (chain) => {
          const b = await pollBlocks(chain, first);
          const t = await pollTxs(chain, first);
          return { b, t };
        }),
      );
      sweeping = false;
      if (cancelled) return;
      setSettled(true);
      const freshBlocks = results.flatMap((r) => r.b);
      const freshTxs = results.flatMap((r) => r.t);
      pulse.push(...freshBlocks.map((b) => ({ at: b.at, txCount: b.txCount })));
      pulse.sort((a, b) => a.at - b.at);
      reportTps();
      const perChain = first ? OPEN_PER_CHAIN : SWEEP_PER_CHAIN;
      if (freshBlocks.length > 0) {
        const add = sample(freshBlocks, perChain, blockNewer);
        setBlocks((prev) => [...add, ...prev].slice(0, KEEP));
      }
      if (freshTxs.length > 0) {
        const add = sample(freshTxs, perChain, txNewer);
        setTxs((prev) => [...add, ...prev].slice(0, KEEP));
      }
    }

    // back in view: catch up at once rather than wait out the interval
    const onVisible = () => {
      if (document.visibilityState === "visible") void sweep(false);
    };
    void sweep(true);
    const poll = setInterval(() => void sweep(false), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [chains, onTps]);

  return { blocks, txs, settled };
}

/* ------------------------------------------------------------------ */

/* the network prefix is noise in a narrow column: "C-Chain", not
   "Avalanche C-Chain" */
function displayName(name: string): string {
  return name.replace(/^Avalanche\s+/i, "");
}

/** the chain a row came from: its round logo, else a letter tile */
function ChainMark({ chain }: { chain: LiveChain }) {
  const [broken, setBroken] = useState(false);
  const name = displayName(chain.name);
  const logo = !broken && chain.logo && hasRealChainLogo(chain.logo) ? chain.logo : null;
  let h = 0;
  for (let i = 0; i < chain.chainId.length; i++) h = (h * 31 + chain.chainId.charCodeAt(i)) % 360;
  return (
    <span className="flex min-w-0 items-center gap-2" title={chain.name}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" onError={() => setBroken(true)} className="h-3.5 w-3.5 shrink-0 rounded-full object-contain" />
      ) : (
        <span
          aria-hidden
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full font-mono text-[8px] font-bold text-white"
          style={{ backgroundColor: `hsl(${h} 40% 42%)` }}
        >
          {(name.trim().charAt(0) || "?").toUpperCase()}
        </span>
      )}
      <span className="truncate font-mono text-[12px] text-zinc-600 dark:text-zinc-300">{name}</span>
    </span>
  );
}

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

const chainBase = (c: LiveChain) => `/explorer/mainnet/${c.slug}`;

function NetworkBlocksBoard({ blocks, loading }: { blocks: LiveBlock[]; loading: boolean }) {
  // the belt holds still under the pointer so a row can be clicked
  const [hover, setHover] = useState(false);
  const rows = useDrip(blocks, ROWS + 1, true, undefined, hover);
  const cols = "md:grid-cols-[minmax(0,8rem)_6.5rem_2.5rem_minmax(0,1fr)_2.5rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Blocks" action={<ViewAll href="/explorer/mainnet/chains" />} />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
          <span>Chain</span>
          <span>Height</span>
          <span className="text-right">Txs</span>
          <span>Gas</span>
          <span className="text-right">Age</span>
        </div>
        {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
        <Belt>
          {rows.map((b, i) => (
            <MotionRow key={b.hash} animateIn overflow={i >= ROWS}>
              <Link href={`${chainBase(b.chain)}/block/${b.height}`} className={cn(ROW, cols)}>
                <ChainMark chain={b.chain} />
                <span className="max-md:text-right">
                  <Height value={b.height} />
                </span>
                <span className={cn(INK, "md:text-right")}>
                  {b.txCount}
                  <span className="text-zinc-400 md:hidden dark:text-zinc-500"> txs</span>
                </span>
                <span className="max-md:order-last max-md:col-span-2">
                  <GasBar used={b.gasUsed} limit={b.gasLimit} />
                </span>
                <span className={cn(MUTED, "text-right")}>{ageShort(b.at / 1000)}</span>
              </Link>
            </MotionRow>
          ))}
        </Belt>
      </Board>
    </section>
  );
}

/* the method, named without a per-chain ABI lookup: the classics, the
   generated registry, then the signature database */
function useMethodLabels(rows: LiveTx[]) {
  const local = (t: LiveTx): string | null => {
    const sel = t.methodId?.toLowerCase() ?? "";
    if (!sel) return null;
    const classic = methodLabel({ methodId: sel, to: t.to });
    return classic !== sel ? classic : (getFunctionBySelector(sel)?.name ?? null);
  };
  const unknown = rows.filter((t) => t.methodId && !local(t)).map((t) => t.methodId!.toLowerCase());
  const sigs = useSignatures(unknown, []);
  return (t: LiveTx) => {
    const sel = t.methodId?.toLowerCase() ?? "";
    if (!sel) return { label: t.to ? "transfer" : "create", named: true };
    const name = local(t) ?? sigs.fn.get(sel)?.name.split("(")[0] ?? null;
    return name ? { label: name, named: true } : { label: sel, named: false };
  };
}

function NetworkTxsBoard({ txs, loading }: { txs: LiveTx[]; loading: boolean }) {
  const [hover, setHover] = useState(false);
  const rows = useDrip(txs, ROWS + 1, true, undefined, hover);
  const method = useMethodLabels(rows);
  const cols =
    "md:grid-cols-[0.75rem_minmax(0,6.5rem)_6rem_minmax(0,6rem)_minmax(0,1fr)_minmax(0,6.5rem)_2.5rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="Latest Transactions" action={<ViewAll href="/explorer/mainnet/chains" />} />
      <Board divide={false} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {/* a tablet scrolls the ledger sideways; phones stack, desktops fit */}
        <div className="overflow-x-auto">
          <div className="md:min-w-[46rem] xl:min-w-0">
            <div className={cn(HEAD, cols, "border-b border-zinc-200 dark:border-zinc-800")}>
              <span />
              <span>Chain</span>
              <span>Hash</span>
              <span>Method</span>
              <span>From → To</span>
              <span className="text-right">Value</span>
              <span className="text-right">Age</span>
            </div>
            {loading && rows.length === 0 && <RowSkeleton n={ROWS} />}
            <Belt>
              {rows.map((t, i) => {
                const base = chainBase(t.chain);
                const m = method(t);
                const value = Number(t.value);
                return (
                  <MotionRow key={t.hash} animateIn overflow={i >= ROWS}>
                    <RowDoor href={`${base}/tx/${t.hash}`} className={cn(ROW, cols)}>
                      {/* status: a red X only when it reverted; on phones the chain takes its cell */}
                      <span className="flex h-3 w-3 items-center justify-center max-md:hidden">
                        {!t.success && <X className="h-3 w-3 text-[#E6212F]" strokeWidth={2.5} aria-label="reverted" />}
                      </span>
                      <ChainMark chain={t.chain} />
                      <Link
                        href={`${base}/tx/${t.hash}`}
                        className={cn(INK, idInk, "truncate hover:text-[#E6212F] max-md:text-right")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!t.success && <X className="mr-1 inline h-3 w-3 text-[#E6212F] md:hidden" strokeWidth={2.5} aria-label="reverted" />}
                        {truncate(t.hash, 6)}
                      </Link>
                      <span
                        className={cn("truncate font-mono text-[12px]", m.named ? fnInk : "text-zinc-400 dark:text-zinc-500")}
                        title={t.methodId || undefined}
                      >
                        {m.label}
                      </span>
                      <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-zinc-500 max-md:order-last max-md:col-span-2 dark:text-zinc-400">
                        <Party addr={t.from} name={null} href={`${base}/address/${t.from}`} />
                        <span className="shrink-0 text-zinc-300 dark:text-zinc-700">→</span>
                        {t.to ? (
                          <Party addr={t.to} name={null} href={`${base}/address/${t.to}`} />
                        ) : (
                          <span className="truncate">contract creation</span>
                        )}
                      </span>
                      <span className="min-w-0 truncate text-right font-mono text-[12.5px] tabular-nums">
                        {value > 0 ? (
                          <span className="text-zinc-900 dark:text-zinc-50">
                            {fmtAmount(value / 1e18)}{" "}
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{t.chain.symbol}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        )}
                      </span>
                      <span className={cn(MUTED, "text-right max-md:hidden")}>{ageShort(t.timestamp)}</span>
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

/** Both boards side by side, fed by one poller. Reports the live TPS it
 *  measures from the block feed; null until the window has enough span. */
export function OverviewLiveBoards({
  chains,
  onTps,
}: {
  chains: LiveChain[];
  onTps?: (tps: number | null) => void;
}) {
  const { blocks, txs, settled } = useNetworkLive(chains, onTps);
  // every chain failed: the boards bow out rather than sit empty
  if (settled && blocks.length === 0 && txs.length === 0) return null;
  const loading = !settled;
  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <NetworkBlocksBoard blocks={blocks} loading={loading} />
      <NetworkTxsBoard txs={txs} loading={loading} />
    </div>
  );
}
