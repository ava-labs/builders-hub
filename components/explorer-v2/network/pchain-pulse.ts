"use client";

import { useEffect, useMemo, useState } from "react";
import { pchainApiPath, type Stats, type TxSummary } from "@/lib/pchain-explorer";

/* The P-Chain under the network map: a ledger of its latest transactions
   and its tip, polled at the P-Chain explorer's own live cadence. Every tx
   takes the next place in the ledger (seq), so the map's ring can turn by
   exactly the txs that landed. The txs on screen at load are context,
   except the newest, which the ground plays once so the reader sees what
   it does; every tx that lands after that plays as it arrives. A poll that
   does not reach back to the ledger's head (a tab hidden a long time)
   reloads the ledger whole. */

export interface PulseTx {
  hash: string;
  type: string;
  height: number;
  /** unix seconds */
  ts: number;
  nodeId?: string;
  /** the stake's period, "14 days", on staking txs */
  period?: string;
  /** its place in the ledger: one more than the tx before it */
  seq: number;
  /** the ground plays it */
  fresh: boolean;
  /** the newest tx at load, played once after the model stands */
  replay: boolean;
  /** its place among the txs of the poll that brought it, oldest first */
  lane: number;
}

export interface PchainPulse {
  /** newest first, up to LEDGER */
  txs: PulseTx[];
  /** the tx the last landing pushed out of the ledger, so the ring can fade it out */
  outgoing: PulseTx | null;
  stats: Stats | null;
  /** moves when the ledger reloads whole, so the ring sets instead of turning */
  epoch: number;
}

/** the txs the ledger holds: about an hour of the P-Chain */
export const LEDGER = 96;
const POLL_MS = 12_000;
const POLL_LIMIT = 20;

const byHeight = (a: TxSummary, b: TxSummary) => a.blockHeight - b.blockHeight || a.txHash.localeCompare(b.txHash);

export function usePchainPulse(network = "mainnet"): PchainPulse {
  const [txs, setTxs] = useState<PulseTx[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let round = 0;
    // oldest first
    let ledger: PulseTx[] = [];
    let next = 0;

    const fetchTxs = async (limit: number) => {
      const res = await fetch(pchainApiPath(network, "txs", { limit }));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as TxSummary[]).slice().sort(byHeight);
    };
    const toPulse = (t: TxSummary, fresh: boolean, replay: boolean, lane: number): PulseTx => ({
      hash: t.txHash,
      type: t.txType,
      height: t.blockHeight,
      ts: t.blockTimestamp,
      nodeId: t.nodeId,
      period: t.periodHuman,
      seq: next++,
      fresh,
      replay,
      lane,
    });
    // the ledger holds one tx past LEDGER: the one on its way out
    const publish = () => setTxs(ledger.slice().reverse());

    const loadAll = async (first: boolean) => {
      const got = await fetchTxs(LEDGER);
      if (!alive || !got.length) return;
      next = 0;
      // on the first look only the newest plays, once
      ledger = got.map((t, i) => {
        const newest = first && i === got.length - 1;
        return toPulse(t, newest, newest, 0);
      });
      if (!first) setEpoch((e) => e + 1);
      publish();
    };

    const loadNew = async () => {
      const got = await fetchTxs(POLL_LIMIT);
      if (!alive || !got.length) return;
      const head = ledger[ledger.length - 1];
      // the poll does not reach back to the head: txs were missed, so start over
      if (!head || got[0].blockHeight > head.height) return loadAll(false);
      const have = new Set(ledger.map((t) => t.hash));
      let lane = 0;
      // a straggler below the head stays out: the ring only grows at its seam
      const landed = got.filter((t) => !have.has(t.txHash) && t.blockHeight >= head.height).map((t) => toPulse(t, true, false, lane++));
      if (!landed.length) return;
      ledger = [...ledger, ...landed].slice(-(LEDGER + 1));
      publish();
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
          await (ledger.length ? loadNew() : loadAll(true));
        } catch {
          /* the last good ledger stands */
        }
        try {
          // the tip and the day's counts move slowly: every other round
          if (round % 2 === 0) await loadStats();
        } catch {
          /* the last good stats stand */
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

  // stable between polls, so the ring's memo holds while the map re-renders on a hover
  const split = useMemo(() => ({ txs: txs.slice(0, LEDGER), outgoing: txs[LEDGER] ?? null }), [txs]);
  return { ...split, stats, epoch };
}
