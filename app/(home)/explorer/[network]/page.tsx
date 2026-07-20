import { redirect } from "next/navigation";

/* /explorer/{network} → that network's default chain. The Platform Chain is
   the explorer's front door; EVM chains hang off /explorer/{network}/{slug}. */
export default async function ExplorerNetworkHome({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  redirect(`/explorer/${network}/p-chain`);
}
