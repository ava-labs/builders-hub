"use client";

import { useEffect, useState } from "react";
import { SpecLine } from "@/components/explorer-v2/ui";
import { formatPricePerGas } from "@/components/explorer-v2/format";
import { executedBaseFee, splitPaid, type FeeBid, type PaidSplit, type TxFeeFacts } from "@/lib/evm-fee";
import { rpcBatch } from "./useHeadStream";

/* The fee lines of a transaction: the gas price it paid and how that splits
   into the base fee and the priority fee, then the caps it set. The split
   comes from the receipt's price. Since Helicon a block's header base fee
   is only the worst-case bound; the base fee charged is one value for the
   whole block, read back from a dynamic-fee tx in it when this tx does not
   fix it (a legacy tx, or one that paid its max fee). */

interface RpcBlockTx {
  hash: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

/** the dynamic-fee txs of the block that a receipt read can turn into its base fee */
const PROBES = 6;

/** the split of the paid price; the block's own base fee is read only when the tx leaves it open */
export function useFeeSplit(rpcUrl: string | undefined, blockNumber: number | undefined, facts: TxFeeFacts | null | undefined): PaidSplit | null {
  const own = facts && facts.bound !== null ? splitPaid(facts.bid, facts.paid, { bound: facts.bound, floor: facts.floor ?? facts.bound }) : null;
  const open = !!own && !own.exact;
  const [blockBase, setBlockBase] = useState<bigint | null>(null);

  useEffect(() => {
    setBlockBase(null);
    if (!open || !rpcUrl || blockNumber === undefined) return;
    const controller = new AbortController();
    (async () => {
      const [block] = await rpcBatch<{ transactions: RpcBlockTx[] }>(
        rpcUrl,
        [{ method: "eth_getBlockByNumber", params: [`0x${blockNumber.toString(16)}`, true] }],
        controller.signal,
      );
      // a tx whose max fee is above the bound plus its max priority fee surely paid
      // less than its max fee, so its receipt fixes the base fee: read those first
      const sure = (x: RpcBlockTx) => facts!.bound !== null && BigInt(x.maxFeePerGas!) > facts!.bound + BigInt(x.maxPriorityFeePerGas!);
      const dynamic = (block?.transactions ?? [])
        .filter((x) => x.maxFeePerGas && x.maxPriorityFeePerGas)
        .sort((x, y) => Number(sure(y)) - Number(sure(x)))
        .slice(0, PROBES);
      if (!dynamic.length) return;
      const receipts = await rpcBatch<{ effectiveGasPrice: string }>(
        rpcUrl,
        dynamic.map((x) => ({ method: "eth_getTransactionReceipt", params: [x.hash] })),
        controller.signal,
      );
      const base = executedBaseFee(
        dynamic.flatMap((x, i) => {
          const r = receipts[i];
          return r ? [{ bid: { maxFeePerGas: BigInt(x.maxFeePerGas!), maxPriorityFeePerGas: BigInt(x.maxPriorityFeePerGas!) }, paid: BigInt(r.effectiveGasPrice) }] : [];
        }),
      );
      if (!controller.signal.aborted && base !== null) setBlockBase(base);
    })().catch(() => {
      /* the bound stands, marked as a bound */
    });
    return () => controller.abort();
  }, [open, rpcUrl, blockNumber]);

  if (!facts || !own) return null;
  return open && blockBase !== null ? splitPaid(facts.bid, facts.paid, { bound: blockBase, floor: blockBase }) : own;
}

const isDynamic = (bid: FeeBid) => bid.maxFeePerGas !== undefined;

const QUIET = "font-mono text-[12px] font-normal text-zinc-400 dark:text-zinc-500";

/** the gas price paid, its two parts, and the caps of a dynamic-fee tx */
export function TxFeeLines({ facts, split, symbol, type }: { facts: TxFeeFacts; split: PaidSplit | null; symbol: string; type: number }) {
  // a price never breaks between its number and its unit
  const price = (v: bigint) => <span className="whitespace-nowrap">{formatPricePerGas(v, symbol)}</span>;
  // the block's bound reads only where it differs from the base fee charged
  const bound = split && facts.bound !== null && facts.bound !== split.base ? facts.bound : null;
  return (
    <>
      <SpecLine label="Gas Price">
        <span className="inline-flex flex-wrap items-baseline gap-x-3">
          <span className="font-mono">{price(facts.paid)}</span>
          {split && (
            <span className={QUIET}>
              base fee {split.exact ? "" : "at most "}
              {price(split.base)} + priority fee {split.exact ? "" : "at least "}
              {price(split.tip)}
              {bound !== null && <> · the block allowed up to {price(bound)}</>}
            </span>
          )}
        </span>
      </SpecLine>
      <SpecLine label="Fee Caps">
        {isDynamic(facts.bid) ? (
          <span className="inline-flex flex-wrap items-baseline gap-x-3">
            <span className="font-mono">
              max fee {price(facts.bid.maxFeePerGas!)} · max priority fee {price(facts.bid.maxPriorityFeePerGas!)}
            </span>
            <span className={QUIET}>the most it can pay per gas</span>
          </span>
        ) : (
          <span className={QUIET}>
            None. {type === 1 ? "An access-list" : "A legacy"} transaction pays one gas price.
            {facts.bound !== null && " The part above the base fee is the priority fee."}
          </span>
        )}
      </SpecLine>
    </>
  );
}
