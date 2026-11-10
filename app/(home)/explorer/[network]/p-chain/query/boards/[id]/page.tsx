import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";
import { boardHref, boardScope } from "@/lib/explorer-query/board-links";
import { sharedBoard } from "@/lib/explorer-query/board-shared";
import { PchainQueryBoardClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, id } = await params;
  const net = NETWORK_LABEL[network as keyof typeof NETWORK_LABEL] ?? network;
  // a shared link unfurls with the board's own name
  const shared = await sharedBoard(id);
  const title = `${shared ? `${shared.name} · ` : ""}P-Chain Query board · ${net} | Avalanche Explorer`;
  const description = "A page of P-Chain charts built from Query answers.";
  return { ...createMetadata({ title, description, openGraph: { title, description, url: `/explorer/${network}/p-chain/query/boards/${id}` } }), robots: { index: false } };
}

/* one P-Chain board: the reader's own from the device's store, any board
   an account keeps from its link */
export default async function PchainQueryBoardPage({ params }: PageProps) {
  const { network, id } = await params;
  if (network !== "mainnet" && network !== "fuji") notFound();
  const shared = await sharedBoard(id);
  // a board's SQL names one chain: its link opens on that chain's page
  if (shared && shared.scope !== boardScope(network, "p-chain")) {
    const [net, chain] = shared.scope.split(":");
    redirect(boardHref(net, chain, id));
  }
  return <PchainQueryBoardClient network={network} id={id} shared={shared} />;
}
