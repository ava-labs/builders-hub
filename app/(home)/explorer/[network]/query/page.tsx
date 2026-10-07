import { Metadata } from "next";
import { redirect } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { createMetadata } from "@/utils/metadata";
import { NETWORK_SLUG, queryTarget } from "@/lib/explorer-query/target";
import { indexState } from "@/lib/explorer-query/clickhouse";
import type { NetworkQueryChain } from "@/components/explorer-v2/evm/network-query";
import { NetworkQueryClient } from "./page.client";

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

/* The chains the picker offers: All chains (the C-Chain and every L1 the
   database holds, asked as one), then every chain the per-chain Query tab
   exists for (queryTarget, on catalog chains with an RPC). Which of them the
   database holds no rows of streams in after the page (NetworkQuery). */
function queryChains(): NetworkQueryChain[] {
  const catalog = (l1ChainsData as L1Chain[]).filter((c) => c.isTestnet !== true);
  const cchain = catalog.find((c) => c.slug === "c-chain");
  const l1s = catalog
    .filter((c) => c.slug !== "c-chain" && c.rpcUrl && queryTarget("mainnet", c.slug))
    .sort((a, b) => a.chainName.localeCompare(b.chainName));
  return [
    { chainId: NETWORK_SLUG, chainSlug: NETWORK_SLUG, chainName: "every chain", label: "All chains", nativeToken: "", kind: "evm" },
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
}

/* Query at the network scope. The tables cover mainnet chains, so every
   other network lands on mainnet. */
export default async function NetworkQueryPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/query");
  const chains = queryChains();
  // streamed, not awaited: the page goes out at once and the reads follow it
  const index = Promise.all(chains.map((c) => (c.chainSlug === NETWORK_SLUG ? null : indexState(Number(c.chainId)))));
  return <NetworkQueryClient network={network} chains={chains} index={index} />;
}
