"use client";

import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { PrimaryStakingContent } from "@/components/explorer-v2/staking/PrimaryStaking";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { ValidatorsViewSwitch } from "@/components/explorer-v2/evm/views";

/* The Validators tab's second view on the C-Chain: the Primary Network's staking economy in the
   explorer's own shell, the search header every EVM page begins with.
   The staking feeds are mainnet-only; the route guards Fuji already. */
export function ChainStakingPageClient({ chainSlug }: { chainSlug: string }) {
  return (
    <EvmShell network="mainnet">
      <div className="flex flex-col gap-6">
        <SectionHeader label="Primary Network" action={<ValidatorsViewSwitch base={`/explorer/mainnet/${chainSlug}`} view="staking" />} />
        <PrimaryStakingContent
          switched
          validatorsHref={`/explorer/mainnet/${chainSlug}/validators`}
          base={`/explorer/mainnet/${chainSlug}/validators/staking`}
        />
      </div>
    </EvmShell>
  );
}
