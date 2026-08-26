import NativeStakingManagerSetupClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/native-staking-manager-setup", "Native Staking Manager Setup");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <NativeStakingManagerSetupClientPage currentStepKey={step} />;
}
