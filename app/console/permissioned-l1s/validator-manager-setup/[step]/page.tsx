import ValidatorManagerSetupClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/validator-manager-setup");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <ValidatorManagerSetupClientPage currentStepKey={step} />
    );
}
