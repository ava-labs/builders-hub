import { redirect } from "next/navigation";
import IcmTestConnectionClientPage from "./client-page";
import { steps } from "../steps";

function isValidStep(stepKey: string): boolean {
    return steps.some((s) => {
        if (s.type === "single") return s.key === stepKey;
        if (s.type === "branch") return s.options.some((opt) => opt.key === stepKey);
        return false;
    });
}

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;

    if (!isValidStep(step)) {
        redirect("/console/icm/test-connection");
    }

    return (
        <IcmTestConnectionClientPage currentStepKey={step} />
    );
}
