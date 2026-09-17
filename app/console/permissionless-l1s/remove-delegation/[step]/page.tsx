import RemoveDelegationClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/remove-delegation", "Remove Delegation");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <RemoveDelegationClientPage currentStepKey={step} />
    );
}
