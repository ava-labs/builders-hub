"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { ValidatorsContent } from "@/components/explorer-v2/pchain/PchainValidators";
import { useChainContext } from "../layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* The chain's Validators tab: the Primary Network's validator set (the
   C-Chain's validators ARE the Primary Network's), mounted inside this
   chain's own chrome so the tabs and header never switch context. */
export function ChainValidatorsPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug);
  // the validator set lives on the chain's own network's P-Chain
  const pNetwork = catalog?.isTestnet === true ? "fuji" : "mainnet";

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
        <ValidatorsContent network={pNetwork} base={`/explorer/${pNetwork}/p-chain`} />
      </div>
    </ExplorerLayout>
  );
}
