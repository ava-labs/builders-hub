import type { ChainPulse } from "@/app/api/chain-pulse/route";

/* The network's throughput now, the figure the overview leads with. Each
   chain's rate is its own transactions over its own time: summed over one
   span shared by every chain, a slow chain's quiet diluted the fast
   chains, and the first reading came out a fraction of the truth. The
   live feed rates the chains it watches once it covers 15 seconds of each
   without a gap. The server's pulse (every catalog chain's newest ten
   blocks) rates the rest, and stands in for a live chain until then. */

/** the sliding window a live rate is measured over */
export const RATE_WINDOW_MS = 75_000;
/** the least time a live rate covers before it replaces the pulse */
export const RATE_MIN_SPAN_MS = 15_000;
/** a chain whose newest block trails the network's by more than a poll is quiet */
export const QUIET_MS = 5_000;
/** how far the browser's clock may run ahead of the chains' before it takes over */
export const CLOCK_SLACK_MS = 10_000;

export interface FedBlock {
  /** ms since epoch */
  at: number;
  height: number;
  txCount: number;
}

/** a chain's blocks since the feed began to cover it without a gap. The
    block that opens the run is not in blocks: its transactions came before
    the run began, so since is its time */
export interface Cover {
  since: number;
  blocks: FedBlock[];
}

/** a poll's fresh blocks added to a chain's run; a gap after the last height starts a new run */
export function extendCover(cover: Cover | undefined, fresh: FedBlock[], lastHeight: number | undefined): Cover | undefined {
  if (fresh.length === 0) return cover;
  const sorted = [...fresh].sort((a, b) => a.height - b.height);
  if (cover && lastHeight !== undefined && sorted[0].height <= lastHeight + 1) {
    return { since: cover.since, blocks: [...cover.blocks, ...sorted.filter((b) => b.height > lastHeight)] };
  }
  const [open, ...rest] = sorted;
  return { since: open.at, blocks: rest };
}

/** now, on the chains' clock: their newest block. The feed reaches the
    browser seconds after a block, and a browser clock can be off; a feed
    gone stale gives way to the browser's clock, less the slack */
export function chainClock(covers: Map<string, Cover>, browserNow: number): number {
  let now = browserNow - CLOCK_SLACK_MS;
  for (const c of covers.values()) now = Math.max(now, c.since, ...c.blocks.map((b) => b.at));
  return now;
}

/** each chain's transactions a second over the window, for a run that
    covers RATE_MIN_SPAN_MS of it. A busy chain's span ends at its newest
    block, so the feed's delay does not dilute its rate; a quiet chain's
    span reaches toward now, so its rate fades */
export function coverRates(covers: Map<string, Cover>, now: number): Map<string, number> {
  const rates = new Map<string, number>();
  for (const [id, c] of covers) {
    const start = Math.max(c.since, now - RATE_WINDOW_MS);
    const newest = c.blocks.length > 0 ? c.blocks[c.blocks.length - 1].at : c.since;
    const span = Math.max(newest, now - QUIET_MS) - start;
    if (span < RATE_MIN_SPAN_MS) continue;
    const txs = c.blocks.reduce((sum, b) => (b.at >= start ? sum + b.txCount : sum), 0);
    rates.set(id, (txs * 1000) / span);
  }
  return rates;
}

/** transactions a second over the network. Each chain counts at its live
    rate where the feed has one, else the pulse's, else its average over the
    page's window (a chain with no RPC to read). null until the pulse
    arrives: the live feed watches a few chains, and their sum alone would
    understate the network */
export function networkTps(
  pulse: Map<string, ChainPulse> | null,
  live: Map<string, number> | null,
  average: Map<string, number> | null = null,
): number | null {
  if (!pulse) return null;
  const ids = new Set([...pulse.keys(), ...(live?.keys() ?? []), ...(average?.keys() ?? [])]);
  let tps = 0;
  for (const id of ids) {
    const p = pulse.get(id);
    tps += live?.get(id) ?? (p?.ok && p.txPerMin !== null ? p.txPerMin / 60 : (average?.get(id) ?? 0));
  }
  return tps;
}
