import SubmitUptimeProofClientPage from "./client-page";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/submit-uptime-proof", "Submit Uptime Proof");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <SubmitUptimeProofClientPage currentStepKey={step} />
    );
}
