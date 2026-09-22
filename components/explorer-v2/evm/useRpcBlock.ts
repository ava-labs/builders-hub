"use client";

import { useEffect, useState } from "react";
import type { BlockDetail, TxSummary } from "@/lib/evm-explorer";
import { rpcBatch } from "./useHeadStream";

/* A block straight from the RPC, shaped like the indexer's BlockDetail.
   The indexer trails the chain by seconds to a minute, and the live
   boards link to blocks the moment they are sealed, so the block page
   needs a source that is never behind. Polls briefly for a height that
   does not exist yet (the "next" link at the tip), then gives up. */

interface RpcBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  transactions: {
    hash: string;
    from: string;
    to: string | null;
    value: string;
    input: string;
    gas: string;
    transactionIndex: string;
  }[];
}

interface RpcReceipt {
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
}

const hex = (v: string | undefined | null): number => (v ? parseInt(v, 16) : 0);

async function fetchRpcBlock(rpcUrl: string, id: string, signal: AbortSignal): Promise<BlockDetail | null> {
  const byHash = /^0x[0-9a-fA-F]{64}$/.test(id);
  const call = byHash
    ? { method: "eth_getBlockByHash", params: [id, true] }
    : { method: "eth_getBlockByNumber", params: [`0x${Number(id).toString(16)}`, true] };
  const [block] = await rpcBatch<RpcBlock>(rpcUrl, [call], signal);
  if (!block) return null;
  const receipts = block.transactions.length
    ? await rpcBatch<RpcReceipt>(
        rpcUrl,
        block.transactions.map((t) => ({ method: "eth_getTransactionReceipt", params: [t.hash] })),
        signal,
      )
    : [];
  const number = hex(block.number);
  const timestamp = hex(block.timestamp);
  const transactions: TxSummary[] = block.transactions.map((t, i) => {
    const r = receipts[i];
    return {
      hash: t.hash,
      blockNumber: number,
      txIndex: hex(t.transactionIndex),
      from: t.from,
      to: t.to ?? "",
      value: BigInt(t.value).toString(),
      gasUsed: r ? hex(r.gasUsed) : hex(t.gas),
      success: r ? r.status === "0x1" : true,
      feeWei: r ? (BigInt(r.gasUsed) * BigInt(r.effectiveGasPrice)).toString() : undefined,
      timestamp,
      methodId: t.input && t.input.length >= 10 ? t.input.slice(0, 10).toLowerCase() : "",
    };
  });
  return {
    number,
    hash: block.hash,
    parentHash: block.parentHash,
    timestamp,
    miner: block.miner,
    gasUsed: hex(block.gasUsed),
    gasLimit: hex(block.gasLimit),
    baseFeePerGas: block.baseFeePerGas ? BigInt(block.baseFeePerGas).toString() : "0",
    txCount: transactions.length,
    transactions,
  };
}

export function useRpcBlock(
  rpcUrl: string | undefined,
  id: string,
  /** how long to keep asking for a height the node does not have yet */
  waitMs = 20_000,
): { data: BlockDetail | null; loading: boolean } {
  const [data, setData] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(!!rpcUrl);

  useEffect(() => {
    setData(null);
    if (!rpcUrl) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const deadline = Date.now() + waitMs;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = async () => {
      try {
        const block = await fetchRpcBlock(rpcUrl, id, AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]));
        if (controller.signal.aborted) return;
        if (block) {
          setData(block);
          setLoading(false);
          return;
        }
      } catch {
        /* retry below */
      }
      if (controller.signal.aborted) return;
      if (Date.now() < deadline) timer = setTimeout(attempt, 1_000);
      else setLoading(false);
    };
    void attempt();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [rpcUrl, id, waitMs]);

  return { data, loading };
}
