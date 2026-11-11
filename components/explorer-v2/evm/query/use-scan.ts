"use client";

/* the landing page's live cards, read once from what the scan kept (app/api/explorer/query/scan). The page never
   waits on it: until it lands, and when it holds nothing, each card shows its question with its drawn glyph */

import { useEffect, useState } from "react";
import type { ScanCard } from "@/lib/explorer-query/scan-card";

export interface KeptScan {
  /** unix ms the scan ended */
  at: number;
  cards: Record<string, ScanCard>;
}

export function useScan(chainId: string | number): KeptScan | null {
  const [got, setGot] = useState<{ chainId: string; scan: KeptScan } | null>(null);
  const id = String(chainId);
  useEffect(() => {
    let live = true;
    fetch(`/api/explorer/query/scan?chainId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((out: { at: number | null; cards: Record<string, ScanCard> } | null) => {
        if (live && out?.at && Object.keys(out.cards).length) setGot({ chainId: id, scan: { at: out.at, cards: out.cards } });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id]);
  return got && got.chainId === id ? got.scan : null;
}
