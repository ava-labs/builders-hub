import L1UpgradeClientPage from './client-page';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/upgrade");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <L1UpgradeClientPage currentStepKey={step} />;
}
