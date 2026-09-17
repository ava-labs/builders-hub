import ChangeWeightClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/change-validator-weight");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <ChangeWeightClientPage currentStepKey={step} />;
}
