import AddValidatorClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/add-validator");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <AddValidatorClientPage currentStepKey={step} />;
}
