"use client";

import { useEffect, useState } from "react";
import type { TxDetail } from "@/lib/evm-explorer";
import { rpcBatch } from "./useHeadStream";

/* A transaction straight from the RPC, shaped like the indexer's TxDetail.
   The indexer trails the chain by seconds to a minute and the receipts
   stream links to a tx the second it executes, so the tx page needs a
   source that is never behind. Internal calls need a trace the public
   node does not serve; they arrive with the indexer copy when it lands. */

interface RpcTx {
  hash: string;
  blockNumber: string | null;
  blockHash: string | null;
  transactionIndex: string | null;
  from: string;
  to: string | null;
  value: string;
  nonce: string;
  gas: string;
  gasPrice?: string;
  input: string;
  type?: string;
}

interface RpcReceipt {
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
  contractAddress: string | null;
  logs: { logIndex: string; address: string; topics: string[]; data: string }[];
}

const hex = (v: string | undefined | null): number => (v ? parseInt(v, 16) : 0);

/** the tx with its receipt and block time; null until it is executed */
async function fetchRpcTx(rpcUrl: string, hash: string, signal: AbortSignal): Promise<TxDetail | null> {
  const [tx, receipt] = await rpcBatch<RpcTx | RpcReceipt>(
    rpcUrl,
    [
      { method: "eth_getTransactionByHash", params: [hash] },
      { method: "eth_getTransactionReceipt", params: [hash] },
    ],
    signal,
  );
  const t = tx as RpcTx | null;
  const r = receipt as RpcReceipt | null;
  if (!t || !r || !t.blockNumber) return null;
  const [block] = await rpcBatch<{ timestamp: string }>(
    rpcUrl,
    [{ method: "eth_getBlockByNumber", params: [t.blockNumber, false] }],
    signal,
  );
  return {
    hash: t.hash,
    blockNumber: hex(t.blockNumber),
    blockHash: t.blockHash ?? "",
    timestamp: hex(block?.timestamp),
    txIndex: hex(t.transactionIndex),
    from: t.from,
    to: t.to ?? "",
    value: BigInt(t.value).toString(),
    nonce: hex(t.nonce),
    gasLimit: hex(t.gas),
    gasUsed: hex(r.gasUsed),
    gasPrice: BigInt(r.effectiveGasPrice).toString(),
    success: r.status === "0x1",
    type: hex(t.type),
    input: t.input,
    contractAddress: r.contractAddress ?? undefined,
    logs: r.logs.map((l) => ({ logIndex: hex(l.logIndex), address: l.address, topics: l.topics, data: l.data })),
    internalTxns: [],
  };
}

export function useRpcTx(
  rpcUrl: string | undefined,
  hash: string,
  /** how long to keep asking for a tx the node has not executed yet */
  waitMs = 20_000,
): { data: TxDetail | null; loading: boolean } {
  const [data, setData] = useState<TxDetail | null>(null);
  const [loading, setLoading] = useState(!!rpcUrl);

  useEffect(() => {
    setData(null);
    if (!rpcUrl || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const deadline = Date.now() + waitMs;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = async () => {
      try {
        const tx = await fetchRpcTx(rpcUrl, hash, AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]));
        if (controller.signal.aborted) return;
        if (tx) {
          setData(tx);
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
  }, [rpcUrl, hash, waitMs]);

  return { data, loading };
}
