"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { ValidatorsContent } from "@/components/explorer-v2/pchain/PchainValidators";
import { L1ValidatorsContent } from "@/components/explorer-v2/L1Validators";
import { PrimaryValidatorsContent } from "@/components/explorer-v2/staking/PrimaryValidators";
import { useChainContext } from "../layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* The chain's Validators tab. The C-Chain's validators ARE the Primary
   Network's, so mainnet C-Chain gets the list-first roster — the set,
   versions, health, and how the count got here. The staking economics
   live on the sibling Staking tab. Every other chain shows its OWN set
   (weight, prepaid balance, client versions) from the P-Chain, inside
   its own chrome — this absorbed /stats/validators/[slug]. */
export function ChainValidatorsPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug);
  // the validator set lives on the chain's own network's P-Chain
  const pNetwork = catalog?.isTestnet === true ? "fuji" : "mainnet";
  // the roster's feeds (p2p + SDK) watch the mainnet Primary Network
  const isPrimarySet = chainSlug === "c-chain" && pNetwork === "mainnet";
  const base = `/explorer/${pNetwork}/p-chain`;

  return (
    <ExplorerLayout
      chainId={chain.chainId}
      chainName={chain.chainName}
      chainSlug={chain.chainSlug}
      themeColor={chain.themeColor}
      chainLogoURI={chain.chainLogoURI}
      website={chain.website}
      socials={chain.socials}
      rpcUrl={chain.rpcUrl}
    >
      <div className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-2 md:px-6">
        {isPrimarySet ? (
          <PrimaryValidatorsContent stakingHref={`/explorer/mainnet/${chainSlug}/staking`} />
        ) : chainSlug !== "c-chain" && catalog?.subnetId ? (
          <L1ValidatorsContent subnetId={catalog.subnetId} network={pNetwork} base={base} />
        ) : (
          // Fuji C-Chain (and catalog gaps): the Primary Network set list
          <ValidatorsContent network={pNetwork} base={base} />
        )}
      </div>
    </ExplorerLayout>
  );
}
