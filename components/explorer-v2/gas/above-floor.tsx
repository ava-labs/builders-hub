"use client";

import { Instrument, StackBlock, FACE, type StackCol, type StackLayer } from "@/components/explorer-v2/gas/instruments";
import { StackKey } from "@/components/explorer-v2/gas/stack-parts";
import { dayLong, dayShort, hourLong } from "@/components/explorer-v2/format";
import { fmtFee } from "@/components/explorer/GasMarketPage";
import type { GasDayPoint, GasHourPoint } from "@/lib/explorer-clickhouse";
import type { FeeFloor } from "@/lib/gas-history-rows";

/* How far the base fee rides above the protocol's floor. The floor moves
   (validators vote it, ACP-283), and the price is the floor times
   e^(excess / K), so the ratio to the floor is what demand moved: the same
   backlog lifts the fee by the same percent at any floor. */

type FloorCol = StackCol & { f: FeeFloor; p95: number };

const LAYERS: StackLayer[] = [
  { key: "above", label: "p95 above the floor", what: "each bucket's p95 base fee over the floor", faces: [FACE.quiet[1], FACE.quiet[0], FACE.quiet[2]], swatch: "bg-[#c9d1d3] dark:bg-[#5d6669]" },
];

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

const pct = (v: number) => `+${v < 10 ? v.toFixed(1) : v.toFixed(0)}%`;
const share = (above: number, of: number) => (of ? `${Math.round((above / of) * 100)}%` : "0%");

/** the buckets that carry a floor; the one still running, by key, drawn striped */
function floorCols(rows: (GasDayPoint | GasHourPoint)[], runningKey: string | null): FloorCol[] {
  return rows.flatMap((d) => {
    if (!d.floor) return [];
    const hourly = "t" in d;
    const at = hourly ? d.t : d.d;
    const running = at === runningKey;
    const tick = running ? (hourly ? "Now" : "Today") : hourly ? `${dayShort(at)} ${at.slice(11, 13)}:00` : dayShort(at);
    return [{ key: at, long: hourly ? hourLong(at) : dayLong(at), tick, partial: running, parts: { above: d.floor.aboveP95 }, f: d.floor, p95: d.p95 }];
  });
}

export function AboveFloorBlock({
  rows,
  runningKey,
  hourly,
  note,
  unit,
  stale,
}: {
  rows: (GasDayPoint | GasHourPoint)[];
  /** the bucket still running (this hour, or today) */
  runningKey: string | null;
  hourly: boolean;
  note?: string | null;
  unit: string;
  stale?: boolean;
}) {
  const cols = floorCols(rows, runningKey);
  if (!cols.length) {
    return (
      <Instrument label="Above the Floor" note={note}>
        <p className="flex h-40 items-center justify-center text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
          No base fee floor indexed for this chain yet
        </p>
      </Instrument>
    );
  }
  // the running bucket stays out of the figure while whole ones exist
  const whole = cols.filter((c) => !c.partial);
  const basis = whole.length ? whole : cols;
  const above = basis.reduce((s, c) => s + c.f.blocksAbove, 0);
  const of = basis.reduce((s, c) => s + c.f.blocks, 0);
  const soFar = whole.length ? "" : hourly ? " · this hour so far" : " · today so far";
  return (
    <StackBlock
      label="Above the Floor"
      note={note}
      stale={stale}
      figure={pct(median(basis.map((c) => c.f.aboveP95)))}
      sub={`typical p95 over the floor · ${share(above, of)} of blocks priced above it${soFar}`}
      cols={cols}
      layers={LAYERS}
      // one layer needs no share in the key: only the running bucket's stripes are named
      legend={whole.length < cols.length ? <StackKey layers={[]} sums={{}} all={0} focus={null} setFocus={() => {}} partialLabel={hourly ? "This hour, so far" : "Today, so far"} /> : <span />}
      fmt={pct}
      tip={(c) => {
        const { f, p95 } = c as FloorCol;
        return (
          <>
            <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">{c.long}</p>
            {c.partial && <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">So far: the {hourly ? "hour" : "day"} is still running (UTC)</p>}
            <p className="whitespace-nowrap font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{pct(f.aboveP95)} above the floor at p95</p>
            <p className="whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-500">
              p95 {fmtFee(p95)} vs floor {fmtFee(f.floor)} {unit}
            </p>
            <p className="whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-500">
              {f.blocksAbove.toLocaleString("en-US")} of {f.blocks.toLocaleString("en-US")} blocks above it ({share(f.blocksAbove, f.blocks)})
            </p>
          </>
        );
      }}
    />
  );
}
