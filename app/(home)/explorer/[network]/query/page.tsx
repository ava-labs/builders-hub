import { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { createMetadata } from "@/utils/metadata";
import { queryTarget } from "@/lib/explorer-query/target";
import { indexState } from "@/lib/explorer-query/clickhouse";
import { NetworkQuery, type NetworkQueryChain } from "@/components/explorer-v2/evm/EvmQuery";

const PCHAIN_LOGO =
  "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg";

export const metadata: Metadata = createMetadata({
  title: "Query | Avalanche Explorer",
  description: "Ask an Avalanche chain a question in plain words and get a chart with its SQL.",
  openGraph: {
    title: "Query Avalanche",
    description: "Ask the C-Chain, the P-Chain or an L1 a question and get a chart you can audit.",
    url: "/explorer/mainnet/query",
  },
});

/* The chains the picker offers: every chain the per-chain Query tab exists
   for (queryTarget, on catalog chains with an RPC), less those the
   database holds no rows of. */
async function queryChains(): Promise<NetworkQueryChain[]> {
  const catalog = (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true);
  const cchain = catalog.find((c) => c.slug === "c-chain");
  const l1s = catalog
    .filter((c) => c.slug !== "c-chain" && c.rpcUrl && queryTarget("mainnet", c.slug))
    .sort((a, b) => a.chainName.localeCompare(b.chainName));
  const candidates: Omit<NetworkQueryChain, "index">[] = [
    { chainId: 43114, chainSlug: "c-chain", chainName: "the C-Chain", label: "C-Chain", logo: cchain?.chainLogoURI, nativeToken: "AVAX", kind: "evm" },
    { chainId: 1, chainSlug: "p-chain", chainName: "the P-Chain", label: "P-Chain", logo: PCHAIN_LOGO, nativeToken: "AVAX", kind: "pchain" },
    ...l1s.map((c) => ({
      chainId: queryTarget("mainnet", c.slug)!.chainId,
      chainSlug: c.slug,
      chainName: c.chainName,
      label: c.chainName,
      logo: c.chainLogoURI,
      nativeToken: c.networkToken?.symbol,
      kind: "evm" as const,
    })),
  ];
  const states = await Promise.all(candidates.map((c) => indexState(Number(c.chainId))));
  // the C-Chain stays even when the database is slow or empty: it is the default
  return candidates.flatMap((c, i) => (states[i] === "empty" && c.chainSlug !== "c-chain" ? [] : [{ ...c, index: states[i] }]));
}

/* Query at the network scope. The tables cover mainnet chains, so every
   other network lands on mainnet. */
export default async function NetworkQueryPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/query");
  const chains = await queryChains();
  // the page reads ?q and ?chain, so it renders under a Suspense boundary
  return (
    <Suspense>
      <NetworkQuery network={network} chains={chains} />
    </Suspense>
  );
}
