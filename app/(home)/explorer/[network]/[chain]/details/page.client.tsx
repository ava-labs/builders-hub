"use client";

import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { ChainDetailsContent } from "@/components/explorer-v2/pchain/PchainChain";
import { EvmChainDetails } from "@/components/explorer/EvmChainDetails";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { useChainContext } from "../layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

/* The chain's Details tab: the same on-chain record the P-Chain serves at
   /p-chain/chain/{id}, mounted inside this chain's own chrome so the rail
   and header never switch context. */
export function ChainDetailsPageClient({ chainSlug }: { chainSlug: string }) {
  const chain = useChainContext();
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug);
  // the chain's P-Chain record lives on its own network
  const pNetwork = catalog?.isTestnet === true ? "fuji" : "mainnet";
  // Primary Network chains predate the P-Chain's tx record — no CreateChainTx
  const isGenesis = catalog?.subnetId === PRIMARY_SUBNET_ID;

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
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 pb-16 pt-2 md:px-6">
        {/* genesis chains (the C-Chain): one instrument carries everything —
            the P-Chain has no creation record to add, and the old stacked
            boards repeated every identifier twice */}
        {catalog && (
          <EvmChainDetails
            catalog={catalog}
            genesis={isGenesis}
            genesisHref={
              // both C-Chain catalog entries (43114 mainnet / 43113 fuji)
              // point at the vendored genesis for their own network
              catalog.chainId === "43114" || catalog.chainId === "43113"
                ? `/explorer/${pNetwork}/c-chain/genesis`
                : undefined
            }
          />
        )}
        {/* L1s: the on-chain record (create tx, VM, subnet status,
            validators) below — none of it duplicates the identity board */}
        {!isGenesis &&
          (catalog?.blockchainId ? (
            <ChainDetailsContent
              network={pNetwork}
              id={catalog.blockchainId}
              base={`/explorer/${pNetwork}/p-chain`}
              website={chain.website}
              socials={chain.socials}
            />
          ) : (
            <p className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
              No on-chain record for this chain
            </p>
          ))}
      </div>
    </ExplorerLayout>
  );
}
