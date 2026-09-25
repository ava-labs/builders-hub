"use client";

import { useEffect, useRef, useState } from "react";
import { pchainApiPath, type Stats, type TxSummary } from "@/lib/pchain-explorer";

/* The P-Chain under the network map: its latest transactions and its tip,
   polled at the P-Chain explorer's own live cadence. The txs on screen at
   load are context, except the newest one, which the ground plays once so
   the reader sees what the ground does; every tx that lands after that
   ripples as it arrives. */

export interface PulseTx {
  hash: string;
  type: string;
  height: number;
  /** unix seconds */
  ts: number;
  /** the ground ripples for it */
  fresh: boolean;
  /** the newest tx at load, played once after the model stands */
  replay: boolean;
  /** its place among the txs of the poll that brought it, oldest first */
  lane: number;
}

export interface PchainPulse {
  /** newest first */
  txs: PulseTx[];
  stats: Stats | null;
}

const POLL_MS = 12_000;
const KEEP = 24;

export function usePchainPulse(network = "mainnet"): PchainPulse {
  const [txs, setTxs] = useState<PulseTx[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const known = useRef(new Map<string, PulseTx>());
  const floor = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let round = 0;

    const loadTxs = async () => {
      const res = await fetch(pchainApiPath(network, "txs", { limit: 10 }));
      if (!res.ok) return;
      const got = ((await res.json()) as TxSummary[]).slice().sort((a, b) => a.blockHeight - b.blockHeight);
      if (!got.length || !alive) return;
      const first = floor.current === null;
      const top = Math.max(...got.map((t) => t.blockHeight));
      let lane = 0;
      let replayed = false;
      for (const t of [...got].reverse()) {
        // newest first, so the replay lands on the newest tx
        if (known.current.has(t.txHash)) continue;
        const replay = first && !replayed;
        if (replay) replayed = true;
        known.current.set(t.txHash, { hash: t.txHash, type: t.txType, height: t.blockHeight, ts: t.blockTimestamp, fresh: replay, replay, lane: 0 });
      }
      if (!first) {
        // the txs that arrived after the last look ripple, oldest first
        for (const t of got) {
          const k = known.current.get(t.txHash);
          if (k && !k.fresh && t.blockHeight > (floor.current ?? 0)) known.current.set(t.txHash, { ...k, fresh: true, lane: lane++ });
        }
      }
      floor.current = Math.max(floor.current ?? 0, top);
      const list = [...known.current.values()].sort((a, b) => b.height - a.height || a.hash.localeCompare(b.hash)).slice(0, KEEP);
      known.current = new Map(list.map((t) => [t.hash, t]));
      setTxs(list);
    };

    const loadStats = async () => {
      const res = await fetch(pchainApiPath(network, "stats"));
      if (!res.ok) return;
      const s = (await res.json()) as Stats;
      if (alive) setStats(s);
    };

    const loop = async () => {
      if (document.visibilityState !== "hidden") {
        try {
          await loadTxs();
          // the tip and the day's counts move slowly: every other round
          if (round % 2 === 0) await loadStats();
        } catch {
          /* the last good pulse stands */
        }
        round += 1;
      }
      if (alive) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [network]);

  return { txs, stats };
}
