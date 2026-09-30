"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { ValidatorsContent } from "@/components/explorer-v2/pchain/PchainValidators";
import { L1ValidatorsContent } from "@/components/explorer-v2/L1Validators";
import { PrimaryValidatorsContent } from "@/components/explorer-v2/staking/PrimaryValidators";
import { useChainContext } from "../layout.client";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { ValidatorsViewSwitch } from "@/components/explorer-v2/evm/views";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* The chain's Validators tab. The C-Chain's validators ARE the Primary
   Network's, so the C-Chain gets the list-first roster on either network:
   the set, versions, health, and on mainnet how the count got here. The
   staking economics are the tab's second view (validators/staking), on
   mainnet alone. Every other chain shows its OWN set
   (weight, prepaid balance, client versions) from the P-Chain, inside
   its own chrome — this absorbed /stats/validators/[slug]. */
export function ChainValidatorsPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.chainId === chain.chainId);
  // the validator set lives on the chain's own network's P-Chain
  const pNetwork = catalog?.isTestnet === true ? "fuji" : "mainnet";
  const isPrimarySet = chainSlug === "c-chain";
  const base = `/explorer/${pNetwork}/p-chain`;

  return (
    <ExplorerLayout
      chainId={chain.chainId}
      chainName={chain.chainName}
      chainSlug={chain.chainSlug}
      themeColor={chain.themeColor}
      chainLogoURI={chain.chainLogoURI}
      rpcUrl={chain.rpcUrl}
      hideIdentity
    >
      <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-2 md:px-6">
        {isPrimarySet ? (
          <div className="flex flex-col gap-6">
            {/* the staking view reads mainnet alone */}
            <SectionHeader
              label="Primary Network"
              action={pNetwork === "mainnet" ? <ValidatorsViewSwitch base={`/explorer/mainnet/${chainSlug}`} view="set" /> : undefined}
            />
            <PrimaryValidatorsContent stakingHref={`/explorer/mainnet/${chainSlug}/validators/staking`} switched network={pNetwork} />
          </div>
        ) : chainSlug !== "c-chain" && catalog?.subnetId ? (
          <L1ValidatorsContent subnetId={catalog.subnetId} network={pNetwork} base={base} />
        ) : (
          // a catalog gap: the Primary Network set list
          <ValidatorsContent network={pNetwork} base={base} />
        )}
      </div>
    </ExplorerLayout>
  );
}
