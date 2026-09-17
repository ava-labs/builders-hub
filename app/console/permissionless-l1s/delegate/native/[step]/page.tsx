import DelegateNativeClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/delegate", "Delegate");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <DelegateNativeClientPage currentStepKey={step} />;
}
