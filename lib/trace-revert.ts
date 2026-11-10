import { SOFT_READ, isOk, statusOf } from "@/lib/explorer-soft-status";
import type { TraceResponse } from "@/lib/trace";

/* Why a mined tx reverted, for the Console's failure messages. It reads
   the tx page's trace route (stats-api, app/api/trace), so no request here
   causes a trace on a node. The pipeline is a few seconds behind the
   chain, so a tx that just reverted is often not indexed yet: the read asks
   again after each wait in WAITS_MS, then gives up with null. A chain the
   pipeline does not trace answers null at once. */

const WAITS_MS = [0, 1_500, 2_000, 2_500];

export async function revertReasonOf(chainId: number, hash: string, block: bigint | number): Promise<string | null> {
  for (const wait of WAITS_MS) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch(`/api/trace/${chainId}/${hash}?block=${block}`, SOFT_READ);
      if (isOk(res)) {
        const { call } = (await res.json()) as TraceResponse;
        return call.revertReason ?? call.error ?? null;
      }
      const status = statusOf(res);
      if (status === 404) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        if (error !== "not_indexed") return null;
      } else if (status !== 503) return null;
    } catch {
      return null;
    }
  }
  return null;
}
