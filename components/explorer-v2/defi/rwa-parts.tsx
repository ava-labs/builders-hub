"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Readout, ReadoutRow } from "@/components/explorer-v2/Readout";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { cn } from "@/lib/utils";
import { bigintToNumber } from "@/lib/rwa/utils";
import type { AllMetrics, FenceMetrics, LineFacilityMetrics } from "@/lib/rwa/types";
import { usd } from "./palette";
import type { PartnerMark } from "./rwa-views";

/* The RWA view's figure sections, the old dashboard's cards in the
   explorer's readouts: OatFi's key metrics, its breakdown and Fence's
   facility figures, each with the definition its card's tooltip carried;
   a line of credit's key metrics under OatFi's labels, each defined by the
   line's events or its contract; and the partners' marks. */

const EXACT_USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/** a dollar figure at the explorer's compact precision, the exact amount on hover */
export function Money({ value }: { value: number }) {
  return <span title={EXACT_USD.format(value)}>{usd(value)}</span>;
}

/** a section's one line when its feed failed before it read anything */
export function Unavailable({ what }: { what: string }) {
  return <p className="py-10 text-center font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{what} are unavailable right now</p>;
}

/** the UTC day of Fence's latest reading; Fence sends no offset, so the day is read off the text, never through the browser's zone */
export function fenceAsOfDay(fence: FenceMetrics | null): string | null {
  const asOf = fence?.paidTotalCollections?.asOfDate ?? fence?.expectedTotalCollections?.asOfDate ?? fence?.cl01Concentration?.asOfDate;
  return asOf ? asOf.slice(0, 10) : null;
}

const dollars = (v: bigint) => <Money value={bigintToNumber(v)} />;
/** a definition under a figure; a narrow card cuts the line, so the whole text, or the old tooltip's, rides on hover */
const def = (text: string, full = text) => <span title={full}>{text}</span>;

/** a figure while it loads (null), after a failed read (n/a), or its value */
const figureOf = <T,>(source: T | undefined, failed: boolean, show: (s: T) => ReactNode) => (source !== undefined ? show(source) : failed ? "n/a" : null);

export function KeyMetrics({ metrics, failed }: { metrics: AllMetrics | null; failed: boolean }) {
  const g = metrics?.general;
  const lenders = metrics?.lenderBreakdown.map((l) => `${l.lender} ${l.percentage.toFixed(0)}%`).join(" · ");
  return (
    <section id="rwa-metrics" className="flex scroll-mt-40 flex-col gap-5">
      <SectionHeader label="Key Metrics" />
      <ReadoutRow cols={3}>
        <Readout label="Transacted Volume" value={figureOf(g, failed, (x) => dollars(x.transactedVolume))} sub={def("USDC volume across the tracked addresses")} />
        <Readout
          label="Lender Invested Capital"
          value={figureOf(g, failed, (x) => dollars(x.committedCapital))}
          sub={lenders ? <span title="Capital lenders deposited into the tranche pool">{lenders}</span> : "capital lenders deposited into the tranche pool"}
        />
        <Readout label="Assets Financed" value={figureOf(g, failed, (x) => dollars(x.assetsFinanced))} sub={def("capital deployed from the tranche pool to the borrower")} />
      </ReadoutRow>
      <ReadoutRow cols={3}>
        <Readout label="Lender Repayments" value={figureOf(g, failed, (x) => dollars(x.lenderRepayments))} sub={def("borrower to tranche pool transfers")} />
        <Readout label="Idle Capital" value={figureOf(g, failed, (x) => dollars(x.idleCapital))} sub={def("USDC balance of the tranche pool")} />
        <Readout label="Capital Turnover" value={figureOf(g, failed, (x) => `${x.capitalTurnover.toFixed(2)}×`)} sub={def("assets financed / invested capital")} />
        {/* the utilization series has a point only on a day with a transfer, so the mean is over those days */}
        <Readout label="Avg Capital Utilization" value={figureOf(g, failed, (x) => `${x.averageCapitalUtilization.toFixed(1)}%`)} sub={def("average over days with transfers")} />
        <Readout label="Days Active" value={figureOf(g, failed, (x) => String(x.lifeSinceInception))} unit={g ? "days" : undefined} sub={def("since the first tranche to borrower transfer")} />
        <Readout label="Avg Recycling Time" value={figureOf(g, failed, (x) => x.avgCapitalRecycling.toFixed(1))} unit={g ? "days" : undefined} sub={def("days active / capital turnover")} />
      </ReadoutRow>
    </section>
  );
}

/** a line of credit's key metrics: no transacted volume and no lender split, outstanding from the contract */
export function LineKeyMetrics({ metrics, failed }: { metrics: LineFacilityMetrics | null; failed: boolean }) {
  const g = metrics?.general;
  const draws = metrics?.line.draws;
  return (
    <section id="rwa-metrics" className="flex scroll-mt-40 flex-col gap-5">
      <SectionHeader label="Key Metrics" />
      <ReadoutRow cols={3}>
        <Readout
          label="Lender Invested Capital"
          value={figureOf(g, failed, (x) => dollars(x.committedCapital))}
          sub={def("capital committed to the line of credit", "Capital committed to the line of credit, as the contract reads it")}
        />
        <Readout
          label="Assets Financed"
          value={figureOf(g, failed, (x) => dollars(x.assetsFinanced))}
          sub={def(
            draws === undefined ? "draws from the line of credit to the borrower" : `across ${draws.toLocaleString("en-US")} ${draws === 1 ? "draw" : "draws"}`,
            "Draws from the line of credit to the borrower",
          )}
        />
        <Readout label="Lender Repayments" value={figureOf(g, failed, (x) => dollars(x.lenderRepayments))} sub={def("repayments to the line of credit, interest included")} />
      </ReadoutRow>
      <ReadoutRow cols={3}>
        <Readout
          label="Capital Outstanding"
          value={figureOf(metrics?.line, failed, (x) => dollars(x.capitalOutstanding))}
          sub={def("principal drawn and not yet repaid", "Principal drawn and not yet repaid, as the contract reads it")}
        />
        <Readout label="Idle Capital" value={figureOf(g, failed, (x) => dollars(x.idleCapital))} sub={def("committed capital minus outstanding")} />
        <Readout label="Capital Turnover" value={figureOf(g, failed, (x) => `${x.capitalTurnover.toFixed(2)}×`)} sub={def("assets financed / committed capital")} />
        <Readout
          label="Avg Capital Utilization"
          value={figureOf(g, failed, (x) => `${x.averageCapitalUtilization.toFixed(1)}%`)}
          sub={def("average over days with line activity", "Average over the days with a draw, a repayment or a change of committed capital")}
        />
        <Readout label="Days Active" value={figureOf(g, failed, (x) => String(x.lifeSinceInception))} unit={g ? "days" : undefined} sub={def("since the first draw")} />
        <Readout label="Avg Recycling Time" value={figureOf(g, failed, (x) => x.avgCapitalRecycling.toFixed(1))} unit={g ? "days" : undefined} sub={def("days active / capital turnover")} />
      </ReadoutRow>
    </section>
  );
}

export function OatFiBreakdown({ metrics, failed }: { metrics: AllMetrics | null; failed: boolean }) {
  const o = metrics?.oatfi;
  return (
    <section id="rwa-oatfi" className="flex scroll-mt-40 flex-col gap-5">
      <SectionHeader label="OatFi Breakdown" />
      <ReadoutRow cols={3}>
        <Readout label="Capital Outstanding" value={figureOf(o, failed, (x) => dollars(x.capitalOutstanding))} sub={def("invested capital minus idle capital")} />
        <Readout label="Principal Repayments" value={figureOf(o, failed, (x) => dollars(x.principalRepayments))} sub={def("borrower to tranche pool repayments")} />
        <Readout label="Converted USDC" value={figureOf(o, failed, (x) => dollars(x.convertedUsdc))} sub={def("borrower outflow outside the tranche pool")} />
      </ReadoutRow>
    </section>
  );
}

/** Fence's latest facility figures; a figure Fence did not send reads n/a */
export function FacilityFigures({ fence, failed }: { fence: FenceMetrics | null; failed: boolean }) {
  if (failed && !fence) return <Unavailable what="Facility figures" />;
  const read = <T,>(v: T | null | undefined, show: (v: T) => ReactNode) => (!fence ? null : v === null || v === undefined ? "n/a" : show(v));
  const cl01 = fence?.cl01Concentration ?? null;
  return (
    <ReadoutRow cols={4}>
      <Readout label="Paid Collections" value={read(fence?.paidTotalCollections, (c) => <Money value={c.value} />)} sub={def("payments collected to date")} />
      <Readout label="Expected Collections" value={read(fence?.expectedTotalCollections, (c) => <Money value={c.value} />)} sub={def("payments due up to today")} />
      <Readout label="Repayment Ratio" value={read(fence?.repaymentRatio, (r) => `${(r * 100).toFixed(1)}%`)} sub={def("paid / expected collections")} />
      <Readout
        label="Industry Concentration"
        value={read(cl01, (c) => `${(c.value * 100).toFixed(1)}%`)}
        sub={
          cl01
            ? def(
                `limit ${(cl01.threshold * 100).toFixed(0)}% · ${cl01.withinLimit ? "within" : "over"} · top industry (CL01)`,
                `Top 1 industry concentration (CL01). Limit: ${(cl01.threshold * 100).toFixed(0)}%. Currently ${cl01.withinLimit ? "within" : "exceeding"} threshold.`,
              )
            : def("top industry share (CL01)")
        }
      />
    </ReadoutRow>
  );
}

/** the facility's partners after the Avalanche mark, as the old dashboard's header showed the pilot's; a mark's own classes override its height or its dark-mode invert */
export function PartnerLogos({ partners }: { partners: PartnerMark[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Partners</span>
      <AvalancheLogo className="h-6 w-6" aria-label="Avalanche" />
      {partners.map((p) => (
        <Image
          key={p.name}
          src={p.src}
          alt={p.name}
          width={80}
          height={24}
          unoptimized={p.src.endsWith(".svg")}
          className={cn("h-6 w-auto object-contain opacity-80 dark:invert dark:hue-rotate-180", p.className)}
        />
      ))}
    </div>
  );
}
