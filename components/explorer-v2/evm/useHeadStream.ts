"use client";

import { useEffect, useRef, useState } from "react";

/* Head stream: the chain tip read straight from the RPC, once a second.
   The indexer feed (stats-api) lands seconds behind the chain and the
   live boards refresh from it every five. Post ACP-226 the C-Chain seals
   blocks under a second apart, so the tape and latest-blocks board read
   the header itself and move as the chain does.

   Under Continuous Execution (ACP-194) consensus accepts a block, the
   executor runs it (a receipt exists from that moment, within the same
   second on the C-Chain), and a later header's `settledHeight` settles
   it after the delay τ. The stream observes all three: headers for
   acceptance, receipts for execution (`streamTxs`, `executedHeight`),
   the tip's settledHeight for settlement. */

/* Chains running Continuous Execution (ACP-194, Helicon): C-Chain on
   Mainnet and Fuji. The live RPC path (head stream, receipts feed,
   lifecycle track, block settlement lookup) is enabled for these only. */
export const CONTINUOUS_EXECUTION_CHAINS = new Set(["43114", "43113"]);

/** headers n..n+span in one batch (the public node caps batches well under 80) */
export async function fetchHeaderRange(
  rpcUrl: string,
  from: number,
  count: number,
  signal: AbortSignal,
): Promise<(Head | null)[]> {
  const out = await rpcBatch<RpcHeader>(
    rpcUrl,
    Array.from({ length: count }, (_, i) => ({ method: "eth_getBlockByNumber", params: [blockTag(from + i), false] })),
    signal,
  );
  return out.map((h) => (h ? toHead(h) : null));
}

/** true once every tx in the block has a receipt (an empty block counts) */
export async function isExecuted(rpcUrl: string, n: number, signal: AbortSignal): Promise<boolean | null> {
  const [block] = await rpcBatch<RpcHeader>(rpcUrl, [{ method: "eth_getBlockByNumber", params: [blockTag(n), false] }], signal);
  if (!block) return null;
  const hashes = block.transactions as string[];
  if (!hashes.length) return true;
  const [r] = await rpcBatch<RpcReceipt>(rpcUrl, [{ method: "eth_getTransactionReceipt", params: [hashes[0]] }], signal);
  return !!r;
}

export interface Head {
  number: number;
  hash: string;
  /** `timestampMilliseconds` (ACP-226) when the header carries it,
   *  else `timestamp * 1000` */
  timestampMs: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  /** ACP-194: the newest block whose execution this block settles;
   *  null on chains without Continuous Execution */
  settledHeight: number | null;
}

/** a transaction as it executes: the block's tx merged with its receipt */
export interface StreamTx {
  hash: string;
  blockNumber: number;
  txIndex: number;
  timestamp: number; // unix seconds
  from: string;
  to: string; // "" for contract creation
  value: string; // wei, decimal string
  methodId: string; // 4-byte selector, "" for plain transfers
  /** full calldata, so the boards can decode a token transfer's amount */
  input: string;
  success: boolean;
  feeWei: number;
}

export interface HeadStream {
  /** tip-first, capped at `keep` */
  heads: Head[];
  tip: Head | null;
  /** executed transactions, newest block first; empty until receipts land */
  streamTxs: StreamTx[];
  /** every block at or below this height has receipts (execution is FIFO) */
  executedHeight: number | null;
  /** an RPC answered within the last two poll intervals */
  live: boolean;
}

interface RpcHeader {
  number: string;
  hash: string;
  timestamp: string;
  timestampMilliseconds?: string;
  transactions: string[] | RpcTx[];
  gasUsed: string;
  gasLimit: string;
  settledHeight?: string;
}

interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  input: string;
  transactionIndex: string;
}

interface RpcReceipt {
  transactionHash: string;
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
}

const hex = (v: string | undefined | null): number | null => (v ? parseInt(v, 16) : null);

function toHead(h: RpcHeader): Head {
  const ms = hex(h.timestampMilliseconds);
  return {
    number: hex(h.number) ?? 0,
    hash: h.hash,
    timestampMs: ms ?? (hex(h.timestamp) ?? 0) * 1000,
    txCount: h.transactions?.length ?? 0,
    gasUsed: hex(h.gasUsed) ?? 0,
    gasLimit: hex(h.gasLimit) ?? 0,
    settledHeight: hex(h.settledHeight),
  };
}

/* one JSON-RPC batch, results returned in request order */
export async function rpcBatch<T>(
  rpcUrl: string,
  calls: { method: string; params: unknown[] }[],
  signal: AbortSignal,
): Promise<(T | null)[]> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const out = (await res.json()) as { id: number; result?: T | null }[];
  const byId = new Map(out.map((r) => [r.id, r.result ?? null]));
  return calls.map((_, id) => byId.get(id) ?? null);
}

const blockTag = (n: number) => `0x${n.toString(16)}`;

/** a block's transactions merged with their receipts; null while any
 *  receipt is still missing, which means the executor has not reached
 *  the block yet (or this node lags its peers) */
async function fetchExecutedTxs(rpcUrl: string, n: number, signal: AbortSignal): Promise<StreamTx[] | null> {
  const [block] = await rpcBatch<RpcHeader>(rpcUrl, [{ method: "eth_getBlockByNumber", params: [blockTag(n), true] }], signal);
  if (!block) return null;
  const txs = (block.transactions as RpcTx[]).filter((t) => typeof t === "object");
  if (!txs.length) return [];
  const receipts = await rpcBatch<RpcReceipt>(
    rpcUrl,
    txs.map((t) => ({ method: "eth_getTransactionReceipt", params: [t.hash] })),
    signal,
  );
  if (receipts.some((r) => !r)) return null;
  const ts = hex(block.timestamp) ?? 0;
  return txs.map((t, i) => {
    const r = receipts[i]!;
    return {
      hash: t.hash,
      blockNumber: n,
      txIndex: hex(t.transactionIndex) ?? 0,
      timestamp: ts,
      from: t.from,
      to: t.to ?? "",
      value: BigInt(t.value).toString(),
      methodId: t.input && t.input.length >= 10 ? t.input.slice(0, 10).toLowerCase() : "",
      input: t.input ?? "0x",
      success: r.status === "0x1",
      feeWei: Number(BigInt(r.gasUsed) * BigInt(r.effectiveGasPrice)),
    };
  });
}

const EMPTY: HeadStream = { heads: [], tip: null, streamTxs: [], executedHeight: null, live: false };

export function useHeadStream(
  rpcUrl: string | undefined,
  opts?: {
    /** poll period; the C-Chain seals blocks about this often */
    intervalMs?: number;
    /** how many heads to retain for cadence math and the tape */
    keep?: number;
    /** heads to backfill on first contact so the tape opens full */
    seed?: number;
    /** executed transactions to retain for the receipts feed */
    keepTxs?: number;
  },
): HeadStream {
  const intervalMs = opts?.intervalMs ?? 1_000;
  const keep = opts?.keep ?? 64;
  const seed = opts?.seed ?? 20;
  const keepTxs = opts?.keepTxs ?? 48;
  const [stream, setStream] = useState<HeadStream>(EMPTY);
  const headsRef = useRef<Head[]>([]);
  const txsRef = useRef<StreamTx[]>([]);
  // blocks whose receipts have been pulled; the feed never re-fetches
  const executedDone = useRef(new Set<number>());
  const executedHeightRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rpcUrl) {
      setStream(EMPTY);
      return;
    }
    headsRef.current = [];
    txsRef.current = [];
    executedDone.current = new Set();
    executedHeightRef.current = null;
    setStream(EMPTY);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastOk = 0;
    let inFlight = false;

    const signal = () => AbortSignal.any([controller.signal, AbortSignal.timeout(intervalMs * 4)]);

    const publish = () => {
      const heads = headsRef.current;
      setStream({
        heads,
        tip: heads[0] ?? null,
        streamTxs: txsRef.current,
        executedHeight: executedHeightRef.current,
        live: true,
      });
    };

    const mergeHeads = (incoming: Head[]) => {
      const byNumber = new Map<number, Head>();
      for (const h of headsRef.current) byNumber.set(h.number, h);
      for (const h of incoming) byNumber.set(h.number, h);
      headsRef.current = [...byNumber.values()].sort((a, b) => b.number - a.number).slice(0, keep);
    };

    /* Execution: every head not yet pulled gives up its receipts. A fresh
       page seeds from the three newest heads so the feed opens populated;
       after that the newest unseen heads go first, three per poll. A block
       whose receipts are not all there yet is left for the next poll. */
    const pullExecuted = async () => {
      // a caller that keeps no transactions (the blocks tab) skips the
      // receipts round trips entirely
      if (keepTxs === 0) return;
      // only the frontier matters: blocks beneath the executed height are
      // proven executed by FIFO order and need no receipts of their own
      const frontier = (executedHeightRef.current ?? headsRef.current[0]?.number ?? 0) - 2;
      const want = headsRef.current
        .filter((h) => h.number >= frontier && !executedDone.current.has(h.number))
        .slice(0, 3)
        .map((h) => h.number);
      if (!want.length) return;
      const results = await Promise.all(want.map((n) => fetchExecutedTxs(rpcUrl, n, signal())));
      const incoming: StreamTx[] = [];
      results.forEach((txs, i) => {
        if (txs === null) return;
        executedDone.current.add(want[i]);
        incoming.push(...txs);
      });
      // execution is FIFO: the newest block with receipts proves every
      // block beneath it executed, empty blocks included
      const top = Math.max(...executedDone.current);
      if (Number.isFinite(top)) executedHeightRef.current = top;
      if (!incoming.length) return;
      const seen = new Set(txsRef.current.map((t) => t.hash));
      const merged = [...incoming.filter((t) => !seen.has(t.hash)), ...txsRef.current];
      // newest execution first: block descending, then index ascending
      merged.sort((a, b) => b.blockNumber - a.blockNumber || a.txIndex - b.txIndex);
      txsRef.current = merged.slice(0, keepTxs);
      // heads older than the retained window need no bookkeeping
      const floor = headsRef.current[headsRef.current.length - 1]?.number ?? 0;
      for (const n of executedDone.current) if (n < floor) executedDone.current.delete(n);
    };

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [latest] = await rpcBatch<RpcHeader>(rpcUrl, [{ method: "eth_getBlockByNumber", params: ["latest", false] }], signal());
        if (latest) {
          const tip = toHead(latest);
          // keep the retained window contiguous: a fresh page backfills
          // `seed` heads; after that, any height still absent is asked for
          // again. The public RPC is load-balanced and a node one block
          // behind answers null for a height its peers already serve, so a
          // hole is not final until a later poll fills it.
          const have = new Set(headsRef.current.map((h) => h.number));
          const floor = have.size ? tip.number - keep + 1 : tip.number - seed + 1;
          const missing: number[] = [];
          for (let n = tip.number - 1; n >= floor && missing.length < 12; n--) {
            if (!have.has(n)) missing.push(n);
          }
          const filled = missing.length
            ? await rpcBatch<RpcHeader>(rpcUrl, missing.map((n) => ({ method: "eth_getBlockByNumber", params: [blockTag(n), false] })), signal())
            : [];
          mergeHeads([tip, ...filled.filter((h): h is RpcHeader => !!h).map(toHead)]);
          await pullExecuted();
          publish();
          lastOk = Date.now();
        }
      } catch {
        // the last heads stand; flag the stream stale after two misses
        if (Date.now() - lastOk > intervalMs * 2) setStream((s) => (s.live ? { ...s, live: false } : s));
      }
      inFlight = false;
      if (!controller.signal.aborted) schedule();
    };

    const schedule = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === "hidden") schedule();
        else void poll();
      }, intervalMs);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !controller.signal.aborted) {
        if (timer) clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void poll();

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
    };
  }, [rpcUrl, intervalMs, keep, seed, keepTxs]);

  return stream;
}

/* ------------------------------------------------------------------ */
/* Cadence: what the last minute of heads says about the chain's pace */

export interface Cadence {
  /** mean gap between consecutive blocks */
  intervalMs: number | null;
  blocksPerMin: number | null;
  tps: number | null;
  /** heads the figures were read from */
  n: number;
  /** the window actually spanned, ms */
  spanMs: number;
}

export function cadence(heads: Head[], windowMs = 60_000): Cadence {
  if (heads.length < 2) return { intervalMs: null, blocksPerMin: null, tps: null, n: heads.length, spanMs: 0 };
  const tip = heads[0].timestampMs;
  const inWindow = heads.filter((h) => tip - h.timestampMs <= windowMs);
  const window = inWindow.length >= 2 ? inWindow : heads.slice(0, 2);
  const spanMs = window[0].timestampMs - window[window.length - 1].timestampMs;
  if (spanMs <= 0) return { intervalMs: null, blocksPerMin: null, tps: null, n: window.length, spanMs: 0 };
  // the oldest head opens the span; its txs landed before it
  const txs = window.slice(0, -1).reduce((acc, h) => acc + h.txCount, 0);
  return {
    intervalMs: spanMs / (window.length - 1),
    blocksPerMin: ((window.length - 1) / spanMs) * 60_000,
    tps: (txs / spanMs) * 1000,
    n: window.length,
    spanMs,
  };
}
