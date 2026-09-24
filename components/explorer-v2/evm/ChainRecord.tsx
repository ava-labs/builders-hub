"use client";

import { ChainDetailsContent } from "@/components/explorer-v2/pchain/PchainChain";
import { EvmChainDetails } from "@/components/explorer/EvmChainDetails";
import { PRIMARY_SUBNET_ID } from "@/lib/pchain-node";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";


/* The chain's record, at the foot of its Overview (#chain): the same
   on-chain record the P-Chain serves at /p-chain/chain/{id}. It was the
   Details tab; /details now 308s here. */
export function ChainRecord() {
  const chain = useChainContext();
  const catalog = (l1ChainsData as L1Chain[]).find((c) => c.chainId === chain.chainId);
  // the chain's P-Chain record lives on its own network
  const pNetwork = catalog?.isTestnet === true ? "fuji" : "mainnet";
  // Primary Network chains predate the P-Chain's tx record: no CreateChainTx
  const isGenesis = catalog?.subnetId === PRIMARY_SUBNET_ID;

  return (
    <div className="flex flex-col gap-10">
      {/* genesis chains (the C-Chain): one instrument carries everything;
          the P-Chain has no creation record to add, and the old stacked
          boards repeated every identifier twice */}
      {catalog && (
        <EvmChainDetails
          catalog={catalog}
          genesis={isGenesis}
          live={false}
        />
      )}
      {/* L1s: the on-chain record (create tx, VM, subnet status,
          validators) below; none of it duplicates the identity board */}
      {!isGenesis &&
        (catalog?.blockchainId ? (
          <ChainDetailsContent
            network={pNetwork}
            id={catalog.blockchainId}
            base={`/explorer/${pNetwork}/p-chain`}
            website={chain.website}
            socials={chain.socials}
          />
        ) : null)}
    </div>
  );
}
