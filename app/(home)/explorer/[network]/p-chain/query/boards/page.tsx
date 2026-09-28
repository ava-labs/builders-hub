import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { PchainQueryBoardsClient } from "./page.client";

export async function generateMetadata({ params }: { params: Promise<{ network: string }> }): Promise<Metadata> {
  const { network } = await params;
  const net = NETWORK_LABEL[network as keyof typeof NETWORK_LABEL] ?? network;
  const title = `P-Chain Query boards · ${net} | Avalanche Explorer`;
  const description = "Pages of P-Chain charts built from Query answers.";
  return { ...createMetadata({ title, description, openGraph: { title, description, url: `/explorer/${network}/p-chain/query/boards` } }), robots: { index: false } };
}

/* the boards this device built on the P-Chain */
export default async function PchainQueryBoardsPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (network !== "mainnet" && network !== "fuji") notFound();
  return <PchainQueryBoardsClient network={network} />;
}
