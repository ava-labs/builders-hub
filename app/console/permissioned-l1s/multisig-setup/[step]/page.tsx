import MultisigSetupClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/multisig-setup", "Multisig Setup");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <MultisigSetupClientPage currentStepKey={step} />
    );
}
