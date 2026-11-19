"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { ChartBoard } from "@/components/explorer-v2/ui";
import { bigintToNumber } from "@/lib/rwa/utils";
import type { FacilityMetrics } from "@/lib/rwa/types";
import { Money, Unavailable } from "./rwa-parts";
import type { FlowCopy } from "./rwa-views";

/* The old dashboard's capital flow pipeline in the explorer's chrome: the
   forward flow from the capital source through the facility to the
   borrower, the return flow of repayments back into the facility, and its
   status, the idle capital and how much of the invested capital is out.
   The facility's view names the nodes, the verbs and the status: OatFi's
   lenders, tranche pool and borrower, or the Valinor Credit Vault, the line
   of credit, Rain and the Spigot. Both flows sit on one five-column grid,
   so every node is the same size and the rows line up. */

const START_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const FLOW_GRID = "grid grid-cols-1 items-center gap-y-1 md:grid-cols-5 md:gap-x-3";
const ROW_LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400";
/* the moving dashes of the old pipeline, in ink that holds 3:1 in both themes */
const DASHES_ACROSS = { backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 12px)", backgroundSize: "24px 2px" };
const DASHES_DOWN = { backgroundImage: "repeating-linear-gradient(180deg, currentColor 0 6px, transparent 6px 12px)", backgroundSize: "2px 24px" };

function FlowNode({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex min-h-[3.75rem] flex-col items-center justify-center gap-1 border border-zinc-200 bg-white/60 px-3 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-50">{name}</span>
      <span className="font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">{role}</span>
    </div>
  );
}

/** a step between two nodes: the amount over a moving rule, the verb under it; across from md up, down on a phone */
function FlowStep({ value, verb }: { value: number | null; verb: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 py-1">
      <span className="font-mono text-[15px] font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value === null ? "…" : <Money value={value} />}</span>
      <span aria-hidden className="hidden w-full items-center text-zinc-500 md:flex dark:text-zinc-400">
        <span className="h-[2px] flex-1 motion-safe:animate-[flow_1.5s_linear_infinite]" style={DASHES_ACROSS} />
        <ArrowRight className="-ml-0.5 h-3.5 w-3.5 shrink-0" />
      </span>
      <span aria-hidden className="flex flex-col items-center text-zinc-500 md:hidden dark:text-zinc-400">
        <span className="h-5 w-[2px] motion-safe:animate-[flowVertical_1.5s_linear_infinite]" style={DASHES_DOWN} />
        <ArrowDown className="-mt-0.5 h-3.5 w-3.5" />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{verb}</span>
    </div>
  );
}

function PoolStatus({ label, bar, idle, utilization }: { label: string; bar: string; idle: number | null; utilization: number | null }) {
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={ROW_LABEL}>{label}</span>
        <span className="flex flex-wrap gap-x-4 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>
            Idle <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{idle === null ? "…" : <Money value={idle} />}</span>
          </span>
          <span>
            Utilization <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{utilization === null ? "…" : `${utilization.toFixed(1)}%`}</span>
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={bar}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={utilization === null ? undefined : Math.round(utilization)}
        className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div className="h-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, utilization ?? 0))}%`, background: "var(--rwa-1)" }} />
      </div>
    </div>
  );
}

const amountOf = (v: bigint | undefined) => (v === undefined ? null : bigintToNumber(v));

export function CapitalFlow({ copy, metrics, since, failed }: { copy: FlowCopy; metrics: FacilityMetrics | null; since: string | null; failed: boolean }) {
  const g = metrics?.general;
  const invested = amountOf(g?.committedCapital);
  const idle = amountOf(g?.idleCapital);
  // the share of the invested capital that is out, as the old pipeline read the pool: a line's is its outstanding over committed
  const utilization = invested && idle !== null ? (1 - idle / invested) * 100 : null;
  const age = g ? `${g.lifeSinceInception} days${since ? ` since ${START_DAY.format(new Date(`${since}T00:00:00Z`))}` : ""}` : null;
  return (
    <section id="rwa-capital-flow" className="scroll-mt-40">
      <ChartBoard
        label="Capital Flow Pipeline"
        action={<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{age ? `to date · ${age}` : "to date"}</span>}
      >
        {failed && !metrics ? (
          <Unavailable what={copy.unavailable} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className={ROW_LABEL}>Forward Flow</span>
              <div className={FLOW_GRID}>
                <FlowNode name={copy.source.name} role={copy.source.role} />
                <FlowStep value={invested} verb={copy.invested} />
                <FlowNode name={copy.hub.name} role={copy.hub.role} />
                <FlowStep value={amountOf(g?.assetsFinanced)} verb={copy.deployed} />
                <FlowNode name={copy.borrower.name} role={copy.borrower.role} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <span className={ROW_LABEL}>Return Flow</span>
              <div className={FLOW_GRID}>
                <FlowNode name={copy.payer.name} role={copy.payer.role} />
                <FlowStep value={amountOf(g?.lenderRepayments)} verb="Repaid" />
                <FlowNode name={copy.payee.name} role={copy.payee.role} />
              </div>
            </div>
            <PoolStatus label={copy.status} bar={copy.statusBar} idle={idle} utilization={utilization} />
          </div>
        )}
      </ChartBoard>
    </section>
  );
}
