import RemoveValidatorUptimeClientPage from "./client-page";

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <RemoveValidatorUptimeClientPage currentStepKey={step} />
    );
}
