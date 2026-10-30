"use client";

import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { DefiSwitch } from "@/components/explorer-v2/network/defi-switch";
import { useMetrics } from "@/lib/rwa/hooks/useMetrics";
import { useHistorical } from "@/lib/rwa/hooks/useHistorical";
import { useFenceMetrics } from "@/lib/rwa/hooks/useFenceMetrics";
import { useFenceHistorical } from "@/lib/rwa/hooks/useFenceHistorical";
import { FacilitySwitch } from "./facility-switch";
import { RwaDashboard } from "./RwaDashboard";
import { RWA_VIEWS, type RwaSlug } from "./rwa-views";

/* The C-Chain DeFi tab's RWA view, one page per facility, with a switch
   beside the DeFi switch (under it on a phone) that moves between them.
   OatFi's facility is real-world asset lending through an SPV: lenders
   fund a tranche pool, the pool finances the borrower, and the borrower's
   repayments flow back. Rain's is a Credit Coop line of credit: Valinor
   commits capital to it through the Valinor Credit Vault, Rain draws on
   it, and the Spigot pays Rain's revenue back in as repayments. Every read
   names the view's own facility, so a page shows no other facility's
   figures. The view reads the figures and history every 5 minutes and,
   for OatFi alone, Fence's every 10, as the old dashboard did; its charts
   cut their own ranges from the whole history, so the page clock has
   nothing to drive here. */

export function DefiRwa({ slug }: { slug: RwaSlug }) {
  const view = RWA_VIEWS[slug];
  const pool = useMetrics({ slug: view.facility.slug });
  const history = useHistorical({ slug: view.facility.slug });
  const fence = useFenceMetrics({ slug: view.facility.slug, enabled: view.facility.features.fence });
  const collections = useFenceHistorical({ slug: view.facility.slug, enabled: view.facility.features.fence });
  const refresh = () => Promise.allSettled([pool.refresh(), history.refresh(), fence.refresh(), collections.refresh()]);

  return (
    <EvmShell network="mainnet">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <DefiSwitch on="rwa" />
        <FacilitySwitch on={slug} />
      </div>
      <RwaDashboard
        view={view}
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
