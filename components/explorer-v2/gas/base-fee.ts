"use client";

import { useEffect, useMemo, useState } from "react";
import { baseFeeCell, useFeeHistory } from "@/components/explorer/GasMarketPage";
import type { LiveCell } from "@/components/explorer-v2/evm/EvmOverviewStats";
import { CONTINUOUS_EXECUTION_CHAINS, type HeadStream } from "@/components/explorer-v2/evm/useHeadStream";
import { formatPricePerGas, unitParts } from "@/components/explorer-v2/format";
import { baseFeeNow, streamFeeBlocks } from "@/lib/fee-market";
import type { GasMarket } from "@/lib/explorer-clickhouse";

/* The Base Fee readout for pages outside the Gas tab, traced by the gas
   market's 48h hourly medians (range-independent, so the lightest window
   serves it). An L1 shows its Gas tab's readout: the live fee off
   eth_feeHistory. On a chain with Continuous Execution (the C-Chain) the
   header and eth_feeHistory carry the worst-case bound, so the readout is
   the base fee charged, read back from the head stream's receipts and
   written as the Gas tab's Fee Market Now writes it. An undefined rpcUrl
   turns the reads off. */
export function useBaseFeeCell(
  rpcUrl: string | undefined,
  evmChainId: string,
  symbol: string | undefined,
  base: string,
  stream: Pick<HeadStream, "heads" | "streamTxs">,
): LiveCell {
  const ce = CONTINUOUS_EXECUTION_CHAINS.has(evmChainId);
  const fee = useFeeHistory(ce ? undefined : rpcUrl);
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
  const charged = useMemo(
    () => (ce ? baseFeeNow(streamFeeBlocks(stream.heads, stream.streamTxs)) : null),
    [ce, stream.heads, stream.streamTxs],
  );
  if (!ce) return baseFeeCell(fee.baseFeeWei, symbol, base, trace);
  // until the stream holds a block whose charge is known, the cell's own placeholder
  const cell = baseFeeCell(null, symbol, base, trace);
  return charged ? { ...cell, ...unitParts(formatPricePerGas(charged.fee, symbol || "AVAX")) } : cell;
}
