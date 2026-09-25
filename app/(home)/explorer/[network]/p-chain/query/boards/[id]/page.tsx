import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { PchainQueryBoardClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, id } = await params;
  const net = NETWORK_LABEL[network as keyof typeof NETWORK_LABEL] ?? network;
  const title = `P-Chain Query board · ${net} | Avalanche Explorer`;
  const description = "A page of P-Chain charts built from Query answers.";
  return { ...createMetadata({ title, description, openGraph: { title, description, url: `/explorer/${network}/p-chain/query/boards/${id}` } }), robots: { index: false } };
}

/* one P-Chain board, kept on this device */
export default async function PchainQueryBoardPage({ params }: PageProps) {
  const { network, id } = await params;
  if (network !== "mainnet" && network !== "fuji") notFound();
  return <PchainQueryBoardClient network={network} id={id} />;
}
