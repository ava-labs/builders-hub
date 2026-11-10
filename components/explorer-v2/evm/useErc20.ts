"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rpcBatch } from "./useHeadStream";
import { ethBalanceCall, hasMulticall3, multicall3 } from "@/lib/explorer-rpc";
import { ERC20_TRANSFER_TOPIC, type Erc20TransferLog } from "@/lib/token-list";

/* ERC-20 and balance reads straight from the RPC: what a token IS
   (name, symbol, decimals, supply), what it has DONE lately (Transfer
   logs over the last few thousand blocks), and what an address HOLDS
   (native balance plus balanceOf across a candidate set). C-Chain only
   by the caller's gate; all reads are batched, one round trip each. */

const SEL = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
} as const;

const pad = (addr: string) => addr.slice(2).toLowerCase().padStart(64, "0");

/** eth_calls in request order, null where a call failed: one aggregate3
 *  per chunk where Multicall3 is deployed, a plain eth_call batch elsewhere */
function ethCalls(rpcUrl: string, calls: { to: string; data: string }[], signal: AbortSignal): Promise<(string | null)[]> {
  if (hasMulticall3(rpcUrl)) return multicall3(rpcUrl, calls, signal);
  return rpcBatch<string>(rpcUrl, calls.map((c) => ({ method: "eth_call", params: [c, "latest"] })), signal);
}

/** ABI-decode a single string return (dynamic offset + length + bytes) */
function decodeString(hex: string | null): string | null {
  if (!hex || hex.length < 130) return null;
  try {
    const len = parseInt(hex.slice(2 + 64, 2 + 128), 16);
    const bytes = hex.slice(2 + 128, 2 + 128 + len * 2);
    return decodeURIComponent(bytes.replace(/(..)/g, "%$1")).replace(/\0+$/, "");
  } catch {
    // some tokens return a bytes32 symbol instead of a string
    try {
      const bytes = hex.slice(2, 66).replace(/(00)+$/, "");
      return decodeURIComponent(bytes.replace(/(..)/g, "%$1"));
    } catch {
      return null;
    }
  }
}

const decodeUint = (hex: string | null): bigint | null => {
  if (!hex || hex === "0x") return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
};

export interface Erc20Meta {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: bigint | null;
  /** symbol() and decimals() both answered: this is a token */
  isToken: boolean;
}

/** name / symbol / decimals / totalSupply in one batch; null while loading */
export function useErc20Meta(rpcUrl: string | undefined, token: string | undefined): Erc20Meta | null {
  const [meta, setMeta] = useState<Erc20Meta | null>(null);
  useEffect(() => {
    setMeta(null);
    if (!rpcUrl || !token) return;
    const controller = new AbortController();
    const call = (data: string) => ({ to: token, data });
    ethCalls(rpcUrl, [call(SEL.name), call(SEL.symbol), call(SEL.decimals), call(SEL.totalSupply)], controller.signal)
      .then(([name, symbol, decimals, supply]) => {
        if (controller.signal.aborted) return;
        const dec = decodeUint(decimals);
        const sym = decodeString(symbol);
        setMeta({
          name: decodeString(name),
          symbol: sym,
          decimals: dec === null ? null : Number(dec),
          totalSupply: decodeUint(supply),
          isToken: sym !== null && dec !== null && Number(dec) <= 36,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMeta({ name: null, symbol: null, decimals: null, totalSupply: null, isToken: false });
      });
    return () => controller.abort();
  }, [rpcUrl, token]);
  return meta;
}

export interface TokenTransferRow extends Erc20TransferLog {
  txHash: string;
  blockNumber: number;
  timestamp: number | null;
}

/** the token's Transfer events over the last `span` blocks, newest first,
 *  with block timestamps; refreshes every `refreshMs` */
export function useTokenTransfers(
  rpcUrl: string | undefined,
  token: string | undefined,
  opts?: { span?: number; limit?: number; refreshMs?: number },
): { rows: TokenTransferRow[]; loading: boolean; span: number } {
  const span = opts?.span ?? 2_000;
  const limit = opts?.limit ?? 50;
  const refreshMs = opts?.refreshMs ?? 10_000;
  const [rows, setRows] = useState<TokenTransferRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRows([]);
    setLoading(true);
    if (!rpcUrl || !token) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
        const [tipHex] = await rpcBatch<string>(rpcUrl, [{ method: "eth_blockNumber", params: [] }], signal);
        const tip = tipHex ? parseInt(tipHex, 16) : 0;
        const [logs] = await rpcBatch<{ address: string; topics: string[]; data: string; logIndex: string; transactionHash: string; blockNumber: string }[]>(
          rpcUrl,
          [
            {
              method: "eth_getLogs",
              params: [{ fromBlock: `0x${Math.max(0, tip - span).toString(16)}`, toBlock: "latest", address: token, topics: [ERC20_TRANSFER_TOPIC] }],
            },
          ],
          signal,
        );
        const erc20 = (logs ?? []).filter((l) => l.topics.length === 3 && l.data.length >= 66);
        const recent = erc20.slice(-limit).reverse();
        const blocks = [...new Set(recent.map((l) => l.blockNumber))];
        const headers = blocks.length
          ? await rpcBatch<{ timestamp: string }>(rpcUrl, blocks.map((b) => ({ method: "eth_getBlockByNumber", params: [b, false] })), signal)
          : [];
        const tsByBlock = new Map(blocks.map((b, i) => [b, headers[i] ? parseInt(headers[i]!.timestamp, 16) : null]));
        if (controller.signal.aborted) return;
        setRows(
          recent.map((l) => ({
            token: l.address.toLowerCase(),
            from: `0x${l.topics[1].slice(26)}`,
            to: `0x${l.topics[2].slice(26)}`,
            amount: BigInt(l.data.slice(0, 66)),
            logIndex: parseInt(l.logIndex, 16),
            txHash: l.transactionHash,
            blockNumber: parseInt(l.blockNumber, 16),
            timestamp: tsByBlock.get(l.blockNumber) ?? null,
          })),
        );
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) setLoading(false);
      }
      if (!controller.signal.aborted) timer = setTimeout(load, refreshMs);
    };
    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [rpcUrl, token, span, limit, refreshMs]);

  return { rows, loading, span };
}

/* Where Multicall3 is deployed, the native balance waits this long for a
   token set to ride with, so the first read is one aggregate3 for both. */
const NATIVE_WAIT_MS = 1_000;

interface BalanceScan {
  scope: string;
  controller: AbortController;
  native: bigint | null;
  nativeAsked: boolean;
  /** tokens in flight or answered; a failed read leaves the set */
  asked: Set<string>;
  answered: Set<string>;
  balances: Map<string, bigint>;
  timer?: ReturnType<typeof setTimeout>;
}

const newScan = (scope: string): BalanceScan => ({
  scope,
  controller: new AbortController(),
  native: null,
  nativeAsked: false,
  asked: new Set(),
  answered: new Set(),
  balances: new Map(),
});

/** An address's native balance in wei (null while loading) and its nonzero
 *  balanceOf across a candidate token set. When the set grows, only the new
 *  tokens are read. On the C-Chain and Fuji the native balance and the
 *  tokens go through Multicall3 together. */
export function useAddressBalances(
  rpcUrl: string | undefined,
  address: string | undefined,
  tokens: string[],
): { nativeWei: bigint | null; balances: Map<string, bigint>; ready: boolean } {
  const key = [...new Set(tokens.map((t) => t.toLowerCase()))].sort().join(",");
  const scope = rpcUrl && address ? `${rpcUrl}|${address.toLowerCase()}` : "";
  const scan = useRef<BalanceScan>(newScan(""));
  const [version, setVersion] = useState(0);

  // a new address or RPC starts a new scan; the old one's reads are dropped
  useEffect(() => {
    const s = newScan(scope);
    scan.current = s;
    setVersion((v) => v + 1);
    if (scope && !hasMulticall3(rpcUrl)) {
      s.nativeAsked = true;
      rpcBatch<string>(rpcUrl!, [{ method: "eth_getBalance", params: [address, "latest"] }], s.controller.signal)
        .then(([hex]) => {
          if (s.controller.signal.aborted) return;
          s.native = decodeUint(hex);
          setVersion((v) => v + 1);
        })
        .catch(() => {});
    }
    return () => {
      s.controller.abort();
      if (s.timer) clearTimeout(s.timer);
    };
  }, [scope, rpcUrl, address]);

  useEffect(() => {
    const s = scan.current;
    if (!scope || s.scope !== scope || !rpcUrl || !address) return;
    const todo = key ? key.split(",").filter((t) => !s.asked.has(t)) : [];
    const mc = hasMulticall3(rpcUrl);
    const withNative = mc && !s.nativeAsked;
    if (!todo.length && !withNative) return;

    const read = () => {
      if (s.controller.signal.aborted) return;
      if (s.timer) clearTimeout(s.timer);
      s.timer = undefined;
      const native = mc && !s.nativeAsked;
      if (native) s.nativeAsked = true;
      const list = [...todo.filter((t) => !s.asked.has(t))];
      list.forEach((t) => s.asked.add(t));
      const calls = list.map((t) => ({ to: t, data: `${SEL.balanceOf}${pad(address)}` }));
      if (native) calls.unshift(ethBalanceCall(address));
      if (!calls.length) return;
      ethCalls(rpcUrl, calls, s.controller.signal)
        .then((out) => {
          if (s.controller.signal.aborted) return;
          const tokenOut = native ? out.slice(1) : out;
          if (native) s.native = decodeUint(out[0]);
          tokenOut.forEach((hex, i) => {
            const v = decodeUint(hex);
            if (v && v > 0n) s.balances.set(list[i], v);
            s.answered.add(list[i]);
          });
          setVersion((v) => v + 1);
        })
        .catch(() => {
          if (native) s.nativeAsked = false;
          list.forEach((t) => s.asked.delete(t));
        });
    };

    // no tokens yet: give the candidate set a moment so the native balance rides with it
    if (!todo.length) {
      if (!s.timer) s.timer = setTimeout(read, NATIVE_WAIT_MS);
      return;
    }
    read();
  }, [scope, rpcUrl, address, key]);

  const current = scan.current.scope === scope ? scan.current : null;
  const balances = useMemo(() => {
    const out = new Map<string, bigint>();
    if (!current || !key) return out;
    for (const t of key.split(",")) {
      const v = current.balances.get(t);
      if (v !== undefined) out.set(t, v);
    }
    return out;
    // version marks a new answer in the scan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, key, version]);
  const ready = !!current && key !== "" && key.split(",").every((t) => current.answered.has(t));
  return { nativeWei: current?.native ?? null, balances, ready };
}

/** symbol and decimals for tokens the list does not carry, one batch per
 *  new set; a token that does not answer both stays out of the map */
export function useUnlistedTokenMeta(rpcUrl: string | undefined, addrs: string[]): Map<string, { symbol: string; decimals: number }> {
  const [meta, setMeta] = useState<Map<string, { symbol: string; decimals: number }>>(new Map());
  const key = [...new Set(addrs.map((a) => a.toLowerCase()))].sort().join(",");
  useEffect(() => {
    if (!rpcUrl || !key) return;
    const todo = key.split(",").filter((a) => !meta.has(a));
    if (!todo.length) return;
    const controller = new AbortController();
    const calls = todo.flatMap((to) => [
      { to, data: SEL.symbol },
      { to, data: SEL.decimals },
    ]);
    // the public RPC refuses big batches, so ask twenty calls at a time;
    // where Multicall3 is deployed the whole set is one aggregate3 per hundred calls
    const chunks: (typeof calls)[] = [];
    if (hasMulticall3(rpcUrl)) chunks.push(calls);
    else for (let i = 0; i < calls.length; i += 20) chunks.push(calls.slice(i, i + 20));
    Promise.all(chunks.map((ch) => ethCalls(rpcUrl, ch, controller.signal)))
      .then((parts) => parts.flat())
      .then((out) => {
        if (controller.signal.aborted) return;
        setMeta((m) => {
          const next = new Map(m);
          todo.forEach((a, i) => {
            const symbol = decodeString(out[2 * i]);
            const dec = decodeUint(out[2 * i + 1]);
            if (symbol && dec !== null && dec <= 36n) next.set(a, { symbol, decimals: Number(dec) });
          });
          return next;
        });
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpcUrl, key]);
  return meta;
}
