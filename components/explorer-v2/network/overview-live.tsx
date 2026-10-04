"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, SectionHeader, HEAD, ROW, INK, MUTED, RowSkeleton, RowDoor, idInk, fnInk } from "@/components/explorer-v2/ui";
import { ageShort, truncate } from "@/components/explorer-v2/format";
import { Belt, GasBar, Height, MotionRow, Party, fmtAmount } from "@/components/explorer-v2/evm/LiveBoards";
import { useTicker } from "./ticker";
import { methodLabel } from "@/components/explorer-v2/evm/bits";
import { getFunctionBySelector } from "@/abi/event-signatures.generated";
import { useSignatures } from "@/lib/token-list";
import { hasRealChainLogo } from "@/lib/pchain-explorer";
import { readJson, recall } from "@/components/explorer-v2/page-data";
import { SOFT_READ, isOk, statusOf } from "@/lib/explorer-soft-status";
import { RATE_WINDOW_MS, chainClock, coverRates, extendCover, type Cover } from "./throughput";
import { blocksFeed, type LiveChain } from "./network-reads";
import type { NewBlock, NewBlocks, NewestTx } from "@/app/api/explorer/[chainId]/new-blocks";

/* The splash's live boards: the C-Chain home's Latest Blocks and Latest
   Transactions, merged across the busiest chains. Every row wears the
   logo and name of the chain it came from and doors into that chain's
   own explorer.

   Feed: one read of each chain's RPC through the explorer route's
   blocksOnly diet (new-blocks.ts): the new block headers, and the newest
   few of their transactions with each one's status. So both boards are as
   current as the chains' RPCs; the indexer trails the chains by 8 to 22 s.
   A chain that returns no new block backs off to one poll in four sweeps.
   Each chain's rows go up as its read lands, and a chain whose read is
   still out sits the next sweep out, so a slow chain holds back only its
   own rows. Polls stop while the tab is hidden, and a chain that fails
   three times drops out silently. */

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

interface LiveTx extends Omit<NewestTx, "timestampMs"> {
  chain: LiveChain;
  /** epoch ms, the merge order across chains */
  at: number;
}

const POLL_MS = 5_000;
/* a chain with no new block waits up to this many sweeps */
const MAX_BACKOFF = 4;
const MAX_FAILURES = 3;
/* rows each chain may add per sweep, so the fastest chain cannot take
   the whole board: the opening frame gets a few more */
const OPEN_PER_CHAIN = 3;
/* the opening frame's longest wait for half the chains to answer */
const OPEN_WAIT_MS = 1_500;
const SWEEP_PER_CHAIN = 2;
const KEEP = 40;
const ROWS = 10;

const toNum = (v: string | number) => Number(String(v).replace(/,/g, ""));

function toLiveBlocks(chain: LiveChain, blocks: NewBlock[]): LiveBlock[] {
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

function toLiveTxs(chain: LiveChain, txs: NewestTx[]): LiveTx[] {
  return txs.map(({ timestampMs, ...t }) => ({ ...t, chain, at: timestampMs }));
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
const txNewer = (a: LiveTx, b: LiveTx) => b.at - a.at || b.blockNumber - a.blockNumber || b.txIndex - a.txIndex;

/* The boards a visit leaves behind: the overview opened again within
   MEMORY_MS (the back button from a chain) starts from them, and asks each
   chain only for what came after. */
const MEMORY_MS = 30_000;
let left: { blocks: LiveBlock[]; txs: LiveTx[]; at: number } | null = null;
const recallBoards = () => (left && Date.now() - left.at < MEMORY_MS ? left : null);

/* The boards a hovered link's reads hold (the page memory): the overview
   opens on them as on the boards a visit left, once half the chains are
   there, the first sweep's own rule */
function warmBoards(chains: LiveChain[]): { blocks: LiveBlock[]; txs: LiveTx[] } | null {
  const reads = chains.map((c) => ({ c, ...recall<NewBlocks>(blocksFeed(c.chainId), true)?.data }));
  if (!chains.length || reads.filter((r) => r.blocks).length * 2 < chains.length) return null;
  return {
    blocks: sample(reads.flatMap((r) => toLiveBlocks(r.c, r.blocks ?? [])), OPEN_PER_CHAIN, blockNewer),
    txs: sample(reads.flatMap((r) => toLiveTxs(r.c, r.txs ?? [])), OPEN_PER_CHAIN, txNewer),
  };
}

/* A feed's read. The first sweep's opening read goes through the page
   memory, so a hovered link's read (in flight, or a moment old) stands in
   for it; the polls read afresh. */
async function readFeed<T>(url: string, viaMemory: boolean): Promise<T> {
  if (viaMemory) {
    const data = await readJson<T>(url);
    if (data == null) throw new Error("no answer");
    return data;
  }
  const res = await fetch(url, { ...SOFT_READ, signal: AbortSignal.timeout(POLL_MS * 2) });
  if (!isOk(res)) throw new Error(`HTTP ${statusOf(res)}`);
  return (await res.json()) as T;
}

function useNetworkLive(chains: LiveChain[], onRates?: (rates: Map<string, number>) => void) {
  const [opening] = useState(() => recallBoards() ?? warmBoards(chains));
  const [blocks, setBlocks] = useState<LiveBlock[]>(opening?.blocks ?? []);
  const [txs, setTxs] = useState<LiveTx[]>(opening?.txs ?? []);
  const [settled, setSettled] = useState(!!opening);

  useEffect(() => {
    if (blocks.length || txs.length) left = { blocks, txs, at: Date.now() };
  }, [blocks, txs]);

  useEffect(() => {
    if (chains.length === 0) return;
    let cancelled = false;
    let sweepN = 0;
    // the chains whose reads are still out
    const busy = new Set<string>();
    const lastBlock = new Map<string, number>();
    const nextSweep = new Map<string, number>();
    const idle = new Map<string, number>();
    const failures = new Map<string, number>();
    // from the boards left behind: each chain is asked for what came after
    const was = recallBoards();
    for (const b of was?.blocks ?? []) lastBlock.set(b.chain.chainId, Math.max(lastBlock.get(b.chain.chainId) ?? 0, b.height));
    // every fresh block feeds its chain's run, so the reading is real
    // throughput, not what the board chooses to show
    const covers = new Map<string, Cover>();
    let lastRates = new Map<string, number>();

    const reportRates = () => {
      if (!onRates) return;
      const now = chainClock(covers, Date.now());
      const rates = coverRates(covers, now);
      // a chain whose read is still out keeps its last rate: its run waits
      // for the read, the chain did not go quiet
      for (const id of busy) {
        const was = lastRates.get(id);
        if (was === undefined) rates.delete(id);
        else rates.set(id, was);
      }
      lastRates = rates;
      onRates(rates);
      for (const c of covers.values()) c.blocks = c.blocks.filter((b) => b.at >= now - RATE_WINDOW_MS);
    };

    // a chain's new blocks and their newest transactions, in one read
    async function readChain(chain: LiveChain, first: boolean): Promise<{ b: LiveBlock[]; t: LiveTx[] }> {
      const id = chain.chainId;
      const none = { b: [], t: [] };
      if ((failures.get(id) ?? 0) >= MAX_FAILURES) return none;
      if (!first && (nextSweep.get(id) ?? 0) > sweepN) return none;
      const last = lastBlock.get(id);
      // the backoff counts from the sweep that asked: sweeps go on while a read is out
      const asked = sweepN;
      try {
        const data = await readFeed<NewBlocks>(blocksFeed(id, last), first && !last);
        const fresh = toLiveBlocks(chain, data.blocks ?? []);
        // three failures in a row drop a chain, not three in a session
        failures.set(id, 0);
        if (fresh.length > 0) {
          const run = extendCover(covers.get(id), fresh, lastBlock.get(id));
          if (run) covers.set(id, run);
          lastBlock.set(id, Math.max(...fresh.map((b) => b.height)));
          idle.set(id, 0);
          nextSweep.set(id, asked + 1);
        } else {
          const n = Math.min(MAX_BACKOFF, (idle.get(id) ?? 0) + 1);
          idle.set(id, n);
          nextSweep.set(id, asked + n);
        }
        // the read asks only for blocks after the last, so its transactions are new too
        return { b: fresh, t: toLiveTxs(chain, data.txs ?? []) };
      } catch {
        failures.set(id, (failures.get(id) ?? 0) + 1);
        // a missed poll breaks the run: the pulse rates the chain until a new run covers it
        covers.delete(id);
        return none;
      }
    }

    async function sweep(first: boolean) {
      if (!first && document.visibilityState === "hidden") return;
      sweepN += 1;
      const perChain = first ? OPEN_PER_CHAIN : SWEEP_PER_CHAIN;
      const publish = (freshBlocks: LiveBlock[], freshTxs: LiveTx[]) => {
        if (cancelled) return;
        if (freshBlocks.length > 0) {
          const add = sample(freshBlocks, perChain, blockNewer);
          setBlocks((prev) => [...add, ...prev].slice(0, KEEP));
        }
        if (freshTxs.length > 0) {
          const add = sample(freshTxs, perChain, txNewer);
          setTxs((prev) => [...add, ...prev].slice(0, KEEP));
        }
      };
      // the opening frame waits for half the chains (or OPEN_WAIT_MS), not
      // the slowest: it paints as one batch, and a chain that answers later
      // joins on its own, placed by the ticker
      const early: { b: LiveBlock[]; t: LiveTx[] }[] = [];
      let opened = !first;
      const open = () => {
        if (opened) return;
        opened = true;
        publish(early.flatMap((r) => r.b), early.flatMap((r) => r.t));
      };
      const wait = first ? setTimeout(open, OPEN_WAIT_MS) : undefined;
      await Promise.all(
        chains.map(async (chain) => {
          if (busy.has(chain.chainId)) return;
          busy.add(chain.chainId);
          const { b, t } = await readChain(chain, first);
          busy.delete(chain.chainId);
          if (opened) publish(b, t);
          else {
            early.push({ b, t });
            if (early.length * 2 >= chains.length) open();
          }
        }),
      );
      clearTimeout(wait);
      if (cancelled) return;
      // only the first sweep settles the boards: a later one can end at once,
      // every chain still busy with the first sweep's reads
      if (first) setSettled(true);
      reportRates();
      if (first) open();
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
  }, [chains, onRates]);

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

/* Both boards play the rows of each sweep over most of the sweep's
   interval, so a row enters about every second instead of a clump of rows
   and then a pause, and no row waits more than an interval and a half. The
   chains' reads land at different times in a sweep, so the queue keeps
   their rows in time order (`merged`). Every row goes in at the top: one
   older than the top row when it lands (a slow read's) is let go, not
   slotted in under it, so the board only ever moves down. */
function NetworkBlocksBoard({ blocks, loading }: { blocks: LiveBlock[]; loading: boolean }) {
  // the belt holds still under the pointer so a row can be clicked
  const [hover, setHover] = useState(false);
  const rows = useTicker(blocks, ROWS + 1, {
    key: (b) => b.hash,
    newer: blockNewer,
    paused: hover,
    every: POLL_MS,
    merged: true,
  });
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
  const rows = useTicker(txs, ROWS + 1, {
    key: (t) => t.hash,
    newer: txNewer,
    paused: hover,
    every: POLL_MS,
    merged: true,
  });
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
                        <Party addr={t.from} name={null} href={`${base}/address/${t.from}`} column />
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
                      <span className={cn(MUTED, "text-right max-md:hidden")}>{ageShort(t.at / 1000)}</span>
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

/** Both boards side by side, fed by one poller. Reports each chain's
 *  transactions a second off the block feed, once the feed covers enough
 *  of that chain (see throughput.ts). */
export function OverviewLiveBoards({
  chains,
  onRates,
}: {
  chains: LiveChain[];
  onRates?: (rates: Map<string, number>) => void;
}) {
  const { blocks, txs, settled } = useNetworkLive(chains, onRates);
  // every chain failed: the boards bow out rather than sit empty
  if (settled && blocks.length === 0 && txs.length === 0) return null;
  const loading = !settled;
  // a row enters about every second for as long as the page is open: with
  // reduced motion it fades in where it lands, and the rows below it step
  // down without sliding
  return (
    <MotionConfig reducedMotion="user">
      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <NetworkBlocksBoard blocks={blocks} loading={loading} />
        <NetworkTxsBoard txs={txs} loading={loading} />
      </div>
    </MotionConfig>
  );
}
