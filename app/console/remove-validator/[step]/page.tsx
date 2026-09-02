import RemoveValidatorClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/remove-validator");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <RemoveValidatorClientPage currentStepKey={step} />;
}
