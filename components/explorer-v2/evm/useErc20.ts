"use client";

import { useEffect, useState } from "react";
import { rpcBatch } from "./useHeadStream";
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
    const call = (data: string) => ({ method: "eth_call", params: [{ to: token, data }, "latest"] });
    rpcBatch<string>(rpcUrl, [call(SEL.name), call(SEL.symbol), call(SEL.decimals), call(SEL.totalSupply)], controller.signal)
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

/** native balance in wei; null while loading or without an RPC */
export function useNativeBalance(rpcUrl: string | undefined, address: string | undefined): bigint | null {
  const [wei, setWei] = useState<bigint | null>(null);
  useEffect(() => {
    setWei(null);
    if (!rpcUrl || !address) return;
    const controller = new AbortController();
    rpcBatch<string>(rpcUrl, [{ method: "eth_getBalance", params: [address, "latest"] }], controller.signal)
      .then(([hex]) => !controller.signal.aborted && setWei(decodeUint(hex)))
      .catch(() => {});
    return () => controller.abort();
  }, [rpcUrl, address]);
  return wei;
}

/** balanceOf(address) across a candidate token set, nonzero only; the
 *  key is the sorted set so a re-render with the same tokens costs nothing */
export function useTokenBalances(
  rpcUrl: string | undefined,
  address: string | undefined,
  tokens: string[],
): { balances: Map<string, bigint>; ready: boolean } {
  const key = [...new Set(tokens.map((t) => t.toLowerCase()))].sort().join(",");
  const [state, setState] = useState<{ key: string; balances: Map<string, bigint> }>({ key: "", balances: new Map() });
  useEffect(() => {
    if (!rpcUrl || !address || !key) return;
    const list = key.split(",");
    const controller = new AbortController();
    rpcBatch<string>(
      rpcUrl,
      list.map((t) => ({ method: "eth_call", params: [{ to: t, data: `${SEL.balanceOf}${pad(address)}` }, "latest"] })),
      controller.signal,
    )
      .then((out) => {
        if (controller.signal.aborted) return;
        const balances = new Map<string, bigint>();
        out.forEach((hex, i) => {
          const v = decodeUint(hex);
          if (v && v > 0n) balances.set(list[i], v);
        });
        setState({ key, balances });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [rpcUrl, address, key]);
  return { balances: state.key === key ? state.balances : new Map(), ready: state.key === key && key !== "" };
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
      { method: "eth_call", params: [{ to, data: SEL.symbol }, "latest"] },
      { method: "eth_call", params: [{ to, data: SEL.decimals }, "latest"] },
    ]);
    // the public RPC refuses big batches, so ask twenty calls at a time
    const chunks: (typeof calls)[] = [];
    for (let i = 0; i < calls.length; i += 20) chunks.push(calls.slice(i, i + 20));
    Promise.all(chunks.map((ch) => rpcBatch<string>(rpcUrl, ch, controller.signal)))
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
