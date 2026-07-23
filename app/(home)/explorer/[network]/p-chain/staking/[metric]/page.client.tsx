"use client";

import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { StakingMetricContent } from "@/components/explorer-v2/staking/StakingMetricPage";
import type { StakingMetricKey } from "@/components/explorer-v2/staking/staking-metrics";

/* A staking metric's detail sheet in the P-Chain's own chrome — same
   shell the staking tab it opens from uses. */
export function PchainStakingMetricPageClient({
  network,
  metric,
}: {
  network: string;
  metric: StakingMetricKey;
}) {
  return (
    <ExplorerShell chain="p-chain" network={network}>
      <StakingMetricContent
        base={`/explorer/${network}/p-chain/staking`}
        network={network}
        metric={metric}
      />
    </ExplorerShell>
  );
}
