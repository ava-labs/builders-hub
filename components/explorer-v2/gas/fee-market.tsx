"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ACTIONS, baseFeeNow, cadenceOf, costOf, fillOf, tipStats } from "@/lib/fee-market";
import { formatDollars, formatPricePerGas, formatNumber, unitParts } from "@/components/explorer-v2/format";
import { formatFeeAmount } from "@/components/explorer-v2/evm/format";
import { FIGURE, FIG_UNIT, LABEL, ReadoutBlock, SUB } from "@/components/explorer-v2/evm/EvmOverviewStats";
import { LiveDot, SectionHeader } from "@/components/explorer-v2/ui";
import { MARKET_BLOCKS, useFeeMarket } from "./fee-market-data";

/* The fee market now, on a chain with Continuous Execution (the C-Chain):
   the base fee the newest block charged, the priority fee wallets add, what
   a tx costs, and how long it waits for a block, read off the RPC every
   two seconds. Then the cost of common actions, the priority fees txs paid,
   and how the fees work. Every figure comes from blocks, txs and receipts;
   the rules are in lib/fee-market.ts. */

/** a block that reserves this share of its gas limit is full: a pending tx can then wait, and the priority fee decides who goes first */
const FULL = 0.95;

function Cell({ label, value, unit, sub, href }: { label: string; value: string; unit?: string; sub?: ReactNode; href?: string }) {
  return (
    <ReadoutBlock href={href} className="items-start gap-3 px-5 pb-5 pt-3 md:px-6">
      <span className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5">
        <span className={LABEL}>{label}</span>
        <span className={FIGURE}>
          {value}
          {unit && <span className={FIG_UNIT}>{unit}</span>}
        </span>
        {sub && <span className={SUB}>{sub}</span>}
      </span>
    </ReadoutBlock>
  );
}

/** a heading's quiet tail; its figures keep their case (nAVAX) */
const SUFFIX = "font-normal normal-case tracking-[0.04em] text-zinc-400 dark:text-zinc-500";

const pct = (share: number) => `${share * 100 >= 10 ? (share * 100).toFixed(0) : (share * 100).toFixed(1)}%`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}`;

export function FeeMarketNow({
  rpcUrl,
  symbol,
  usd,
  usdSettled,
  base,
  aside,
}: {
  rpcUrl: string | undefined;
  symbol: string;
  usd: number | null;
  /** the price read has answered: a null usd then means the token has no price (Fuji) */
  usdSettled: boolean;
  base: string;
  /** under the priority fees, beside the cost table: the page's load readings */
  aside?: ReactNode;
}) {
  const feed = useFeeMarket(rpcUrl);
  const head = feed.blocks[0] ?? null;
  const fee = baseFeeNow(feed.blocks);
  const floor = head?.floor ?? null;
  const tip = feed.suggestedTip;
  const stats = tip !== null ? tipStats(feed.blocks, tip) : null;
  const fill = fillOf(feed.blocks);
  const cadence = cadenceOf(feed.blocks);
  const full = fill !== null && fill >= FULL;
  const price = fee && tip !== null ? fee.fee + tip : null;

  const unpriced = usd === null && usdSettled;
  const money = (gas: number) => {
    if (price === null) return { avax: "…", usd: "…" };
    const wei = costOf(gas, price);
    return { avax: formatFeeAmount(wei, symbol), usd: usd !== null ? formatDollars((Number(wei) / 1e18) * usd) : "…" };
  };
  const send = money(ACTIONS[0].gas);
  const baseParts = fee ? unitParts(formatPricePerGas(fee.fee, symbol)) : null;
  const tipParts = tip !== null ? unitParts(formatPricePerGas(tip, symbol)) : null;
  const sendParts = unitParts(unpriced ? send.avax : send.usd);
  const above = fee && floor !== null && fee.fee > floor ? Number(((fee.fee - floor) * 10_000n) / floor) / 100 : null;

  return (
    <section className="flex flex-col gap-5" aria-label="Fee market now">
      <SectionHeader
        label="Fee Market Now"
        action={
          <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {head && <LiveDot />}
            {head ? <span>block {formatNumber(head.number)}</span> : "reading the chain…"}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 pr-2 pt-2 lg:grid-cols-4">
        <Cell
          label="Base Fee"
          href={`${base}/gas/base-fee`}
          value={baseParts?.value ?? "…"}
          unit={baseParts?.unit}
          sub={floor === null || !fee ? "…" : above === null ? "at the minimum" : `${above.toFixed(2)}% over the minimum`}
        />
        <Cell
          label="Priority Fee"
          value={tipParts?.value ?? "…"}
          unit={tipParts?.unit}
          sub={full ? "blocks are full: a higher fee goes first" : "suggested"}
        />
        <Cell
          label={`Send ${symbol}`}
          value={sendParts.value}
          unit={sendParts.unit}
          sub={unpriced ? undefined : send.avax}
        />
        <Cell
          label="Next Block"
          value={cadence ? `~${seconds(cadence.waitMs)}` : "…"}
          unit={cadence ? "s" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ActionCosts money={money} symbol={symbol} price={price} priced={!unpriced} />
          <HowFeesWork floor={floor} symbol={symbol} target={head?.target ?? null} />
        </div>
        <div className="flex flex-col gap-6">
          <TipsPaid stats={stats} tip={tip} symbol={symbol} blocks={feed.blocks.length} />
          {aside}
        </div>
      </div>
    </section>
  );
}

function ActionCosts({
  money,
  symbol,
  price,
  priced,
}: {
  money: (gas: number) => { avax: string; usd: string };
  symbol: string;
  price: bigint | null;
  /** false when the token has no USD price: the column goes */
  priced: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className={LABEL}>
        Cost of an Action
        {price !== null && <span className={SUFFIX}> · at {formatPricePerGas(price, symbol)} per gas</span>}
      </p>
      <table className="w-full border-collapse font-mono text-[12px] tabular-nums" aria-label="Cost of an action">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            <th className="py-2 pr-3 font-medium">Action</th>
            <th className="py-2 pr-3 text-right font-medium">Gas</th>
            <th className="py-2 pr-3 text-right font-medium">Fee</th>
            {priced && <th className="py-2 text-right font-medium">USD</th>}
          </tr>
        </thead>
        <tbody>
          {ACTIONS.map((a, i) => {
            const m = money(a.gas);
            return (
              <tr key={a.label} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{i === 0 ? `Send ${symbol}` : a.label}</td>
                <td className="py-2 pr-3 text-right text-zinc-500 dark:text-zinc-400">{formatNumber(a.gas)}</td>
                <td className="py-2 pr-3 text-right text-zinc-900 dark:text-zinc-100">{m.avax}</td>
                {priced && <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{m.usd}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BANDS = [
  { key: "low", tone: "bg-zinc-300 dark:bg-zinc-700" },
  { key: "mid", tone: "bg-zinc-500 dark:bg-zinc-400" },
  { key: "high", tone: "bg-zinc-900 dark:bg-zinc-100" },
] as const;

function TipsPaid({ stats, tip, symbol, blocks }: { stats: ReturnType<typeof tipStats>; tip: bigint | null; symbol: string; blocks: number }) {
  const low = tip !== null ? formatPricePerGas(tip, symbol) : "the suggested fee";
  const names = { low: `${low} or less`, mid: `up to 1 n${symbol}`, high: `over 1 n${symbol}` };
  return (
    <div className="flex flex-col gap-3">
      <p className={LABEL}>
        Priority Fees Paid
        <span className={SUFFIX}>
          {" "}
          · {stats ? `${formatNumber(stats.txs)} transactions, ` : ""}last {blocks || MARKET_BLOCKS} blocks
        </span>
      </p>
      {stats ? (
        <div className="flex flex-col gap-3">
          <div className="flex h-3 w-full overflow-hidden" role="img" aria-label={`${pct(stats.low)} paid ${names.low}, ${pct(stats.mid)} paid ${names.mid}, ${pct(stats.high)} paid ${names.high}`}>
            {BANDS.map((b) => (stats[b.key] > 0 ? <span key={b.key} className={b.tone} style={{ width: `${stats[b.key] * 100}%` }} /> : null))}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">
            {BANDS.map((b) => (
              <li key={b.key} className="flex items-center gap-2">
                <span className={cn("size-2 shrink-0", b.tone)} aria-hidden />
                <span className="text-zinc-900 dark:text-zinc-100">{pct(stats[b.key])}</span>
                <span>{names[b.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex h-10 items-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Reading the newest blocks…</p>
      )}
    </div>
  );
}

function HowFeesWork({ floor, symbol, target }: { floor: bigint | null; symbol: string; target: number | null }) {
  return (
    <details className="group">
      <summary className={cn(LABEL, "flex w-fit cursor-pointer list-none items-center gap-2 hover:text-zinc-900 dark:hover:text-zinc-50 [&::-webkit-details-marker]:hidden")}>
        <span>How C-Chain Fees Work</span>
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <ul className="mt-3 flex max-w-2xl list-none flex-col gap-1 border-l-2 border-zinc-200 pl-4 text-[13px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <li>Gas price = base fee + priority fee. The chain burns both.</li>
        <li>
          The base fee goes up when gas use is above {target ? `${formatNumber(target / 1e6)}M gas per second` : "the target"}. Validators vote on its minimum
          {floor !== null && (
            <>
              , now <span className="whitespace-nowrap">{formatPricePerGas(floor, symbol)}</span>
            </>
          )}
          .
        </li>
        <li>A higher priority fee is faster only when blocks are full.</li>
        <li>A transaction pays for at least half its gas limit.</li>
      </ul>
    </details>
  );
}

/** the day the validators' minimum base fee reached 5 nAVAX on mainnet */
export const FLOOR_DAY = "2026-09-27";

/** under the base fee chart: why the line steps up in late September */
export function FloorNote() {
  return (
    <p className="px-1 font-mono text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
      Validators raised the minimum base fee to 5 nAVAX on Sep 27, 2026 (ACP-283).
    </p>
  );
}
