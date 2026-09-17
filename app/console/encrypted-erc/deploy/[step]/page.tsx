import DeployClientPage from './client-page';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/encrypted-erc", "Encrypted ERC");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <DeployClientPage currentStepKey={step} />;
}
