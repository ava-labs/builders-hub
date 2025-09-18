import CreateL1ClientPage from "./client-page";

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
    const { step } = await params;
    return (
        <CreateL1ClientPage currentStepKey={step} />
    );
}
