"use client";

import { useEffect, useState } from "react";
import { baseFeeCell, useFeeHistory } from "@/components/explorer/GasMarketPage";
import type { LiveCell } from "@/components/explorer-v2/evm/EvmOverviewStats";
import type { GasMarket } from "@/lib/explorer-clickhouse";

/* The Gas tab's Base Fee readout for pages outside it: the live fee off
   the RPC, traced by the gas market's 48h hourly medians (range-independent,
   so the lightest window serves it). An undefined rpcUrl turns both off. */
export function useBaseFeeCell(rpcUrl: string | undefined, evmChainId: string, symbol: string | undefined, base: string): LiveCell {
  const fee = useFeeHistory(rpcUrl);
  const [trace, setTrace] = useState<number[] | undefined>();
  useEffect(() => {
    if (!rpcUrl) return;
    let cancelled = false;
    fetch(`/api/gas-market/${evmChainId}?range=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GasMarket | null) => {
        if (!cancelled && data) setTrace(data.hourly.map((h) => h.p50));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rpcUrl, evmChainId]);
  return baseFeeCell(fee.baseFeeWei, symbol, base, trace);
}
