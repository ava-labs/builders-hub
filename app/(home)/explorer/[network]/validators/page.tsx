import { permanentRedirect } from "next/navigation";

/* The network's validator sets folded into the chains tab: the map paints
   each set by client version and the directory carries the share on
   target, on each network. Primary Network staking stays at
   /p-chain/validators. */
export default async function NetworkValidatorsPage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  permanentRedirect(`/explorer/${network}/chains`);
}
