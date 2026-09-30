"use client";

import { useMemo } from "react";
import type { TxSummary } from "@/lib/evm-explorer";
import { decodeErc20Call, formatTokenAmount, type TokenInfo } from "@/lib/token-list";
import type { StreamTx } from "./useHeadStream";

/* The recent transactions of a chain, from two feeds as one window: the
   receipts stream (each row with its fee and a decoded token amount) and
   the indexer's page (seconds behind the chain, no fee). A hash both hold
   is the stream's row. A row keeps its object while its source does, so a
   ticker fed from here draws again only the rows that changed. */

/** one row, whichever feed it came from: the settlement stream carries
 *  its fee (receipt), the indexer fallback leaves it null and the board
 *  fetches receipts itself */
export interface TxRow {
  hash: string;
  blockNumber: number;
  /** the tx's place in its block: the order of a block's rows */
  txIndex: number;
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

/** negative when `a` is newer: the higher block, then the block's own order */
export const txNewer = (a: TxRow, b: TxRow) => b.blockNumber - a.blockNumber || a.txIndex - b.txIndex;

function fromStream(t: StreamTx, tokens: Map<string, TokenInfo>): TxRow {
  const tok = t.to ? tokens.get(t.to.toLowerCase()) : undefined;
  const call = tok ? decodeErc20Call(t.input) : null;
  return {
    hash: t.hash,
    blockNumber: t.blockNumber,
    txIndex: t.txIndex,
    from: t.from,
    to: t.to,
    value: t.value,
    methodId: t.methodId,
    success: t.success,
    feeWei: t.feeWei,
    tokenAmount: call && tok ? `${formatTokenAmount(call.amount, tok.decimals)} ${tok.symbol}` : null,
    timestamp: t.timestamp,
  };
}

function fromIndexer(t: TxSummary): TxRow {
  return {
    hash: t.hash,
    blockNumber: t.blockNumber,
    txIndex: t.txIndex,
    from: t.from,
    to: t.to,
    value: t.value,
    methodId: t.methodId ?? "",
    success: t.success,
    feeWei: null,
    timestamp: t.timestamp,
  };
}

/** the stream's rows and the indexer's as one list, newest first; with no
 *  stream it is the indexer's page as the indexer ordered it */
export function useTxWindow(stream: StreamTx[], indexed: TxSummary[], tokens: Map<string, TokenInfo>): TxRow[] {
  // a source object's row, made once: a token list that lands redraws them all
  const rowOf = useMemo(() => new WeakMap<object, TxRow>(), [tokens]);
  return useMemo(() => {
    const row = <S extends object>(src: S, make: (s: S) => TxRow) => {
      let r = rowOf.get(src);
      if (!r) rowOf.set(src, (r = make(src)));
      return r;
    };
    if (!stream.length) return indexed.map((t) => row(t, fromIndexer));
    const byHash = new Map<string, TxRow>();
    for (const t of stream) byHash.set(t.hash, row(t, (s) => fromStream(s, tokens)));
    for (const t of indexed) if (!byHash.has(t.hash)) byHash.set(t.hash, row(t, fromIndexer));
    return [...byHash.values()].sort(txNewer);
  }, [stream, indexed, tokens, rowOf]);
}
