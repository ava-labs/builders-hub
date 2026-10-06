"use client";

import { useEffect, useState } from "react";
import { PRIMARY_SUBNET_ID, getBlockTime, getCurrentValidators, getL1Validator, getPrimaryTotalStake, getValidatorFeeState, type CurrentValidator } from "@/lib/pchain-node";
import type { ConversionResponse, NodeResponse, ValidationsResponse } from "@/lib/pchain-explorer";
import { SOFT_READ, isOk } from "@/lib/explorer-soft-status";
import { DAY } from "@/lib/explorer-query/values";
import type { SettledBalance } from "./seat-balance";

/* The node page's reads beyond the indexer's node document, and the
   staking arithmetic its parts share. */

/* --- which record leads the page --- */

/* A node in the Primary Network's current snapshot leads with its stake. A
   node off it leads with its L1 seat, even when it has staking history: that
   history is past terms, often on the very subnet that has since become its
   L1. The seat is the hinted one when the node document holds no seat or
   holds that one (a seat newer than the document); a hint from an old tx
   whose L1 the node has left gives way to the seat the document holds.
   undefined when no seat leads, so the indexer document's view does. */
export function leadSeat(n: NodeResponse | null, subnetHint: string | undefined): string | undefined {
  if (!n || n.hasSnapshot) return undefined;
  const seats = n.validations?.filter((v) => v.kind === "l1") ?? [];
  if (subnetHint && (seats.length === 0 || seats.some((v) => v.subnetId === subnetHint))) return subnetHint;
  return seats[0]?.subnetId;
}

/* The node validated this subnet before it became an L1: a completed subnet
   term on it, or an AddSubnetValidatorTx in its recent staking txs. */
export function validatedAsSubnet(subnetId: string | undefined, n: NodeResponse | null, terms: ValidationsResponse | null): boolean {
  if (!subnetId) return false;
  return !!terms?.periods.some((p) => p.subnetId === subnetId) || !!n?.history?.some((h) => h.txType === "AddSubnetValidatorTx" && h.subnetId === subnetId);
}

/* When the node's L1 was still a subnet: its ConvertSubnetToL1Tx and that
   tx's time, for the line that says why the node's subnet terms end. Asked
   only for a subnet the node validated before; null otherwise. */
export function useConversion(network: string, subnetId: string | undefined): ConversionResponse | null {
  const [data, setData] = useState<ConversionResponse | null>(null);
  useEffect(() => {
    if (!subnetId) return;
    const controller = new AbortController();
    fetch(`/api/pchain-conversion/${network}/${subnetId}`, { ...SOFT_READ, signal: controller.signal })
      .then((r) => (isOk(r) ? r.json() : null))
      .then((d: ConversionResponse | null) => d?.txHash && setData(d))
      .catch(() => {
        /* no conversion line: the seat and the terms still read on their own */
      });
    return () => controller.abort();
  }, [network, subnetId]);
  return data?.subnetId === subnetId ? data : null;
}

/* --- the P2P observatory feed (hourly uptime, block production, slots) --- */

export interface P2PDetail {
  current_p50_uptime: number;
  miss_rate_14d: number;
  missed_14d: number;
  proposed_14d: number;
  uptime: { bucket: string; p50_uptime: number }[];
  blocks: { hour: string; proposed: number; missed: number }[];
  slots: { slot: number; cnt: number }[];
}

/** the feed's daily block buckets less the UTC day still running: the chart
 *  shows whole days only, as the explorer's other daily charts do, so it
 *  never names a day that has not begun for a viewer west of UTC */
export function wholeDays<T extends { hour: string }>(days: T[], now: number): T[] {
  return days.filter((d) => Date.parse(d.hour) + DAY <= now);
}

export function useP2PDetail(nodeId: string, enabled: boolean) {
  const [data, setData] = useState<P2PDetail | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/validators/${encodeURIComponent(nodeId)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
    return () => controller.abort();
  }, [nodeId, enabled]);
  return data;
}

/* --- the track record: past validation terms and what they paid --- */

/* The node document's `history` cannot answer this. Upstream caps it at 100
   recent staking txs and honours no filter, so on a validator with thousands
   of delegators every row is a delegator addition and the node's own past
   terms fall off the end. The Data API indexes the terms themselves. */
export function useValidationHistory(network: string, nodeId: string): ValidationsResponse | null {
  const [data, setData] = useState<ValidationsResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/pchain-validations/${network}/${encodeURIComponent(nodeId)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ValidationsResponse | null) => d?.periods && setData(d))
      .catch(() => {
        /* a node with no closed terms just doesn't get the section */
      });
    return () => controller.abort();
  }, [network, nodeId]);
  return data;
}

/* the money context the indexer doesn't mirror: the live validator entry
   (payout owners, BLS identity) and the network's total stake: the
   denominator that turns this validator's stake into a share */
export function useStakeContext(network: string, nodeId: string, enabled: boolean) {
  const [identity, setIdentity] = useState<CurrentValidator | null>(null);
  const [networkStake, setNetworkStake] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getCurrentValidators(network, PRIMARY_SUBNET_ID, [nodeId]).then((vs) => {
      if (!cancelled) setIdentity(vs?.[0] ?? null);
    });
    getPrimaryTotalStake(network).then((s) => {
      if (!cancelled) setNetworkStake(s);
    });
    return () => {
      cancelled = true;
    };
  }, [network, nodeId, enabled]);
  return { identity, networkStake };
}

/* The P-Chain debits an L1 seat's continuous fee only when a block moves
   chain time, so the node reports the balance as of its last block:
   minutes old on a quiet chain. The seat read carries the height it was
   read at, and that block's time anchors it, so the pair holds even when
   the public RPC's nodes are a block apart. The view draws it down from
   there; a re-read each minute picks up the next block or a top-up. */
const SEAT_REFRESH_MS = 60_000;

/** settledAt is the time of the block at `height` */
interface SettledSeat extends SettledBalance {
  height: number;
}

export function useSettledSeat(network: string, validationID: string | undefined): SettledSeat | null {
  const [seat, setSeat] = useState<SettledSeat | null>(null);
  useEffect(() => {
    if (!validationID) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: SettledSeat | null = null;
    const read = async () => {
      const v = await getL1Validator(network, validationID);
      const height = Number(v?.height);
      // one state per height: the block and the price are asked again only when it moves
      if (v && height > 0 && height !== last?.height) {
        const [settledAt, fee] = await Promise.all([getBlockTime(network, height), getValidatorFeeState(network)]);
        if (settledAt && fee) {
          // a seat the node still knows but that reports no balance has run dry
          last = { balance: Number(v.balance ?? 0), settledAt, height, price: fee.price };
          if (!cancelled) setSeat(last);
        }
      }
      if (!cancelled) timer = setTimeout(next, SEAT_REFRESH_MS);
    };
    // a hidden tab skips its read and asks again a minute on
    const next = () => {
      if (document.visibilityState === "hidden") timer = setTimeout(next, SEAT_REFRESH_MS);
      else void read();
    };
    void read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [network, validationID]);
  return seat;
}

/* An L1 node's AvalancheGo version: the indexer's node document carries
   none for nodes off the Primary Network, so it comes from the same
   per-subnet roster the L1 Validators tab reads (/api/chain-validators,
   the discovery crawler's versions). The string is shown as reported, so a
   custom build keeps its own name. The version belongs to the node, not
   the seat, so every L1 it validates is asked in turn: the page's seat can
   be one the node has since left, whose roster no longer lists it.
   undefined while reading; null when no roster has a version for it. */
export function useL1NodeVersion(network: string, subnetIds: string[], nodeId: string): string | null | undefined {
  const [version, setVersion] = useState<string | null | undefined>(undefined);
  const key = subnetIds.join(",");
  useEffect(() => {
    let cancelled = false;
    setVersion(undefined);
    (async () => {
      for (const subnetId of key.split(",").filter(Boolean)) {
        try {
          const res = await fetch(`/api/chain-validators/${subnetId}?network=${network}`);
          if (!res.ok) continue;
          const data: { validators?: { nodeId: string; version?: string }[] } = await res.json();
          const v = data.validators?.find((x) => x.nodeId === nodeId)?.version?.trim();
          if (v && v !== "Unknown") {
            if (!cancelled) setVersion(v);
            return;
          }
        } catch {
          // the next roster may still know it
        }
      }
      if (!cancelled) setVersion(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [network, key, nodeId]);
  return version;
}

/* Primary Network staking rules: a validator can carry delegations up to
   5x its own stake, capped at 3M AVAX total. What's left of that headroom
   is the number a would-be delegator actually cares about. */
export const MAX_TOTAL_STAKE_NAVAX = 3_000_000 * 1e9;

export const LIST_CAP = 8;

/** nAVAX as a human reads it: millions compact, two decimals below that,
 *  four under one AVAX */
export function avax(nAvax: number | string | bigint): string {
  const v = Number(nAvax) / 1e9;
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}M AVAX`;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: Math.abs(v) >= 1 ? 2 : 4 })} AVAX`;
}

const SHARES_DENOM = 1_000_000n;

export function delegationFeeCut(gross: number, feePercent: number): bigint {
  const g = BigInt(Math.max(0, Math.round(gross)));
  const shares = BigInt(Math.round(feePercent * 10_000));
  if (g === 0n || shares <= 0n) return 0n;
  if (shares >= SHARES_DENOM) return g;
  const delegatorNet = ((SHARES_DENOM - shares) * g) / SHARES_DENOM; // floors
  return g - delegatorNet;
}
