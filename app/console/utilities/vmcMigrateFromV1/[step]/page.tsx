import VmcMigrateClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/utilities/vmcMigrateFromV1");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <VmcMigrateClientPage currentStepKey={step} />
    );
}
