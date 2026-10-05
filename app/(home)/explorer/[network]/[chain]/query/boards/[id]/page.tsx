import type { Metadata } from "next";
import { redirect } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { chainCardMetadata } from "@/utils/explorer-metadata";
import { boardHref, boardScope } from "@/lib/explorer-query/board-links";
import { sharedBoard } from "@/lib/explorer-query/board-shared";
import { QueryBoardClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; chain: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, chain: chainSlug, id } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  // a shared link unfurls with the board's own name
  const shared = await sharedBoard(id);
  return {
    ...chainCardMetadata({
      chainSlug,
      title: `${shared ? `${shared.name} · ` : ""}${name} Query board | Avalanche Explorer`,
      description: `A page of ${name} charts built from Query answers.`,
      url: `/explorer/${network}/${chainSlug}/query/boards/${id}`,
    }),
    robots: { index: false },
  };
}

/* one board: a canvas of pinned answers. The reader's own opens from
   the device's store; any board an account keeps opens from its link. */
export default async function QueryBoardPage({ params }: PageProps) {
  const { network, chain: chainSlug, id } = await params;
  const shared = await sharedBoard(id);
  // a board's SQL names one chain: its link opens on that chain's page
  if (shared && shared.scope !== boardScope(network, chainSlug)) {
    const [net, chain] = shared.scope.split(":");
    redirect(boardHref(net, chain, id));
  }
  return <QueryBoardClient network={network} id={id} shared={shared} />;
}
