"use client";

import { useEffect, useState } from "react";
import { BlockTape, BlockTapeSkeleton, type TapeBlock } from "@/components/explorer-v2/BlockTape";
import { timeAgo } from "@/components/explorer-v2/format";

/* The splash's tape: the same extruded blocks every chain page runs, but
   merged across the ecosystem's busiest chains — each block wears the logo
   and name of the chain that sealed it.

   Feel: sweeps poll every chain on a short cadence through the API's
   blocksOnly diet (headers only — no receipts, no ICM scan), but arrivals
   don't land as a batch. New blocks queue up and a metronome releases ONE
   per beat, oldest-first — an ambient instrument, not a firehose. When the
   network outruns the beat the backlog is quietly sampled: oldest pending
   blocks are let go, since the retention cap would displace them in
   seconds anyway. A chain that fails three sweeps drops out of the
   rotation silently. */

export interface TapeFeedChain {
  /** EVM chain id — the /api/explorer route key */
  chainId: string;
  slug: string;
  name: string;
  logo: string;
}

interface ApiBlock {
  number: string;
  timestamp: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  /** hex-parsed ms precision where the chain provides it (Avalanche does) */
  timestampMilliseconds?: number;
}

interface FeedBlock {
  key: string;
  chain: TapeFeedChain;
  height: number;
  txCount: number;
  fill?: number;
  /** epoch ms — the merge order across chains */
  at: number;
}

const POLL_MS = 5_000;
/* the beat: a release every second — a few blocks may land together when
   the network runs hot, which is its own kind of honest */
const BEAT_MS = 1_000;
/* safety trim for pathological bursts (a chain catching up after a stall) */
const PENDING_MAX = 24;
/* each chain keeps only its newest few — without this the fastest chain
   (C-Chain at ~2s blocks) floods the window and the tape stops being a
   cross-chain instrument within a minute */
const PER_CHAIN = 5;
const SHOWN = 20;

function toFeedBlocks(chain: TapeFeedChain, blocks: ApiBlock[]): FeedBlock[] {
  return blocks.flatMap((b) => {
    const height = Number(String(b.number).replace(/,/g, ""));
    const gas = Number(String(b.gasUsed).replace(/,/g, ""));
    const limit = Number(String(b.gasLimit).replace(/,/g, ""));
    const at = b.timestampMilliseconds ?? Date.parse(b.timestamp);
    if (!Number.isFinite(height) || !Number.isFinite(at)) return [];
    return [
      {
        key: `${chain.chainId}-${height}`,
        chain,
        height,
        txCount: b.transactionCount ?? 0,
        fill: Number.isFinite(gas) && limit > 0 ? gas / limit : undefined,
        at,
      },
    ];
  });
}

/* newest-first with the per-chain retention cap applied */
function retain(merged: FeedBlock[]): FeedBlock[] {
  merged.sort((a, b) => b.at - a.at || b.height - a.height);
  const counts = new Map<string, number>();
  return merged.filter((b) => {
    const n = counts.get(b.chain.chainId) ?? 0;
    if (n >= PER_CHAIN) return false;
    counts.set(b.chain.chainId, n + 1);
    return true;
  });
}

/* the name is the block's headline at 96px — drop the redundant network
   prefix so "Avalanche C-Chain" reads "C-Chain" */
function displayName(name: string): string {
  return name.replace(/^Avalanche\s+/i, "");
}

/* the sliding window the live TPS reading is measured over */
const PULSE_WINDOW_MS = 75_000;
const PULSE_MIN_SPAN_S = 15;

export function NetworkBlockTape({
  chains,
  onTps,
}: {
  chains: TapeFeedChain[];
  /** live tx/s measured from the blocks streaming through the tape —
   *  reported after each sweep; null until the window has enough span */
  onTps?: (tps: number | null) => void;
}) {
  const [blocks, setBlocks] = useState<FeedBlock[]>([]);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (chains.length === 0) return;
    let cancelled = false;
    let sweeping = false;
    const lastSeen = new Map<string, number>();
    const failures = new Map<string, number>();
    const queued = new Set<string>(); // every key ever queued or shown
    const pending: FeedBlock[] = []; // ascending by time — released oldest-first
    let shown: FeedBlock[] = [];
    // every fresh block (pre-retention) feeds the pulse window, so the
    // reading reflects real throughput, not what the tape chooses to show
    const pulse: { at: number; txCount: number }[] = [];

    const reportTps = () => {
      if (!onTps) return;
      const cutoff = Date.now() - PULSE_WINDOW_MS;
      while (pulse.length > 0 && pulse[0].at < cutoff) pulse.shift();
      if (pulse.length < 2) return;
      const spanS = (pulse[pulse.length - 1].at - pulse[0].at) / 1000;
      if (spanS < PULSE_MIN_SPAN_S) return;
      const total = pulse.reduce((sum, p) => sum + p.txCount, 0);
      onTps(total / spanS);
    };

    const commit = (next: FeedBlock[]) => {
      shown = next;
      if (!cancelled) setBlocks(next);
    };

    async function sweep(first: boolean) {
      if (sweeping) return; // a slow round still in flight — let it finish
      sweeping = true;
      const results = await Promise.all(
        chains.map(async (chain) => {
          if ((failures.get(chain.chainId) ?? 0) >= 3) return [];
          const last = lastSeen.get(chain.chainId);
          const query = last ? `blocksOnly=true&lastFetchedBlock=${last}` : "blocksOnly=true";
          try {
            const res = await fetch(`/api/explorer/${chain.chainId}?${query}`, {
              signal: AbortSignal.timeout(POLL_MS * 2),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as { blocks?: ApiBlock[] };
            const fresh = toFeedBlocks(chain, data.blocks ?? []);
            if (fresh.length > 0) {
              lastSeen.set(chain.chainId, Math.max(...fresh.map((b) => b.height)));
            }
            return fresh;
          } catch {
            failures.set(chain.chainId, (failures.get(chain.chainId) ?? 0) + 1);
            return [];
          }
        }),
      );
      sweeping = false;
      if (cancelled) return;
      setSettled(true);
      const fresh = results
        .flat()
        .filter((b) => !queued.has(b.key));
      fresh.forEach((b) => queued.add(b.key));
      pulse.push(...fresh.map((b) => ({ at: b.at, txCount: b.txCount })));
      pulse.sort((a, b) => a.at - b.at);
      reportTps();
      if (fresh.length === 0) return;
      if (first) {
        // the opening frame arrives whole; only later blocks stream in
        commit(retain([...fresh]));
      } else {
        pending.push(...fresh);
        pending.sort((a, b) => a.at - b.at || a.height - b.height);
      }
    }

    /* the metronome: each beat releases the queue's share for this beat —
       usually one block, sometimes a few together. If a release would be
       invisible (the retention cap already displaced it), try the next so
       the beat never lands on silence while blocks wait. */
    const drip = setInterval(() => {
      if (cancelled || pending.length === 0) return;
      if (pending.length > PENDING_MAX) pending.splice(0, pending.length - PENDING_MAX);
      const perBeat = Math.max(1, Math.ceil(pending.length / (POLL_MS / BEAT_MS)));
      while (pending.length > 0) {
        const next = retain([...pending.splice(0, perBeat), ...shown]);
        const changed =
          next.length !== shown.length || next.some((b, i) => b.key !== shown[i]?.key);
        if (changed) {
          commit(next);
          break;
        }
      }
    }, BEAT_MS);

    sweep(true);
    const poll = setInterval(() => sweep(false), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(drip);
    };
  }, [chains, onTps]);

  if (blocks.length === 0) {
    // roster still resolving or first sweep in flight — hold the row height;
    // if every chain failed, the tape bows out rather than sit empty
    return settled && chains.length > 0 ? null : <BlockTapeSkeleton />;
  }

  const tape: TapeBlock[] = blocks.slice(0, SHOWN).map((b) => ({
    key: b.key,
    number: `#${b.height.toLocaleString("en-US")}`,
    txCount: b.txCount,
    chain: { name: displayName(b.chain.name), logo: b.chain.logo },
    ago: timeAgo(b.at / 1000),
    fill: b.fill,
    href: `/explorer/mainnet/${b.chain.slug}/block/${b.height}`,
  }));

  return <BlockTape blocks={tape} />;
}
