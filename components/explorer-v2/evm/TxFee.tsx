"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber, formatPricePerGas } from "@/components/explorer-v2/format";
import { formatFeeAmount } from "./format";
import { executedBaseFee, feeAmounts, splitPaid, type FeeBid, type PaidSplit, type TxFeeFacts } from "@/lib/evm-fee";
import { rpcBatch } from "./useHeadStream";

/* The fee of a transaction, in its page's rail: the gas price it paid and
   how that splits into the base fee and the priority fee, then the caps it set. The split
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

const BASE_TONE = "bg-zinc-700 dark:bg-zinc-300";
const TIP_TONE = "bg-[#E6212F]";
const CELL = "whitespace-nowrap py-1 text-right";
/** a value inside the notes, in the table's tone: it is data, not a qualifier */
const DATA = "text-zinc-600 dark:text-zinc-300";

/** the Fee box's body: a bar of the gas price, then its base fee and priority
 *  fee per gas and for the gas charged, then the caps the tx set */
export function TxFeeBreakdown({
  facts,
  split,
  symbol,
  type,
  gas,
  note,
  href,
}: {
  facts: TxFeeFacts;
  split: PaidSplit | null;
  symbol: string;
  type: number;
  /** the gas charged: the fee is this times the gas price */
  gas: number;
  /** the fee in dollars, and where it went */
  note: string;
  href: string;
}) {
  const price = (v: bigint) => formatPricePerGas(v, symbol);
  const amounts = feeAmounts(split?.base ?? 0n, facts.paid, BigInt(gas));
  const parts = split
    ? [
        { label: "Base fee", mark: split.exact ? "" : "≤\u2009", perGas: split.base, total: amounts.base, tone: BASE_TONE },
        { label: "Priority fee", mark: split.exact ? "" : "≥\u2009", perGas: split.tip, total: amounts.tip, tone: TIP_TONE },
      ]
    : [];
  const share = (v: bigint) => (facts.paid > 0n ? Number((v * 10_000n) / facts.paid) / 100 : 0);
  // the block's bound reads only where it differs from the base fee charged
  const bound = split && facts.bound !== null && facts.bound !== split.base ? facts.bound : null;
  return (
    <div className="flex flex-col gap-3">
      {note && <span>{note}</span>}
      {split && (
        <span
          className="mt-1 flex h-1.5 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900"
          role="img"
          aria-label={`Gas price ${price(facts.paid)}: base fee ${parts[0].mark}${price(split.base)}, priority fee ${parts[1].mark}${price(split.tip)}`}
        >
          <span className={BASE_TONE} style={{ width: `${share(split.base)}%` }} />
          <span className={TIP_TONE} style={{ width: `${share(split.tip)}%` }} />
        </span>
      )}
      <table aria-label="Fee breakdown" className="w-full border-collapse text-[11px] tabular-nums tracking-normal">
        <thead>
          <tr className="text-[9px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            <th className="pb-1 text-left font-medium">
              <span className="sr-only">Part</span>
            </th>
            <th className="pb-1 pl-2 text-right font-medium">Per gas</th>
            <th className="whitespace-nowrap pb-1 pl-2 text-right font-medium">× {formatNumber(gas)} gas</th>
          </tr>
        </thead>
        <tbody className="text-zinc-600 dark:text-zinc-300">
          {parts.map((p) => (
            <tr key={p.label}>
              {/* the label may wrap, so a wide row still fits the rail */}
              <th scope="row" className="py-1 text-left font-normal leading-tight">
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 shrink-0", p.tone)} aria-hidden />
                  {p.label}
                </span>
              </th>
              <td className={cn(CELL, "pl-2")}>
                {p.mark}
                {price(p.perGas)}
              </td>
              <td className={cn(CELL, "pl-2")}>
                {p.mark}
                {formatFeeAmount(p.total, symbol, 8)}
              </td>
            </tr>
          ))}
          <tr className={cn("text-zinc-900 dark:text-zinc-50", parts.length > 0 && "border-t border-zinc-200 dark:border-zinc-800")}>
            <th scope="row" className="py-1 text-left font-medium">
              Gas price
            </th>
            <td className={cn(CELL, "pl-2")}>{price(facts.paid)}</td>
            <td className={cn(CELL, "pl-2")}>{formatFeeAmount(amounts.total, symbol, 8)}</td>
          </tr>
        </tbody>
      </table>
      <span className="flex flex-col gap-1 leading-relaxed text-zinc-500 dark:text-zinc-400">
        {isDynamic(facts.bid) ? (
          <span>
            Caps per gas: max fee <span className={DATA}>{price(facts.bid.maxFeePerGas!)}</span>, max priority fee{" "}
            <span className={DATA}>{price(facts.bid.maxPriorityFeePerGas!)}</span>.
          </span>
        ) : (
          <span>
            {type === 1 ? "An access-list" : "A legacy"} transaction pays one gas price.
            {facts.bound !== null && " The part above the base fee is the priority fee."}
          </span>
        )}
        {bound !== null && (
          <span>
            The block allowed a base fee up to <span className={DATA}>{price(bound)}</span>. It charged less.
          </span>
        )}
        {split && !split.exact && <span>≤ and ≥: the base fee is a range. The transactions read in this block do not give its exact value.</span>}
        <Link href={href} className="w-fit underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-50">
          The base fee now →
        </Link>
      </span>
    </div>
  );
}
