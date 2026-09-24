"use client";

import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { PrimaryStakingContent } from "@/components/explorer-v2/staking/PrimaryStaking";

/* The C-Chain's Staking tab: the Primary Network's staking economy in the
   explorer's own shell, the search header every EVM page begins with.
   The staking feeds are mainnet-only; the route guards Fuji already. */
export function ChainStakingPageClient({ chainSlug }: { chainSlug: string }) {
  return (
    <EvmShell network="mainnet">
      <div className="flex flex-col gap-10">
        <PrimaryStakingContent
          validatorsHref={`/explorer/mainnet/${chainSlug}/validators`}
          base={`/explorer/mainnet/${chainSlug}/staking`}
        />
      </div>
    </EvmShell>
  );
}
