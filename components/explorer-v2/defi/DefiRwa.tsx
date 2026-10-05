"use client";

import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { DefiSwitch } from "@/components/explorer-v2/network/defi-switch";
import { useMetrics } from "@/lib/rwa/hooks/useMetrics";
import { useHistorical } from "@/lib/rwa/hooks/useHistorical";
import { useFenceMetrics } from "@/lib/rwa/hooks/useFenceMetrics";
import { useFenceHistorical } from "@/lib/rwa/hooks/useFenceHistorical";
import { RwaDashboard } from "./RwaDashboard";

/* The C-Chain DeFi tab's RWA view: the Valinor x OatFi x Fence pilot,
   real-world asset lending through an SPV on the C-Chain. Lenders fund a
   tranche pool, the pool finances the borrower, and the borrower's
   repayments flow back. The view reads the pool's figures and history
   every 5 minutes and Fence's every 10, as the old dashboard did; its
   charts cut their own ranges from the whole history, so the page clock
   has nothing to drive here. */

/* the pilot's three slugs read one pool; one slug keeps one set of caches warm */
const POOL = "oatfi";

export function DefiRwa() {
  const pool = useMetrics({ slug: POOL });
  const history = useHistorical({ slug: POOL });
  const fence = useFenceMetrics({ slug: POOL });
  const collections = useFenceHistorical({ slug: POOL });
  const refresh = () => Promise.allSettled([pool.refresh(), history.refresh(), fence.refresh(), collections.refresh()]);

  return (
    <EvmShell network="mainnet">
      <div className="mb-8">
        <DefiSwitch on="rwa" />
      </div>
      <RwaDashboard
        slug={POOL}
        feeds={{
          metrics: pool.metrics,
          metricsFailed: !!pool.error,
          historical: history.historical,
          historicalFailed: !!history.error,
          fence: fence.fenceMetrics,
          fenceFailed: !!fence.error,
          fenceHistory: collections.fenceHistorical,
          fenceHistoryFailed: !!collections.error,
        }}
        onRefresh={refresh}
      />
    </EvmShell>
  );
}
