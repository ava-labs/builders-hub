import ERC20StakingManagerSetupClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/erc20-staking-manager-setup", "ERC-20 Staking Manager Setup");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <ERC20StakingManagerSetupClientPage currentStepKey={step} />;
}
