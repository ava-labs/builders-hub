import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExplorerChain, NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { answerMetadata } from "@/lib/explorer-query/share-answer";
import { PchainQueryClient } from "./page.client";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ network: string }>; searchParams: Promise<{ q?: string | string[]; then?: string | string[] }> }): Promise<Metadata> {
  const { network } = await params;
  // a link to an answer (?q=) is named by the answer: its title, its note and its own share image
  const { q, then } = await searchParams;
  const shared = await answerMetadata({ network, slug: "p-chain", q, then, path: `/explorer/${network}/p-chain/query` });
  if (shared) return shared;
  const net = NETWORK_LABEL[network as keyof typeof NETWORK_LABEL] ?? network;
  const title = `Ask the P-Chain · ${net} | Avalanche Explorer`;
  const description = "Ask the P-Chain a question in plain words: validators, staking, delegations, L1s and supply, as a chart with the SQL behind it.";
  return createMetadata({ title, description, openGraph: { title, description, url: `/explorer/${network}/p-chain/query` } });
}

/* the P-Chain's Query page; its tables cover mainnet and Fuji */
export default async function PchainQueryPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network) || (network !== "mainnet" && network !== "fuji")) notFound();
  return <PchainQueryClient network={network} />;
}
