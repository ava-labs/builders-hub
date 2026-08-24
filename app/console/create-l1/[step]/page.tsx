import CreateL1StepClientPage from './client-page';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/create-l1", "Create L1");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <CreateL1StepClientPage currentStepKey={step} />;
}
