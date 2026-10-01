"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { ChartBoard, HashChip } from "@/components/explorer-v2/ui";
import { ADDRESSES } from "@/lib/rwa/constants/addresses";
import { bigintToNumber } from "@/lib/rwa/utils";
import type { AllMetrics, FenceMetrics } from "@/lib/rwa/types";
import { usd } from "./palette";

/* The RWA view's pieces that each draw one payload: the pool's capital
   flow and the facility's figures. Every figure has one home on the
   page: the flow carries the lifetime amounts, the readouts above it the
   rates, the facility row what Fence reports. */

const EXACT_USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
/* "Oct 7, 2025": a start date, no weekday, so the board title fits a phone in two lines at most */
const START_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
/* the flow's rules and arrows: ink that holds 3:1 on the board in both themes */
const RULE = "bg-zinc-500 dark:bg-zinc-400";
const GLYPH = "text-zinc-500 dark:text-zinc-400";
const VERB = "font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";
const AMOUNT = "font-mono text-[15px] font-bold tabular-nums text-zinc-900 dark:text-zinc-50";

const addressPage = (a: string) => `/explorer/mainnet/c-chain/address/${a.toLowerCase()}`;

/** a dollar figure at the explorer's compact precision, the exact amount on hover */
export function Money({ value }: { value: number }) {
  return <span title={EXACT_USD.format(value)}>{usd(value)}</span>;
}

function FlowNode({ name, address, note }: { name: string; address?: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border border-zinc-200 bg-white/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-50">{name}</span>
      {address && <HashChip value={address} href={addressPage(address)} len={10} className="text-[11px]" />}
      {note && <span className="truncate font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">{note}</span>}
    </div>
  );
}

/** a forward step of the money: its amount over a rule, the verb under it; the rule runs down on a phone */
function FlowStep({ verb, value, className }: { verb: string; value: number | null; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-1 px-1", className)}>
      <span className={AMOUNT}>{value === null ? "…" : <Money value={value} />}</span>
      <span className="hidden w-full items-center lg:flex" aria-hidden>
        <span className={cn("h-px flex-1", RULE)} />
        <ArrowRight className={cn("-ml-1.5 h-3.5 w-3.5 shrink-0", GLYPH)} />
      </span>
      <ArrowDown className={cn("h-3.5 w-3.5 lg:hidden", GLYPH)} aria-hidden />
      <span className={VERB}>{verb}</span>
    </div>
  );
}

/** the way back: the borrower's repayments into the pool, under the two of them */
function ReturnStep({ verb, value, className }: { verb: string; value: number | null; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-1 px-1", className)}>
      <span className="hidden w-full items-center lg:flex" aria-hidden>
        <ArrowLeft className={cn("-mr-1.5 h-3.5 w-3.5 shrink-0", GLYPH)} />
        <span className={cn("h-px flex-1", RULE)} />
      </span>
      <ArrowUp className={cn("h-3.5 w-3.5 lg:hidden", GLYPH)} aria-hidden />
      <span className="flex items-baseline gap-2">
        <span className={VERB}>{verb}</span>
        <span className={AMOUNT}>{value === null ? "…" : <Money value={value} />}</span>
      </span>
    </div>
  );
}

const amountOf = (v: bigint | undefined) => (v === undefined ? null : bigintToNumber(v));

/** a section's one line when its feed failed before it read anything */
function Unavailable({ what }: { what: string }) {
  return <p className="py-10 text-center font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{what} are unavailable right now</p>;
}

/** the UTC day of Fence's latest reading; Fence sends no offset, so the day is read off the text, never through the browser's zone */
export function fenceAsOfDay(fence: FenceMetrics | null): string | null {
  const asOf = fence?.paidTotalCollections?.asOfDate ?? fence?.expectedTotalCollections?.asOfDate ?? fence?.cl01Concentration?.asOfDate;
  return asOf ? asOf.slice(0, 10) : null;
}

/** the pool's money to date: what lenders put in, what the pool financed, what came back and what the borrower converted */
export function CapitalFlow({ metrics, since, failed = false }: { metrics: AllMetrics | null; since: string | null; failed?: boolean }) {
  const g = metrics?.general;
  const lenders = metrics?.lenderBreakdown.map((l) => `${l.lender} ${l.percentage.toFixed(0)}%`).join(" · ");
  const age = g ? `${g.lifeSinceInception} days${since ? ` since ${START_DAY.format(new Date(`${since}T00:00:00Z`))}` : ""}` : null;
  return (
    <ChartBoard
      label="Capital Flow"
      action={<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{age ? `to date · ${age}` : "to date"}</span>}
    >
      {failed && !metrics ? (
        <Unavailable what="Pool figures" />
      ) : (
        <div className="grid grid-cols-1 items-center gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-y-4">
          <FlowNode name="Lenders" note={lenders ?? "…"} />
          <FlowStep verb="invested" value={amountOf(g?.committedCapital)} />
          <FlowNode name="Tranche Pool" address={ADDRESSES.TRANCHE_POOL} note={g ? `idle ${usd(bigintToNumber(g.idleCapital))}` : undefined} />
          <FlowStep verb="financed" value={amountOf(g?.assetsFinanced)} />
          <FlowNode name="Borrower" address={ADDRESSES.BORROWER_OPERATING} />
          <ReturnStep verb="repaid" value={amountOf(g?.lenderRepayments)} className="lg:col-start-3 lg:col-end-6 lg:row-start-2" />
          <FlowStep verb="converted" value={amountOf(metrics?.oatfi.convertedUsdc)} className="lg:col-start-6 lg:row-start-1" />
        </div>
      )}
    </ChartBoard>
  );
}

/** Fence's latest facility figures; a figure Fence did not send reads n/a */
export function FacilityFigures({ fence, failed }: { fence: FenceMetrics | null; failed: boolean }) {
  if (failed && !fence) return <Unavailable what="Facility figures" />;
  const read = <T,>(v: T | null | undefined, show: (v: T) => ReactNode) => (!fence ? null : v === null || v === undefined ? "n/a" : show(v));
  const cl01 = fence?.cl01Concentration ?? null;
  return (
    <ReadoutRow cols={4}>
      <Readout label="Paid Collections" value={read(fence?.paidTotalCollections, (c) => <Money value={c.value} />)} sub="collected to date" />
      <Readout label="Expected Collections" value={read(fence?.expectedTotalCollections, (c) => <Money value={c.value} />)} sub="due to date" />
      <Readout label="Repayment Ratio" value={read(fence?.repaymentRatio, (r) => `${(r * 100).toFixed(1)}%`)} sub="paid / expected" />
      <Readout
        label="Industry Concentration"
        value={read(cl01, (c) => `${(c.value * 100).toFixed(1)}%`)}
        sub={cl01 ? `top industry · limit ${(cl01.threshold * 100).toFixed(0)}% · ${cl01.withinLimit ? "within" : "over"}` : "share of the top industry"}
      />
    </ReadoutRow>
  );
}
