"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { ChartBoard, EmptyRow, RowSkeleton } from "@/components/explorer-v2/ui";
import { ChartEmpty, TipPlate } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { ShareMap, TAIL_TONE, type SharePart } from "@/components/explorer-v2/ShareMap";
import { dayLong, dayShort, truncate } from "@/components/explorer-v2/format";
import { useContractNames } from "@/lib/sourcify-client";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { AccountsActivity, AccountLeader } from "@/lib/explorer-clickhouse";
import { InkDelta, LiveReadout } from "./EvmOverviewStats";
import {
  fmtCompact,
  metricSeries,
  weekFloor,
  num,
  pctOf,
  useChainMetrics,
  windowPair,
  type DualPoint,
} from "./metric-charts";

/* The chain's Accounts tab in the explorer's reading grammar: the
   population as readout blocks on the shared clock (each against its
   previous window), charts that say in one sentence what they show, and
   who the traffic is as share maps of the window's transactions. The
   chart half reads the chain-stats indexer; the share maps read
   ClickHouse through /api/accounts. Chains outside the ClickHouse dataset
   keep the charts and say so under them. */

const METRICS = ["activeAddresses", "activeSenders", "cumulativeAddresses", "contracts", "deployers", "txCount"].join(",");

// the leaderboards' ClickHouse window tops out at 90 days (same budget
// as the gas market); the year clock serves 90d and says so
const MAX_LEADERBOARD_DAYS = 90;

const AXIS_TICK = { fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" } as const;
const GRID = "rgba(161,161,170,0.18)";

function useAccountsActivity(chainId: string, rangeDays: number) {
  const [activity, setActivity] = useState<AccountsActivity | null>(null);
  const [notIndexed, setNotIndexed] = useState(false);
  const served = Math.min(rangeDays, MAX_LEADERBOARD_DAYS);

  useEffect(() => {
    let cancelled = false;
    setActivity(null);
    setNotIndexed(false);
    fetch(`/api/accounts/${chainId}?range=${served}`)
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) setNotIndexed(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: AccountsActivity | null) => {
        if (!cancelled && data) setActivity(data);
      })
      .catch(() => {
        if (!cancelled) setNotIndexed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, served]);

  return { activity, notIndexed, served };
}

/** a daily series with today's partial UTC day left out: a half day would
 *  read as a collapse at the window's end */
function completeDays(points: DualPoint[]): DualPoint[] {
  const today = new Date().toISOString().slice(0, 10);
  return points.filter((p) => p.date.slice(0, 10) < today);
}

/** native amounts as a reader wants them: nothing as a dash, dust as "<0.01" */
function nativeShort(v: number, sym: string | undefined): string {
  if (!v) return "no value";
  return `${v < 0.01 ? "<0.01" : fmtCompact(v)} ${sym ?? ""}`.trim();
}

/** the day a series peaked, and at what */
function peakOf(points: DualPoint[]): { v: number; date: string } | null {
  return points.reduce<{ v: number; date: string } | null>((m, p) => (!m || p.a > m.v ? { v: p.a, date: p.date } : m), null);
}

/** One daily chart: the headline series as an area or bars, an optional
 *  overlay as a line, human dates on the axis and in the plate, the scale
 *  on the right. */
function DayChart({
  data,
  kind,
  aLabel,
  bLabel,
}: {
  data: DualPoint[];
  kind: "area" | "bars";
  aLabel: string;
  bLabel?: string;
}) {
  const hasB = !!bLabel && data.some((d) => d.b !== undefined);
  return (
    <div className="h-48 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            minTickGap={48}
            // a bar axis ticks every category unless told a stride
            interval={kind === "bars" ? Math.max(0, Math.ceil(data.length / 7) - 1) : "preserveStartEnd"}
            tickFormatter={(d: string) => dayShort(d)}
          />
          <YAxis
            orientation="right"
            width={48}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickCount={4}
            tickFormatter={(v: number) => fmtCompact(v)}
            domain={kind === "bars" ? [0, "dataMax"] : ["auto", "auto"]}
          />
          <RechartsTooltip
            cursor={kind === "bars" ? { fill: "rgba(161,161,170,0.1)" } : { stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as DualPoint;
              return (
                <TipPlate>
                  <p className="font-mono text-[10px] text-zinc-500">{dayLong(d.date)}</p>
                  <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.a.toLocaleString("en-US")} {aLabel}
                  </p>
                  {hasB && d.b !== undefined && (
                    <p className="font-mono text-[10px] tabular-nums text-zinc-500">
                      {d.b.toLocaleString("en-US")} {bLabel}
                    </p>
                  )}
                </TipPlate>
              );
            }}
          />
          {kind === "area" ? (
            <Area type="monotone" dataKey="a" stroke="#3f3f46" strokeWidth={1.5} fill="#A2AFB2" fillOpacity={0.4} isAnimationActive={false} />
          ) : (
            <Bar dataKey="a" fill="#A2AFB2" isAnimationActive={false} />
          )}
          {hasB && (
            <Line
              type="monotone"
              dataKey="b"
              stroke="#0061E2"
              strokeWidth={1.5}
              strokeDasharray={kind === "bars" ? "4 3" : undefined}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* the overlay's key, in the overlay's own ink */
function OverlayChip({ label, dashed = false }: { label: string; dashed?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
      <span className={dashed ? "w-3 border-t border-dashed border-[#0061E2]" : "h-px w-3 bg-[#0061E2]"} />
      {label}
    </span>
  );
}

/* the chart's one plain sentence, above the plot */
function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 font-mono text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</p>;
}
const Ink = ({ children }: { children: React.ReactNode }) => <span className="text-zinc-900 dark:text-zinc-50">{children}</span>;

/** a leaderboard as a share of every transaction in the window: the top
 *  addresses by name, the rest of the chain as one gray remainder */
function leaderParts(
  leaders: AccountLeader[],
  totalTxs: number | null,
  names: Map<string, string>,
  base: string,
  sub: (l: AccountLeader) => string,
): SharePart[] {
  const parts: SharePart[] = leaders.map((l) => {
    const name = names.get(l.address.toLowerCase());
    return {
      key: l.address,
      label: name ?? truncate(l.address, 10),
      mono: !name,
      value: l.txs,
      href: `${base}/address/${l.address}`,
      sub: sub(l),
      detail: l.address,
    };
  });
  const top = leaders.reduce((s, l) => s + l.txs, 0);
  if (totalTxs !== null && totalTxs > top) {
    parts.push({ key: "rest", label: "Everyone else", value: totalTxs - top, tone: TAIL_TONE, sub: "the rest of the chain's transactions" });
  }
  return parts;
}

export function EvmAccounts({ network }: { network: string }) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const sym = c.nativeToken;

  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  const rangeLabel = rangeWindowLabel(clock).toLowerCase();

  // fetch double the window so every reading can face its previous window
  const { metrics, failed } = useChainMetrics(c.chainId, Math.min(range * 2, 365), METRICS);
  const { activity, notIndexed, served } = useAccountsActivity(c.chainId, range);
  // the share maps' one exception to the page clock, stated on the map
  const boardsNote = served < range ? `${served} days, longest computed` : null;

  const m = metrics ?? {};
  const current = (key: string) => num(m[key]?.current_value);
  const win = (key: string, mode: "sum" | "avg" = "sum") => windowPair(m[key]?.data, range, mode);

  // one Sourcify pass over both boards; the resolved names accumulate,
  // so flipping the clock relabels instantly for repeat leaders
  const leaderAddresses = useMemo(
    () => [...(activity?.called ?? []), ...(activity?.senders ?? [])].map((l) => l.address),
    [activity],
  );
  const names = useContractNames(c.chainId, leaderAddresses);

  const activePair = win("activeAddresses", "avg");
  const sendersPair = win("activeSenders", "avg");
  const contractsPair = win("contracts");
  const deployersPair = win("deployers");
  const totalAddresses = current("cumulativeAddresses");
  // the share maps' whole: every tx in the leaderboards' window
  const txTotal = windowPair(m["txCount"]?.data, served, "sum")?.cur ?? null;

  const active = useMemo(() => completeDays(metricSeries(m, range, "activeAddresses", "activeSenders")), [metrics, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => completeDays(metricSeries(m, range, "cumulativeAddresses")), [metrics, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const deployed = useMemo(() => completeDays(metricSeries(m, range, "contracts", "deployers")), [metrics, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const activePeak = peakOf(active);
  const activeLow = active.length ? Math.min(...active.map((d) => d.a)) : null;
  const deployedPeak = peakOf(deployed);
  const gained = total.length > 1 ? total[total.length - 1].a - total[0].a : null;

  const pending = metrics || failed ? "—" : "…";

  return (
    <EvmShell network={network}>
      <div className="flex flex-col gap-12">
        {/* the population, as readout blocks on the page clock */}
        <LiveReadout
          chainId={c.chainId}
          cells={[
            {
              label: "Active Addresses",
              value: activePair ? fmtCompact(activePair.cur) : pending,
              sub: activePair ? (
                <>
                  {range > 1 ? "daily avg · " : null}
                  <InkDelta value={pctOf(activePair)} />
                </>
              ) : undefined,
              values: active.map((d) => d.a),
            },
            {
              label: "Active Senders",
              value: sendersPair ? fmtCompact(sendersPair.cur) : pending,
              sub: sendersPair ? (
                <>
                  {range > 1 ? "daily avg · " : null}
                  <InkDelta value={pctOf(sendersPair)} />
                </>
              ) : undefined,
              values: active.some((d) => d.b !== undefined) ? active.map((d) => d.b ?? 0) : undefined,
            },
            {
              label: "Total Addresses",
              value: totalAddresses !== null ? fmtCompact(totalAddresses) : pending,
              sub: gained !== null ? `+${fmtCompact(gained)} ${rangeLabel}` : "all-time",
              values: total.map((d) => d.a),
            },
            {
              label: "Contracts Deployed",
              value: contractsPair ? fmtCompact(contractsPair.cur) : pending,
              sub: contractsPair ? (
                <>
                  {deployersPair ? `${fmtCompact(deployersPair.cur)} deployers · ` : null}
                  <InkDelta value={pctOf(contractsPair)} />
                </>
              ) : undefined,
              values: deployed.map((d) => d.a),
            },
          ]}
        />

        {/* the population over time, each chart said in one sentence */}
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartBoard label={`Active Addresses${weekFloor(range)}`} action={<OverlayChip label="senders" />}>
            {active.length ? (
              <>
                {activePeak && activeLow !== null && (
                  <Caption>
                    Between <Ink>{fmtCompact(activeLow)}</Ink> and <Ink>{fmtCompact(activePeak.v)}</Ink> addresses were active a day; the busiest day was{" "}
                    {dayLong(activePeak.date)}.
                  </Caption>
                )}
                <DayChart data={active} kind="area" aLabel="active addresses" bLabel="senders" />
              </>
            ) : (
              <ChartEmpty failed={!!metrics || failed} />
            )}
          </ChartBoard>

          <ChartBoard label={`Total Addresses${weekFloor(range)}`}>
            {total.length ? (
              <>
                {gained !== null && (
                  <Caption>
                    The chain gained <Ink>{fmtCompact(gained)}</Ink> addresses, from {fmtCompact(total[0].a)} on {dayShort(total[0].date)} to{" "}
                    <Ink>{fmtCompact(total[total.length - 1].a)}</Ink> on {dayShort(total[total.length - 1].date)}.
                  </Caption>
                )}
                <DayChart data={total} kind="area" aLabel="addresses, all-time" />
              </>
            ) : (
              <ChartEmpty failed={!!metrics || failed} />
            )}
          </ChartBoard>
        </div>

        <ChartBoard label={`Contracts Deployed${weekFloor(range)}`} action={<OverlayChip label="deployers" dashed />}>
          {deployed.length ? (
            <>
              {contractsPair && deployedPeak && (
                <Caption>
                  <Ink>{fmtCompact(contractsPair.cur)}</Ink> contracts deployed
                  {deployersPair ? (
                    <>
                      {" "}by <Ink>{fmtCompact(deployersPair.cur)}</Ink> deployers
                    </>
                  ) : null}
                  ; the busiest day was {dayLong(deployedPeak.date)}, with {fmtCompact(deployedPeak.v)}.
                </Caption>
              )}
              <DayChart data={deployed} kind="bars" aLabel="contracts deployed" bLabel="deployers" />
            </>
          ) : (
            <ChartEmpty failed={!!metrics || failed} />
          )}
        </ChartBoard>

        {/* who the traffic actually is, as shares of every tx in the window */}
        {notIndexed ? (
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Leaderboards need indexed transaction history; this chain isn&apos;t in the dataset yet.
          </p>
        ) : !activity ? (
          <div className="flex flex-col gap-10">
            <RowSkeleton n={6} />
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {activity.called.length ? (
              <ShareMap
                label="Most called"
                summary={`share of ${txTotal !== null ? fmtCompact(txTotal) : "all"} txs · ${boardsNote ?? rangeLabel}`}
                parts={leaderParts(activity.called, txTotal, names, base, (l) =>
                  [`${fmtCompact(l.counterparties)} sender${l.counterparties === 1 ? "" : "s"}`, `${nativeShort(l.feesNative, sym)} in fees`].join(" · "),
                )}
                fmt={(v) => `${fmtCompact(v)} txs`}
                legend={16}
                note="The addresses the most transactions were sent to: contracts, and wallets that receive a lot. A contract name appears where its source is verified."
              />
            ) : (
              <EmptyRow>no called addresses in this window</EmptyRow>
            )}
            {activity.senders.length ? (
              <ShareMap
                label="Top senders"
                summary={`share of ${txTotal !== null ? fmtCompact(txTotal) : "all"} txs · ${boardsNote ?? rangeLabel}`}
                parts={leaderParts(activity.senders, txTotal, names, base, (l) =>
                  [`${fmtCompact(l.counterparties)} destination${l.counterparties === 1 ? "" : "s"}`, `${nativeShort(l.native, sym)} moved`].join(" · "),
                )}
                fmt={(v) => `${fmtCompact(v)} txs`}
                legend={16}
                note="The addresses that signed the most transactions. A sender with one or two destinations and millions of transactions is usually automated."
              />
            ) : (
              <EmptyRow>no senders in this window</EmptyRow>
            )}
          </div>
        )}
      </div>
    </EvmShell>
  );
}
