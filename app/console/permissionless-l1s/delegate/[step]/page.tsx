import DelegateClientPage from "./client-page";

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <DelegateClientPage currentStepKey={step} />
    );
}
