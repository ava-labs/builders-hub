import { permanentRedirect } from "next/navigation";

/* ICM folded into the chains tab: the network map and each chain's 30-day
   messages live there now, on each network. Message pages stay at
   /icm/[messageId]. */
export default async function NetworkIcmPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  permanentRedirect(`/explorer/${network}/chains`);
}
