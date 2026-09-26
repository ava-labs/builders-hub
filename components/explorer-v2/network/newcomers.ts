"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { pchainApiPath, type Tx } from "@/lib/pchain-explorer";
import type { PulseTx } from "@/components/explorer-v2/network/pchain-pulse";

/* The L1s that joined the P-Chain this week, so the network map can stand
   them up before the catalog knows them. The registry names the newest
   launches with their running validators; a conversion that lands while
   the page is open joins at once, named from the chain its subnet created
   earlier in the ledger. The same registry read names every set the
   P-Chain runs now, so a private L1 past its first week stands too. */

export interface Newcomer {
  subnetId: string;
  name: string;
  /** its chain's blockchain ID, for its P-Chain page; null until known */
  blockchainId: string | null;
  evmChainId: number | null;
  /** unix seconds */
  joinedAt: number;
  /** active validators; null for a join seen live, before the registry counts it */
  validators: number | null;
  /** the conversion tx, for a join seen live */
  tx: string | null;
}

/** a set the P-Chain runs now, named by its newest chain */
export interface Resident {
  subnetId: string;
  name: string;
  blockchainId: string;
  /** active validators at the proposed height */
  validators: number;
}

/** an L1 the P-Chain has created that runs no validators yet: a site in the city's outskirts */
export interface Site {
  subnetId: string;
  name: string;
  blockchainId: string;
  /** unix seconds */
  createdAt: number;
}

/** how long an L1 counts as new */
export const NEW_DAYS = 7;
const MAX = 6;

interface RegistryEntry {
  name: string;
  blockchainId: string;
  subnetId: string;
  isL1: boolean;
  evmChainId?: number;
  createdAt: number;
  validators: number | null;
}

const getTx = async (hash: string): Promise<Tx | null> => {
  const res = await fetch(pchainApiPath("mainnet", `tx/${hash}`));
  return res.ok ? ((await res.json()) as Tx) : null;
};

export function useNewcomers(txs: PulseTx[]): { newcomers: Newcomer[]; residents: Resident[]; sites: Site[] } {
  const [registry, setRegistry] = useState<Newcomer[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [live, setLive] = useState<Newcomer[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/l1-registry/mainnet", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { recent?: RegistryEntry[]; active?: RegistryEntry[] } | null) => {
        // every set the P-Chain runs now; one with no running validators does not stand
        setResidents(
          (d?.active ?? [])
            .filter((r) => (r.validators ?? 0) > 0)
            .map((r) => ({ subnetId: r.subnetId, name: r.name, blockchainId: r.blockchainId, validators: r.validators ?? 0 })),
        );
        const since = Date.now() / 1000 - NEW_DAYS * 86400;
        const bySubnet = new Map<string, Newcomer>();
        // newest first, so a subnet's newest chain names it; an L1 with no running validators stays off the map
        for (const r of d?.recent ?? []) {
          if (!r.isL1 || r.createdAt < since || r.validators === 0 || bySubnet.has(r.subnetId)) continue;
          bySubnet.set(r.subnetId, {
            subnetId: r.subnetId,
            name: r.name,
            blockchainId: r.blockchainId,
            evmChainId: r.evmChainId ?? null,
            joinedAt: r.createdAt,
            validators: r.validators,
            tx: null,
          });
        }
        setRegistry([...bySubnet.values()]);
        // created in the last two weeks and no validator running yet: still being built
        const building = new Map<string, Site>();
        for (const r of d?.recent ?? []) {
          if (r.validators !== 0 || r.createdAt < since - NEW_DAYS * 86400 || building.has(r.subnetId) || bySubnet.has(r.subnetId)) continue;
          building.set(r.subnetId, { subnetId: r.subnetId, name: r.name, blockchainId: r.blockchainId, createdAt: r.createdAt });
        }
        setSites([...building.values()]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // a conversion that lands while the page is open: its subnet from the tx,
  // its name from the chain that subnet created, which the ledger holds
  useEffect(() => {
    for (const t of txs) {
      if (!t.fresh || t.type !== "ConvertSubnetToL1Tx" || seen.current.has(t.hash)) continue;
      seen.current.add(t.hash);
      const chains = txs.filter((c) => c.type === "CreateChainTx" && c.height <= t.height);
      void (async () => {
        try {
          const tx = await getTx(t.hash);
          const subnetId = tx?.subnetId;
          if (!subnetId) return;
          let name = "New L1";
          let blockchainId: string | null = null;
          for (const c of chains) {
            const ct = await getTx(c.hash);
            // a chain's blockchain ID is the ID of the tx that created it
            if (ct?.subnetId === subnetId) {
              name = ct.details?.chainName || name;
              blockchainId = c.hash;
              break;
            }
          }
          setLive((l) => (l.some((x) => x.subnetId === subnetId) ? l : [...l, { subnetId, name, blockchainId, evmChainId: null, joinedAt: t.ts, validators: null, tx: t.hash }]));
        } catch {
          /* the registry names it within the hour */
        }
      })();
    }
  }, [txs]);

  // one per subnet, a live join over the registry's, newest first
  const newcomers = useMemo(() => {
    const out = new Map<string, Newcomer>();
    for (const n of [...live, ...registry]) if (!out.has(n.subnetId)) out.set(n.subnetId, n);
    return [...out.values()].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, MAX);
  }, [live, registry]);
  return { newcomers, residents, sites };
}
